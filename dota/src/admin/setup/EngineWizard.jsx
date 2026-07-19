import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../../lib/api.js";
import {
  computeGroupSizes,
  groupKeysForCount,
  previewGroupAssignments,
  resolveGroupStageConfig,
  SEEDING_MODES,
} from "../../lib/engineGroupConfig.js";
import { summarizeEngineConfig } from "../../utils/engineTemplateSummary.js";
import {
  buildBlastEngineConfig,
  buildBlastPipelineStages,
  defaultSeriesRuleKeyForStage,
  getSeriesRuleTemplatesForConfig,
  resolveStageSeriesRuleKey,
  seriesRuleOptionsForStage,
  stageUsesSeriesRule,
} from "../../utils/engineStages.js";
import {
  createStageMatch,
  defaultStageElimination,
  listSeedSourceOptions,
  matchIsElimination,
  mergePreservedStageFields,
  normalizeEngineStageSeeding,
  resolveStageMatches,
  stageUsesMatchBuilder,
} from "../../utils/engineStageSeeding.js";
import { getBlastPhaseSizesUi } from "../../constants/tournament.js";

const STAGE_TYPES = [
  ["group_round_robin", "Group round robin"],
  ["last_chance", "Last chance"],
  ["play_in", "Play-in"],
  ["crossover", "Crossover"],
  ["single_elimination", "Single elimination"],
  ["double_elimination", "Double elimination"],
  ["round_robin", "Round robin"],
];

const FORMAT_OPTIONS = [
  ["blast", "BLAST-style (groups + LC + playoffs)"],
  ["dse", "Double elimination"],
  ["se", "Single elimination"],
  ["rr", "Round robin + playoffs"],
  ["gsl", "GSL groups"],
  ["swiss", "Swiss + playoffs"],
  ["hybrid", "Hybrid groups"],
];

const SERIES_KEYS = ["bo1", "bo2", "bo3", "bo5"];
const WIZARD_SECTIONS = [
  { id: "teams", label: "Teams" },
  { id: "groups", label: "Groups & seeding" },
  { id: "stages", label: "Stage pipeline" },
  { id: "series", label: "Series rules" },
];

function emptyConfig(teamCount = 12) {
  return buildBlastEngineConfig(teamCount, "bo3");
}

function syncBlastConfig(config) {
  const teamCount = Number(config.teamCount) || 12;
  if (String(config.format).toLowerCase() !== "blast") return config;
  const stages = buildBlastPipelineStages(teamCount);
  const templates = getSeriesRuleTemplatesForConfig({ ...config, teamCount, format: "blast" });
  const seriesRules = { ...(config.seriesRules || {}) };
  for (const rule of templates) {
    if (seriesRules[rule.key] == null || seriesRules[rule.key] === "") {
      seriesRules[rule.key] = rule.defaultSeries || config.seriesType || "bo3";
    }
  }
  const groupCount = Math.max(2, Math.min(8, Number(config.groupStage?.groupCount) || 2));
  const mergedStages = mergePreservedStageFields(stages, config.stages, config);
  return normalizeEngineStageSeeding(
    syncGroupSizes({
      ...config,
      teamCount,
      stages: mergedStages,
      seriesRules,
      groupStage: {
        ...(config.groupStage || {}),
        enabled: true,
        groupCount,
        balance: config.groupStage?.balance || "equal",
        seedingMode: config.groupStage?.seedingMode || "seed_order",
      },
    }),
  );
}

function normalizeLoadedConfig(raw) {
  const base = { ...emptyConfig(), ...(raw || {}) };
  if (!base.groupStage) {
    const groupStage = (base.stages || []).find((stage) => stage.type === "group_round_robin");
    base.groupStage = {
      enabled: Boolean(groupStage) || base.format === "blast",
      groupCount: groupStage?.groupCount || 2,
      balance: "equal",
      groupSizes: computeGroupSizes(base.teamCount, groupStage?.groupCount || 2),
      seedingMode: groupStage?.seedingMode || "seed_order",
    };
  }
  base.groupStage.groupSizes = computeGroupSizes(
    base.teamCount,
    base.groupStage.groupCount,
    base.groupStage.balance === "custom" ? base.groupStage.groupSizes : null,
  );
  return normalizeEngineStageSeeding(base);
}

