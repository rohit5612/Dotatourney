/** Per-tournament Google Sheets CRM sync prefs (browser localStorage). */

const sheetIdKey = (tournamentId) => `bpcl-google-sheet-id:${tournamentId}`;
const sheetTabKey = (tournamentId) => `bpcl-google-sheet-tab:${tournamentId}`;
const legacySheetIdKey = (tournamentId) => `bpcl-google-sheet:${tournamentId}`;

export const CRM_SHEET_COLUMN_HINT =
  "C name · D Steam name · E MMR · F roles · G Discord · H phone · I Steam profile link · J status · K notes";

/** Extract spreadsheet ID from a raw ID or full Google Sheets URL. */
export function parseSpreadsheetId(input) {
  const raw = String(input || "").trim();
  if (!raw) return "";
  const fromUrl = raw.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/) || raw.match(/\/d\/([a-zA-Z0-9-_]+)/);
  if (fromUrl?.[1]) return fromUrl[1];
  return raw;
}

export function getGoogleSheetPrefs(tournamentId) {
  if (!tournamentId) return { spreadsheetId: "", sheetTabName: "" };
  try {
    let spreadsheetId = window.localStorage.getItem(sheetIdKey(tournamentId))?.trim() || "";
    if (!spreadsheetId) {
      const legacy = window.localStorage.getItem(legacySheetIdKey(tournamentId))?.trim() || "";
      if (legacy) {
        spreadsheetId = parseSpreadsheetId(legacy);
        window.localStorage.setItem(sheetIdKey(tournamentId), spreadsheetId);
      }
    }
    const sheetTabName = window.localStorage.getItem(sheetTabKey(tournamentId))?.trim() || "";
    return { spreadsheetId, sheetTabName };
  } catch {
    return { spreadsheetId: "", sheetTabName: "" };
  }
}

export function setGoogleSheetPrefs(tournamentId, { spreadsheetId = "", sheetTabName = "" } = {}) {
  if (!tournamentId) return;
  try {
    window.localStorage.setItem(sheetIdKey(tournamentId), parseSpreadsheetId(spreadsheetId));
    window.localStorage.setItem(sheetTabKey(tournamentId), String(sheetTabName || "").trim());
  } catch {
    // Ignore storage write errors.
  }
}

export function buildCrmSheetSyncConfirmMessage({ rowCount, sheetTabName }) {
  const tabHint = sheetTabName ? `the “${sheetTabName}” tab` : "the first worksheet tab";
  const endRow = rowCount > 0 ? 4 + rowCount : 5;
  const rangeHint = rowCount > 0 ? `C5:K${endRow}` : "the existing C5:K… block";
  return (
    `Sync ${rowCount} registration row(s) to Google Sheets?\n\n` +
    `${tabHint} will be cleared for ${rangeHint}, then filled from row 5:\n` +
    CRM_SHEET_COLUMN_HINT
  );
}
