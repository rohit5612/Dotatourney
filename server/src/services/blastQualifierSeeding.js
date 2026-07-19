import { pool } from "../db/pool.js";
import { resolveGroupStageConfig } from "./engineGroupConfig.js";

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

/** @param {string} slotKey */
export function parseBlastGroupSlotLetter(slotKey) {
  const match = String(slotKey || "").match(/^Group ([A-H]) #\d+$/i);
  return match ? match[1].toUpperCase() : null;
}

/** @param {string} slotKey */
export function isGlobalBlastQualifierSlot(slotKey) {
  return /^(BLR[1-4]|MID\d+|BLC\d+)$/i.test(String(slotKey || "").trim());
}

/** Keep only per-group rank overrides (Group A #1, etc.). */
export function stripGroupStandingsOverrides(overrides) {
  /** @type {Record<string, string>} */
  const out = {};
  for (const [key, value] of Object.entries(overrides || {})) {
    if (!parseBlastGroupSlotLetter(key)) continue;
    const team = String(value || "").trim();
    if (team) out[key] = team;
  }
  return out;
}

/**
 * Group rank slots configured by the tournament engine (Group A #1 … Group H #n).
 * @param {object | null | undefined} engineConfig
 */
export function listBlastGroupSlotKeys(engineConfig) {
  const plan = resolveGroupStageConfig(engineConfig || {});
  /** @type {string[]} */
  const keys = [];
  for (let index = 0; index < plan.groupKeys.length; index += 1) {
    const letter = plan.groupKeys[index];
    const size = plan.groupSizes[index] || 0;
    for (let rank = 1; rank <= size; rank += 1) {
      keys.push(`Group ${letter} #${rank}`);
    }
  }
  return keys;
}

/** @deprecated Use listBlastGroupSlotKeys(engineConfig) */
export function listBlastQualifierSlotKeys(_teamCount, engineConfig = null) {
  return listBlastGroupSlotKeys(engineConfig);
}

/**
 * @param {object | null | undefined} engineConfig
 * @param {string[]} completedGroupLetters
 */
export function listEditableQualifierSlotKeys(engineConfig, completedGroupLetters) {
  return listBlastGroupSlotKeys(engineConfig).filter((key) => {
    const letter = parseBlastGroupSlotLetter(key);
    return letter && completedGroupLetters.includes(letter);
  });
}

/**
 * @param {Record<string, string> | null} baseMap
 * @param {Record<string, string>} overrides
 */
export function mergeQualifierSeedingOverrides(baseMap, overrides) {
  const base = baseMap || {};
  if (!overrides || !Object.keys(overrides).length) {
    return Object.keys(base).length ? base : null;
  }
  const merged = { ...base, ...overrides };
  return Object.keys(merged).length ? merged : null;
}

/**
 * @param {Record<string, string>} overrides
 * @param {{ name: string }[]} teams
 * @param {string[]} slotKeys
 */
export function validateQualifierSeedingOverrides(overrides, teams, slotKeys, editableSlotKeys = null) {
  const teamNames = new Set((teams || []).map((team) => String(team.name || "").trim()).filter(Boolean));
  const allowedKeys = editableSlotKeys || slotKeys;
  const usedTeams = new Set();
  const errors = [];

  for (const [slot, team] of Object.entries(overrides || {})) {
    if (!allowedKeys.includes(slot)) {
      errors.push(`Slot ${slot} is not editable yet`);
      continue;
    }
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
