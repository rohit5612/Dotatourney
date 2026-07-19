import { pool } from "../db/pool.js";
import { getBlastPhaseSizes } from "./formatGenerator.js";

/** @param {object | null | undefined} engineConfig */
export function getQualifierSeedingOverrides(engineConfig) {
  const raw = engineConfig?.qualifierSeedingOverrides;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  /** @type {Record<string, string>} */
  const out = {};
  for (const [key, value] of Object.entries(raw)) {
    const team = String(value || "").trim();
    if (team) out[String(key).trim()] = team;
  }
  return out;
}

/** @param {number} teamCount */
export function listBlastQualifierSlotKeys(teamCount) {
  const sizes = getBlastPhaseSizes(teamCount);
  if (!sizes) return [];

  /** @type {string[]} */
  const keys = [];
  const groupA = Math.ceil(teamCount / 2);
  const groupB = Math.floor(teamCount / 2);
  for (let rank = 1; rank <= groupA; rank += 1) keys.push(`Group A #${rank}`);
  for (let rank = 1; rank <= groupB; rank += 1) keys.push(`Group B #${rank}`);

  if (sizes.mainPlayoffPath === "ten_qf_seconds") return keys;
  if (sizes.mainPlayoffPath === "tiered_merged_standings" && teamCount === 12) return keys;

  if (sizes.mainPlayoffPath === "tiered_merged_standings") {
    keys.push("BLR1", "BLR2", "BLR3", "BLR4");
    const mid = sizes.middleBracketEntrants ?? 0;
    for (let i = 1; i <= mid; i += 1) keys.push(`MID${i}`);
    const lc = sizes.lcEntrants ?? 0;
    for (let j = 1; j <= lc; j += 1) keys.push(`BLC${j}`);
  }
  return keys;
}

/**
 * @param {Record<string, string> | null} baseMap
 * @param {Record<string, string>} overrides
 */
export function mergeQualifierSeedingOverrides(baseMap, overrides) {
  if (!baseMap) return null;
  if (!overrides || !Object.keys(overrides).length) return baseMap;
  return { ...baseMap, ...overrides };
}

/**
 * @param {Record<string, string>} overrides
 * @param {{ name: string }[]} teams
 * @param {string[]} slotKeys
 */
export function validateQualifierSeedingOverrides(overrides, teams, slotKeys) {
  const teamNames = new Set((teams || []).map((team) => String(team.name || "").trim()).filter(Boolean));
  const usedTeams = new Set();
  const errors = [];

  for (const [slot, team] of Object.entries(overrides || {})) {
    if (!slotKeys.includes(slot)) {
      errors.push(`Unknown slot: ${slot}`);
      continue;
    }
    if (!teamNames.has(team)) {
      errors.push(`${slot}: team "${team}" is not on the roster`);
      continue;
    }
    if (usedTeams.has(team)) {
      errors.push(`Team "${team}" is assigned to more than one slot`);
    }
    usedTeams.add(team);
  }

  return errors.length ? errors.join("; ") : null;
}

/**
 * Keep only overrides that differ from the auto map; drop empty values.
 * @param {Record<string, string> | null} autoMap
 * @param {Record<string, string>} draftOverrides
 */
export function normalizeQualifierSeedingOverrides(autoMap, draftOverrides) {
  /** @type {Record<string, string>} */
  const next = {};
  for (const [slot, team] of Object.entries(draftOverrides || {})) {
    const trimmed = String(team || "").trim();
    if (!trimmed) continue;
    if (autoMap && autoMap[slot] === trimmed) continue;
    next[slot] = trimmed;
  }
  return next;
}

export async function saveQualifierSeedingOverrides(tournamentId, overrides) {
  const { rows } = await pool.query(
    `UPDATE tournaments
     SET engine_config = jsonb_set(
       COALESCE(engine_config, '{}'::jsonb),
       '{qualifierSeedingOverrides}',
       $2::jsonb,
       true
     ),
     updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [tournamentId, JSON.stringify(overrides || {})],
  );
  return rows[0] || null;
}
