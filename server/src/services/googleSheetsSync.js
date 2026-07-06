import { readFileSync } from "node:fs";
import { google } from "googleapis";
import { env } from "../config/env.js";
import { listPlayerRegistrations } from "./registrationRepository.js";
import { getTournament } from "./tournamentRepository.js";

const SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets";

const CELL_MAX = 49000;

/** First data row for CRM layout (1-based). Columns C–K only. */
const CRM_SHEET_START_ROW = 5;

function assertGoogleSheetsConfigured() {
  if (
    env.googleServiceAccountJson ||
    env.googleServiceAccountJsonB64 ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim()
  ) {
    return;
  }
  const err = new Error(
    "Google Sheets sync requires GOOGLE_SERVICE_ACCOUNT_JSON, GOOGLE_SERVICE_ACCOUNT_JSON_B64, or GOOGLE_APPLICATION_CREDENTIALS",
  );
  err.status = 503;
  throw err;
}

function parseServiceAccountObject() {
  if (env.googleServiceAccountJson) {
    try {
      return JSON.parse(env.googleServiceAccountJson);
    } catch {
      const err = new Error("GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON");
      err.status = 500;
      throw err;
    }
  }
  if (env.googleServiceAccountJsonB64) {
    try {
      return JSON.parse(Buffer.from(env.googleServiceAccountJsonB64, "base64").toString("utf8"));
    } catch {
      const err = new Error("GOOGLE_SERVICE_ACCOUNT_JSON_B64 could not be decoded as base64 JSON");
      err.status = 500;
      throw err;
    }
  }
  return null;
}

function getServiceAccountEmailHint() {
  const j = parseServiceAccountObject();
  if (j?.client_email) return String(j.client_email);
  const path = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim();
  if (path) {
    try {
      const parsed = JSON.parse(readFileSync(path, "utf8"));
      if (parsed.client_email) return String(parsed.client_email);
    } catch {
      // ignore
    }
  }
  return null;
}

/**
 * @param {unknown} err
 */
function mapGoogleSheetsApiError(err) {
  const rawMsg =
    (err && typeof err === "object" && "message" in err && typeof err.message === "string" ? err.message : null) ||
    String(err);
  const responseStatus =
    err && typeof err === "object" && "response" in err && err.response && typeof err.response === "object"
      ? "status" in err.response && typeof err.response.status === "number"
        ? err.response.status
        : undefined
      : undefined;
  const errCode = err && typeof err === "object" && "code" in err ? err.code : undefined;
  const numericCode =
    typeof responseStatus === "number"
      ? responseStatus
      : typeof errCode === "number"
        ? errCode
        : Number.parseInt(String(errCode ?? ""), 10);
  const data =
    err && typeof err === "object" && "response" in err && err.response && typeof err.response === "object"
      ? "data" in err.response
        ? err.response.data
        : undefined
      : undefined;
  const apiMessage =
    data && typeof data === "object" && "error" in data && data.error && typeof data.error === "object"
      ? "message" in data.error && typeof data.error.message === "string"
        ? data.error.message
        : undefined
      : undefined;
  const detail = apiMessage || rawMsg;
  const saEmail = getServiceAccountEmailHint();

  if (numericCode === 404 || /Requested entity was not found/i.test(detail) || /^not found$/i.test(detail.trim())) {
    const shareHint = saEmail
      ? ` Share the Google Sheet with ${saEmail} as Editor.`
      : " Share the Google Sheet with the service account (client_email from your key) as Editor.";
    const e = new Error(
      `Spreadsheet not found or not visible to this service account. Copy the ID from the sheet URL (between /d/ and /edit).${shareHint} (Google: ${detail})`,
    );
    e.status = 404;
    return e;
  }

  if (numericCode === 403 || /permission|forbidden|insufficient/i.test(detail)) {
    const shareHint = saEmail
      ? ` Open the Sheet → Share → add ${saEmail} as Editor.`
      : " Share the Sheet with your service account email as Editor.";
    const e = new Error(`Google Sheets access denied.${shareHint} (Google: ${detail})`);
    e.status = 403;
    return e;
  }

  const e = new Error(`Google Sheets API error: ${detail}`);
  e.status = Number.isInteger(numericCode) && numericCode >= 400 && numericCode < 600 ? numericCode : 502;
  return e;
}

async function getSheetsClient() {
  assertGoogleSheetsConfigured();
  const credentials = parseServiceAccountObject();
  const auth = credentials
    ? new google.auth.GoogleAuth({ credentials, scopes: [SHEETS_SCOPE] })
    : new google.auth.GoogleAuth({
        keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS.trim(),
        scopes: [SHEETS_SCOPE],
      });
  return google.sheets({ version: "v4", auth });
}