function syncGroupSizes(config) {
  const groupCount = Math.max(2, Math.min(8, Number(config.groupStage?.groupCount) || 2));
  const balance = config.groupStage?.balance || "equal";

  if (balance === "custom" && Array.isArray(config.groupStage?.groupSizes)) {
    let sizes = config.groupStage.groupSizes.map((value) => Math.max(0, Number(value) || 0));
    if (sizes.length < groupCount) {
      sizes = [...sizes, ...Array.from({ length: groupCount - sizes.length }, () => 0)];
    } else if (sizes.length > groupCount) {
      sizes = sizes.slice(0, groupCount);
    }
    return {
      ...config,
      groupStage: { ...config.groupStage, groupCount, groupSizes: sizes },
    };
  }

  const sizes = computeGroupSizes(config.teamCount, groupCount, null);
  return {
    ...config,
    groupStage: { ...config.groupStage, groupCount, groupSizes: sizes },
  };
}

export function EngineWizard({ setMessage, onTemplatesChanged, embedded = false }) {
  const [templates, setTemplates] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [templateLabel, setTemplateLabel] = useState("");
  const [templateDescription, setTemplateDescription] = useState("");
  const [section, setSection] = useState("teams");
  const [config, setConfig] = useState(() => emptyConfig());
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const refreshTemplates = useCallback(async () => {
    const payload = await api.getEngineTemplates();
    setTemplates(payload.templates || []);
    onTemplatesChanged?.(payload.templates || []);
    return payload.templates || [];
  }, [onTemplatesChanged]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        await refreshTemplates();
      } catch (error) {
        setMessage?.(error.message);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [refreshTemplates, setMessage]);

  const groupPlan = useMemo(() => resolveGroupStageConfig(config), [config]);
  const summary = useMemo(() => summarizeEngineConfig(config) || "Configure template sections.", [config]);
  const previewSlots = useMemo(
    () => (groupPlan.enabled ? previewGroupAssignments(config.teamCount, config) : []),
    [config, groupPlan.enabled],
  );

  function updateConfig(updater) {
    setConfig((current) => {
      const next = typeof updater === "function" ? updater(current) : updater;
      const withSizes = syncGroupSizes(next);
      const synced =
        String(withSizes.format).toLowerCase() === "blast" ? syncBlastConfig(withSizes) : withSizes;
      return normalizeEngineStageSeeding(synced);
    });
  }

  function updateStageMatches(stageIndex, updater) {
    updateConfig((current) => {
      const stages = [...(current.stages || [])];
      const currentMatches = resolveStageMatches(stages[stageIndex], stageIndex, stages, current);
      stages[stageIndex] = {
        ...stages[stageIndex],
        matches: updater(currentMatches),
      };
      return { ...current, stages };
    });
  }

  function updateStageSeedSlot(stageIndex, matchKey, side, source) {
    updateStageMatches(stageIndex, (matches) =>
      matches.map((match) =>
        match.matchKey === matchKey
          ? {
              ...match,
              slots: match.slots.map((slot) => (slot.side === side ? { ...slot, source } : slot)),
            }
          : match,
      ),
    );
  }

  function startNewTemplate() {
    setSelectedId("");
    setTemplateLabel("");
    setTemplateDescription("");
    setConfig(emptyConfig());
    setSection("teams");
  }

  function loadTemplateRecord(template) {
    if (!template) return;
    setSelectedId(template.id);
    setTemplateLabel(template.label || "");
    setTemplateDescription(template.description || "");
    setConfig(normalizeLoadedConfig(template.config));
    setSection("teams");
  }

  async function loadTemplateById(id) {
    if (!id) {
      startNewTemplate();
      return;
    }
    try {
      const { template } = await api.getEngineTemplate(id);
      loadTemplateRecord(template);
    } catch (error) {
      setMessage?.(error.message);
    }
  }

  async function loadBuiltinPreset(presetId) {
    try {
      const { preset } = await api.getFormatPreset(presetId);
      if (!preset) return;
      if (preset.format === "blast") {
        updateConfig({ ...buildBlastEngineConfig(preset.teamCount, preset.seriesType), presetId: preset.id });
      } else {
        const groupCount = preset.groupCount || 2;
        const groupSizes = computeGroupSizes(preset.teamCount, groupCount);
        updateConfig({
          version: 2,
          presetId: preset.id,
          teamCount: preset.teamCount,
          format: preset.format,
          seriesType: preset.seriesType,
          groupStage: {
            enabled: preset.format === "gsl" || preset.format === "hybrid",
            groupCount,
            balance: "equal",
            groupSizes,
            seedingMode: "seed_order",
          },
          stages: [
            {
              key: "main",
              label: "Main Bracket",
              type: preset.format === "dse" ? "double_elimination" : preset.format === "rr" ? "round_robin" : "single_elimination",
              seriesRuleKey: preset.format === "rr" ? "rr-all" : "upper-r1",
            },
          ],
          seriesRules: preset.seriesRules || config.seriesRules,
        });
      }
      if (!templateLabel.trim()) setTemplateLabel(preset.label || presetId);
      setMessage?.(`Loaded starter ${preset.label}`);
    } catch (error) {
      setMessage?.(error.message);
    }
  }

  async function saveTemplate() {
    const label = templateLabel.trim();
    if (!label) {
      setMessage?.("Template name is required.");
      return;
    }
    setSaving(true);
    try {
      const payload = { label, description: templateDescription.trim(), config: syncGroupSizes(config) };
      const response = selectedId
        ? await api.updateEngineTemplate(selectedId, payload)
        : await api.createEngineTemplate(payload);
      loadTemplateRecord(response.template);
      await refreshTemplates();
      setMessage?.(selectedId ? "Format template updated." : "Format template saved.");
    } catch (error) {
      setMessage?.(error.message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteTemplate() {
    if (!selectedId) return;
    const ok = window.confirm(`Delete template "${templateLabel}"? Tournaments using it will keep their saved config.`);
    if (!ok) return;
    try {
      await api.deleteEngineTemplate(selectedId);
      startNewTemplate();
      await refreshTemplates();
      setMessage?.("Template deleted.");
    } catch (error) {
      setMessage?.(error.message);
    }
  }

  function addStage() {
    const key = `stage_${(config.stages?.length || 0) + 1}`;
    updateConfig((current) => {
      const draft = { key, label: "New stage", type: "single_elimination" };
      if (stageUsesSeriesRule(draft)) {
        draft.seriesRuleKey = defaultSeriesRuleKeyForStage(draft, current);
      }
      return {
        ...current,
        stages: [...(current.stages || []), draft],
      };
    });
  }

  function moveStage(index, direction) {
    updateConfig((current) => {
      const stages = [...(current.stages || [])];
      const next = index + direction;
      if (next < 0 || next >= stages.length) return current;
      [stages[index], stages[next]] = [stages[next], stages[index]];
      return { ...current, stages };
    });
  }

  const content = (
    <div className="engine-wizard engine-wizard--full">
      {!embedded ? <h3 className="admin-section-title">Format engine</h3> : null}
      <p className="engine-wizard__lead">
        Define team count, group seeding, and the full stage pipeline. Setup assigns a template to each tournament; bracket and schedule tabs follow these stages.
      </p>

      <div className="engine-wizard__toolbar">
        <label className="engine-wizard__field">
          <span>Saved templates</span>
          <select className="engine-wizard__select" value={selectedId} disabled={loading} onChange={(event) => void loadTemplateById(event.target.value)}>
            <option value="">New template…</option>
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.label}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="btn btn-outline btn-sm" onClick={startNewTemplate}>
          New
        </button>
      </div>

      <div className="engine-wizard__grid">
        <label className="engine-wizard__field">
          <span>Template name</span>
          <input className="engine-wizard__input" value={templateLabel} onChange={(event) => setTemplateLabel(event.target.value)} placeholder="e.g. BLAST 12 · Standard" />
        </label>
        <label className="engine-wizard__field engine-wizard__field--wide">
          <span>Description</span>
          <input className="engine-wizard__input" value={templateDescription} onChange={(event) => setTemplateDescription(event.target.value)} placeholder="Optional admin note" />
        </label>
      </div>

      <div className="engine-wizard__starters">
        <span className="engine-wizard__starters-label">Quick starters</span>
        <div className="engine-wizard__starters-actions">
          {["BLAST-12", "BLAST-10", "DSE", "SE-8", "RR-6"].map((id) => (
            <button key={id} type="button" className="btn btn-outline btn-sm" onClick={() => void loadBuiltinPreset(id)}>
              {id}
            </button>
          ))}
        </div>
      </div>

      <div className="engine-wizard__sections" role="tablist">
        {WIZARD_SECTIONS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={section === tab.id}
            className={`engine-wizard__section-tab${section === tab.id ? " engine-wizard__section-tab--active" : ""}`}
            onClick={() => setSection(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {section === "teams" ? (
        <div className="engine-wizard__panel">
          <label className="engine-wizard__field">
            <span>Team count</span>
            <input
              type="number"
              min={2}
              max={64}
              className="engine-wizard__input engine-wizard__input--narrow"
              value={config.teamCount}
              onChange={(event) => updateConfig((current) => ({ ...current, teamCount: Number(event.target.value) || 2 }))}
            />
          </label>
          <label className="engine-wizard__field">
            <span>Base format (bracket generator)</span>
            <select
              className="engine-wizard__select"
              value={config.format}
              onChange={(event) => updateConfig((current) => ({ ...current, format: event.target.value }))}
            >
              {FORMAT_OPTIONS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="engine-wizard__field">
            <span>Default series</span>
            <select
              className="engine-wizard__select engine-wizard__select--narrow"
              value={config.seriesType}
              onChange={(event) => updateConfig((current) => ({ ...current, seriesType: event.target.value }))}
            >
              {SERIES_KEYS.map((key) => (
                <option key={key} value={key}>
                  {key.toUpperCase()}
                </option>
              ))}
            </select>
          </label>
          <p className="engine-wizard__hint">
            Tournament mode requires an approved roster with exactly this many teams before bracket generation.
            {config.format === "blast" ? (
              <>
                {" "}
                BLAST supports 10–64 teams (12-team tiered path is the classic layout).
                {getBlastPhaseSizesUi(config.teamCount)?.mainPlayoffPath
                  ? ` Current path: ${getBlastPhaseSizesUi(config.teamCount).mainPlayoffPath.replace(/_/g, " ")}.`
                  : null}
              </>
            ) : null}
          </p>
        </div>
      ) : null}

      {section === "groups" ? (
        <div className="engine-wizard__panel">
          <label className="engine-wizard__checkbox">
            <input
              type="checkbox"
              checked={Boolean(config.groupStage?.enabled)}
              onChange={(event) =>
                updateConfig((current) => ({
                  ...current,
                  groupStage: { ...current.groupStage, enabled: event.target.checked },
                }))
              }
            />
            <span>Enable group stage</span>
          </label>
          {config.groupStage?.enabled ? (
            <>
              <div className="engine-wizard__grid">
                <label className="engine-wizard__field">
                  <span>Number of groups</span>
                  <input
                    type="number"
                    min={2}
                    max={8}
                    className="engine-wizard__input engine-wizard__input--narrow"
                    value={config.groupStage.groupCount}
                    onChange={(event) => {
                      const nextCount = Math.max(2, Math.min(8, Number(event.target.value) || 2));
                      updateConfig((current) => ({
                        ...current,
                        groupStage: {
                          ...current.groupStage,
                          groupCount: nextCount,
                          groupSizes:
                            current.groupStage?.balance === "custom"
                              ? computeGroupSizes(current.teamCount, nextCount)
                              : current.groupStage?.groupSizes,
                        },
                      }));
                    }}
                  />
                </label>
                <label className="engine-wizard__field">
                  <span>Seeding mode</span>
                  <select
                    className="engine-wizard__select"
                    value={config.groupStage.seedingMode}
                    onChange={(event) =>
                      updateConfig((current) => ({
                        ...current,
                        groupStage: { ...current.groupStage, seedingMode: event.target.value },
                      }))
                    }
                  >
                    {SEEDING_MODES.map((mode) => (
                      <option key={mode.id} value={mode.id}>
                        {mode.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="engine-wizard__field">
                  <span>Group balance</span>
                  <select
                    className="engine-wizard__select"
                    value={config.groupStage.balance || "equal"}
                    onChange={(event) =>
                      updateConfig((current) => ({
                        ...current,
                        groupStage: { ...current.groupStage, balance: event.target.value },
                      }))
                    }
                  >
                    <option value="equal">Equal split</option>
                    <option value="custom">Custom sizes</option>
                  </select>
                </label>
              </div>
              {config.groupStage.balance === "custom" ? (
                <div className="engine-wizard__grid engine-wizard__grid--group-sizes">
                  {groupKeysForCount(groupPlan.groupCount).map((key, index) => (
                    <label key={key} className="engine-wizard__field">
                      <span>Group {key} size</span>
                      <input
                        type="number"
                        min={0}
                        max={config.teamCount}
                        className="engine-wizard__input engine-wizard__input--narrow"
                        value={config.groupStage.groupSizes?.[index] ?? groupPlan.groupSizes[index]}
                        onChange={(event) =>
                          updateConfig((current) => {
                            const sizes = [...(current.groupStage.groupSizes || groupPlan.groupSizes)];
                            sizes[index] = Number(event.target.value) || 0;
                            return {
                              ...current,
                              groupStage: { ...current.groupStage, balance: "custom", groupSizes: sizes },
                            };
                          })
                        }
                      />
                    </label>
                  ))}
                </div>
              ) : null}
              {config.groupStage.balance === "custom" ? (
                <p className="engine-wizard__hint">
                  Custom sizes must sum to {config.teamCount} teams (currently{" "}
                  {(config.groupStage.groupSizes || []).reduce((sum, n) => sum + (Number(n) || 0), 0)}).
                </p>
              ) : null}
              <p className="engine-wizard__hint">
                {SEEDING_MODES.find((mode) => mode.id === config.groupStage.seedingMode)?.hint}
                {config.format === "blast" && config.groupStage.groupCount !== 2
                  ? " With more than 2 groups, configure qualifier and playoff match seeding in the Stages section before generating the bracket."
                  : ""}
              </p>
              <div className="engine-wizard__group-preview">
                <p className="engine-wizard__group-preview-title">Group sizes</p>
                <div className="engine-wizard__group-preview-grid">
                  {groupKeysForCount(groupPlan.groupCount).map((key, index) => (
                    <div key={key} className="engine-wizard__group-preview-card">
                      <strong>Group {key}</strong>
                      <span>{groupPlan.groupSizes[index]} teams</span>
                    </div>
                  ))}
                </div>
                {previewSlots.length ? (
                  <p className="engine-wizard__hint">
                    Preview (seed order):{" "}
                    {groupKeysForCount(groupPlan.groupCount)
                      .map((key) => `${key}=${previewSlots.filter((slot) => slot.groupKey === key).length}`)
                      .join(", ")}
                  </p>
                ) : null}
              </div>
            </>
          ) : (
            <p className="engine-wizard__hint">Teams go straight into the stage pipeline with no group assignment step.</p>
          )}
        </div>
      ) : null}

      {section === "stages" ? (
        <div className="engine-wizard__panel">
          <p className="engine-wizard__hint">Order stages top-to-bottom. Bracket and schedule tabs map to these stages (BLAST maps groups → one tab per group).</p>
          <div className="engine-wizard__stages">
            {(config.stages || []).map((stage, idx) => (
              <div key={stage.key} className="engine-wizard__stage-card">
                <div className="engine-wizard__stage-card-head">
                  <strong>Stage {idx + 1}</strong>
                  <div className="engine-wizard__stage-card-actions">
                    <button type="button" className="btn btn-outline btn-xs" disabled={idx === 0} onClick={() => moveStage(idx, -1)}>
                      ↑
                    </button>
                    <button type="button" className="btn btn-outline btn-xs" disabled={idx >= config.stages.length - 1} onClick={() => moveStage(idx, 1)}>
                      ↓
                    </button>
                  </div>
                </div>
                <div className="engine-wizard__stage-row">
                  <input
                    className="engine-wizard__input"
                    value={stage.label || ""}
                    onChange={(event) =>
                      updateConfig((current) => {
                        const stages = [...current.stages];
                        stages[idx] = { ...stages[idx], label: event.target.value };
                        return { ...current, stages };
                      })
                    }
                    placeholder="Display name"
                  />
                  <select
                    className="engine-wizard__select"
                    value={stage.type}
                    onChange={(event) =>
                      updateConfig((current) => {
                        const stages = [...current.stages];
                        const nextStage = { ...stages[idx], type: event.target.value };
                        delete nextStage.matches;
                        delete nextStage.seedPlan;
                        if (stageUsesSeriesRule(nextStage)) {
                          nextStage.seriesRuleKey = defaultSeriesRuleKeyForStage(nextStage, current);
                        } else {
                          delete nextStage.seriesRuleKey;
                        }
                        stages[idx] = nextStage;
                        return { ...current, stages };
                      })
                    }
                  >
                    {STAGE_TYPES.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                {seriesRuleOptionsForStage(stage, config).length > 0 ? (
                  <label className="engine-wizard__stage-series">
                    <span className="engine-wizard__stage-series-label">Primary match format</span>
                    <select
                      className="engine-wizard__select"
                      value={resolveStageSeriesRuleKey(stage, config)}
                      onChange={(event) =>
                        updateConfig((current) => {
                          const stages = [...current.stages];
                          stages[idx] = { ...stages[idx], seriesRuleKey: event.target.value };
                          return { ...current, stages };
                        })
                      }
                    >
                      {seriesRuleOptionsForStage(stage, config).map((rule) => (
                        <option key={rule.key} value={rule.key}>
                          {rule.label} ({String(rule.defaultSeries || config.seriesType || "bo3").toUpperCase()})
                        </option>
                      ))}
                    </select>
                    <span className="engine-wizard__hint">
                      Detailed best-of settings for every phase are in the Series rules tab.
                    </span>
                  </label>
                ) : null}
                {stageUsesMatchBuilder(stage, idx) ? (
                  <div className="engine-wizard__seed-plan">
                    <div className="engine-wizard__seed-plan-head">
                      <span className="engine-wizard__seed-plan-title">Matches in this stage</span>
                      <label className="engine-wizard__elim-toggle">
                        <input
                          type="checkbox"
                          checked={stage.elimination != null ? stage.elimination : defaultStageElimination(stage)}
                          onChange={(event) =>
                            updateConfig((current) => {
                              const stages = [...current.stages];
                              stages[idx] = { ...stages[idx], elimination: event.target.checked };
                              return { ...current, stages };
                            })
                          }
                        />
                        <span>Elimination stage (winners feed later stages)</span>
                      </label>
                    </div>
                    <p className="engine-wizard__hint">
                      {config.teamCount} teams · {groupPlan.groupCount} groups (
                      {groupPlan.groupKeys
                        .map((key, groupIndex) => `${key}=${groupPlan.groupSizes[groupIndex]}`)
                        .join(", ")}
                      ). Add matches and assign group ranks or winners from earlier elimination matches.
                    </p>
                    {resolveStageMatches(stage, idx, config.stages || [], config).map((match, matchIdx) => (
                      <div key={match.matchKey} className="engine-wizard__seed-match">
                        <div className="engine-wizard__seed-match-head">
                          <input
                            className="engine-wizard__input engine-wizard__input--compact"
                            value={match.label || ""}
                            placeholder={`Match ${matchIdx + 1}`}
                            onChange={(event) =>
                              updateStageMatches(idx, (matches) =>
                                matches.map((row) =>
                                  row.matchKey === match.matchKey ? { ...row, label: event.target.value } : row,
                                ),
                              )
                            }
                          />
                          <label className="engine-wizard__elim-toggle engine-wizard__elim-toggle--inline">
                            <input
                              type="checkbox"
                              checked={matchIsElimination(stage, match)}
                              onChange={(event) =>
                                updateStageMatches(idx, (matches) =>
                                  matches.map((row) =>
                                    row.matchKey === match.matchKey
                                      ? { ...row, elimination: event.target.checked }
                                      : row,
                                  ),
                                )
                              }
                            />
                            <span>Elimination</span>
                          </label>
                          <label className="engine-wizard__field engine-wizard__field--inline">
                            <span>Round (0 = first)</span>
                            <input
                              type="number"
                              min={0}
                              max={8}
                              className="engine-wizard__input engine-wizard__input--narrow"
                              value={match.roundIndex ?? 0}
                              onChange={(event) =>
                                updateStageMatches(idx, (matches) =>
                                  matches.map((row) =>
                                    row.matchKey === match.matchKey
                                      ? { ...row, roundIndex: Number(event.target.value) || 0 }
                                      : row,
                                  ),
                                )
                              }
                            />
                          </label>
                          <button
                            type="button"
                            className="btn btn-outline btn-xs"
                            disabled={resolveStageMatches(stage, idx, config.stages || [], config).length <= 1}
                            onClick={() =>
                              updateStageMatches(idx, (matches) =>
                                matches.filter((row) => row.matchKey !== match.matchKey),
                              )
                            }
                          >
                            Remove
                          </button>
                        </div>
                        <div className="engine-wizard__seed-match-slots">
                          {match.slots.map((slot) => (
                            <label key={`${match.matchKey}-${slot.side}`} className="engine-wizard__seed-slot">
                              <span>{slot.side === 1 ? "Team 1" : "Team 2"}</span>
                              <select
                                className="engine-wizard__select"
                                value={slot.source}
                                onChange={(event) =>
                                  updateStageSeedSlot(idx, match.matchKey, slot.side, event.target.value)
                                }
                              >
                                {listSeedSourceOptions(idx, matchIdx, config.stages || [], config).map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={() =>
                        updateStageMatches(idx, (matches) => [
                          ...matches,
                          createStageMatch(idx, config.stages || [], config),
                        ])
                      }
                    >
                      Add match
                    </button>
                  </div>
                ) : null}
              </div>
            ))}
            <button type="button" className="btn btn-outline btn-sm" onClick={addStage}>
              Add stage
            </button>
          </div>
        </div>
      ) : null}

      {section === "series" ? (
        <div className="engine-wizard__panel">
          <p className="engine-wizard__hint">
            Best-of settings for each bracket phase. These map directly to match series keys used by the generator.
          </p>
          <div className="engine-wizard__series-grid">
            {getSeriesRuleTemplatesForConfig(config).map((rule) => (
              <label key={rule.key} className="engine-wizard__series-row">
                <span>{rule.label}</span>
                <select
                  className="engine-wizard__select engine-wizard__select--narrow"
                  value={config.seriesRules?.[rule.key] || rule.defaultSeries || config.seriesType}
                  onChange={(event) =>
                    updateConfig((current) => ({
                      ...current,
                      seriesRules: { ...current.seriesRules, [rule.key]: event.target.value },
                    }))
                  }
                >
                  {SERIES_KEYS.map((key) => (
                    <option key={key} value={key}>
                      {key.toUpperCase()}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        </div>
      ) : null}

      <pre className="engine-wizard__summary">{summary}</pre>

      <div className="engine-wizard__actions">
        <button type="button" className="btn btn-primary btn-sm" disabled={saving} onClick={() => void saveTemplate()}>
          {saving ? "Saving…" : selectedId ? "Update template" : "Save template"}
        </button>
        {selectedId ? (
          <button type="button" className="btn btn-destructive-outline btn-sm" onClick={() => void deleteTemplate()}>
            Delete
          </button>
        ) : null}
      </div>
    </div>
  );

  return content;
}