/** @param {unknown} v */
function cellValue(v) {
  if (v === null || v === undefined) return "";
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  if (typeof v === "string") return truncateCell(v);
  if (v instanceof Date) return v.toISOString();
  try {
    return truncateCell(JSON.stringify(v));
  } catch {
    return "";
  }
}

function truncateCell(s) {
  if (s.length <= CELL_MAX) return s;
  return `${s.slice(0, CELL_MAX - 20)}…(truncated)`;
}

function escapeSheetTitleForRange(title) {
  return String(title).replace(/'/g, "''");
}

/**
 * Last row in column C from startRow downward that still has CRM data.
 * @returns {number} 1-based row index, or startRow - 1 when the block is empty
 */
async function findLastPopulatedCrmRow(sheetsApi, spreadsheetId, safeTitle, startRow) {
  const { data } = await sheetsApi.spreadsheets.values.get({
    spreadsheetId,
    range: `'${safeTitle}'!C${startRow}:C`,
  });
  const rows = data.values || [];
  for (let i = rows.length - 1; i >= 0; i--) {
    const cell = rows[i]?.[0];
    if (cell != null && String(cell).trim() !== "") {
      return startRow + i;
    }
  }
  return startRow - 1;
}

/**
 * Writes CRM registration rows only: C{start}:K{start+n-1} on one worksheet tab.
 * No other tabs, columns, or tournament data are written.
 *
 * @param {string} tournamentId
 * @param {string} spreadsheetId
 * @param {{ registrationIds?: string[] | null, sheetName?: string | null }} [options]
 */
export async function syncCrmRegistrationsToGoogleSheet(tournamentId, spreadsheetId, options = {}) {
  const data = await getTournament(tournamentId);
  if (!data) {
    const err = new Error("Tournament not found");
    err.status = 404;
    throw err;
  }

  let registrations = await listPlayerRegistrations(tournamentId);
  const ids = options.registrationIds;

  if (ids != null) {
    if (ids.length === 0) {
      registrations = [];
    } else {
      const byId = new Map(registrations.map((r) => [r.id, r]));
      registrations = ids.map((id) => byId.get(id)).filter(Boolean);
    }
  } else {
    registrations = registrations.filter((r) => !r.archivedAt && !r.substituteFlag);
    registrations.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  const sheetsApi = await getSheetsClient();

  let sheetTitle = options.sheetName?.trim() || "";
  if (!sheetTitle) {
    const { data: ss } = await sheetsApi.spreadsheets.get({ spreadsheetId });
    sheetTitle = ss.sheets?.[0]?.properties?.title || "";
  }
  if (!sheetTitle) {
    const err = new Error("Spreadsheet has no worksheet tabs");
    err.status = 400;
    throw err;
  }

  const safeTitle = escapeSheetTitleForRange(sheetTitle);
  const start = CRM_SHEET_START_ROW;

  const values = registrations.map((r) => [
    cellValue(r.name),
    cellValue(r.steamName),
    cellValue(r.mmr),
    Array.isArray(r.roles) ? r.roles.join("; ") : cellValue(r.roles),
    cellValue(r.discordHandle),
    cellValue(r.phoneNumber),
    cellValue(r.steamProfile),
    cellValue(r.registrationStatus),
    cellValue(r.notes),
  ]);

  const rowCount = values.length;
  const writeEndRow = rowCount > 0 ? start + rowCount - 1 : start - 1;

  try {
    const lastExistingRow = await findLastPopulatedCrmRow(sheetsApi, spreadsheetId, safeTitle, start);
    const clearEndRow = Math.max(writeEndRow, lastExistingRow, start);

    await sheetsApi.spreadsheets.values.clear({
      spreadsheetId,
      range: `'${safeTitle}'!C${start}:K${clearEndRow}`,
    });

    if (rowCount > 0) {
      await sheetsApi.spreadsheets.values.update({
        spreadsheetId,
        range: `'${safeTitle}'!C${start}:K${writeEndRow}`,
        valueInputOption: "RAW",
        resource: { values },
      });
    }

    return {
      ok: true,
      spreadsheetId,
      sheetTitle,
      range: rowCount ? `C${start}:K${writeEndRow}` : `C${start}:K${clearEndRow} (cleared)`,
      rowsWritten: rowCount,
      syncedAt: new Date().toISOString(),
    };
  } catch (err) {
    throw mapGoogleSheetsApiError(err);
  }
}
