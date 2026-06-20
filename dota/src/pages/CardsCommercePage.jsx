import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { AdminGlassPanel } from "../admin/components/AdminGlassPanel.jsx";
import { bundleTotalForTier } from "../utils/commerceBundle.js";

const TIER_KEYS = ["default", "player", "gold", "holo"];

export function CardsCommercePage({ tournamentId, message, setMessage }) {
  const [commerce, setCommerce] = useState(null);
  const [assets, setAssets] = useState([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!tournamentId) return;
    api.getTournamentCommerce(tournamentId).then((r) => setCommerce(r.commerce));
    api.getTournamentCardAssets(tournamentId).then((r) => setAssets(r.assets || []));
  }, [tournamentId]);

  function updateTier(tierKey, field, value) {
    setCommerce((c) => ({
      ...c,
      cardTiers: {
        ...c.cardTiers,
        [tierKey]: { ...c.cardTiers[tierKey], [field]: value },
      },
    }));
  }

  async function save() {
    if (!tournamentId || !commerce) return;
    setBusy(true);
    setMessage("");
    try {
      const r = await api.putTournamentCommerce(tournamentId, {
        registrationFeeRupees: commerce.registrationFeeRupees,
        minCashRupees: commerce.minCashRupees,
        cardTiers: commerce.cardTiers,
      });
      setCommerce(r.commerce);
      setMessage("Commerce settings saved.");
    } catch (err) {
      setMessage(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function reviewAsset(id, status) {
    setBusy(true);
    try {
      await api.patchCardAsset(id, { status });
      const r = await api.getTournamentCardAssets(tournamentId);
      setAssets(r.assets || []);
      setMessage(`Asset ${status}.`);
    } catch (err) {
      setMessage(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (!tournamentId) {
    return (
      <AdminGlassPanel>
        <p className="text-muted-foreground">Select a tournament first.</p>
      </AdminGlassPanel>
    );
  }
  if (!commerce) {
    return (
      <AdminGlassPanel>
        <p className="text-muted-foreground">Loading commerce config…</p>
      </AdminGlassPanel>
    );
  }

  const standardReg = commerce.registrationFeeRupees ?? 300;

  return (
    <div className="admin-page-stack">
    <AdminGlassPanel className="space-y-8">
      <section>
        <h2 className="admin-section-title">Registration & card pricing</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Set standard registration fee and per-bundle registration + card costs. Bundle total = registration cost + card cost.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 max-w-lg">
          <label className="text-sm">
            Standard registration fee (₹)
            <input
              type="number"
              className="mt-1 w-full rounded-md border border-input bg-background p-2"
              value={commerce.registrationFeeRupees}
              onChange={(e) =>
                setCommerce((c) => ({ ...c, registrationFeeRupees: Number(e.target.value) }))
              }
            />
          </label>
          <label className="text-sm">
            Min cash after coins (₹)
            <input
              type="number"
              className="mt-1 w-full rounded-md border border-input bg-background p-2"
              value={commerce.minCashRupees}
              onChange={(e) => setCommerce((c) => ({ ...c, minCashRupees: Number(e.target.value) }))}
            />
          </label>
        </div>

        <div className="mt-6 space-y-4">
          {TIER_KEYS.map((key) => {
            const tier = commerce.cardTiers?.[key] || {};
            const bundleTotal =
              tier.bundleTotalRupees ??
              bundleTotalForTier(tier, key, standardReg);
            return (
              <div key={key} className="rounded-lg border border-border p-4">
                <div className="flex flex-wrap items-center gap-3 justify-between">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={tier.enabled !== false}
                      onChange={(e) => updateTier(key, "enabled", e.target.checked)}
                    />
                    <span className="font-semibold capitalize">{key}</span>
                  </div>
                  <span className="text-sm font-semibold text-accent">Bundle total: ₹{bundleTotal}</span>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <label className="text-sm">
                    Registration cost (₹)
                    <input
                      type="number"
                      className="mt-1 w-full rounded-md border border-input bg-background p-2"
                      value={tier.registrationCostRupees ?? 0}
                      onChange={(e) => updateTier(key, "registrationCostRupees", Number(e.target.value))}
                    />
                  </label>
                  <label className="text-sm">
                    Card cost (₹)
                    <input
                      type="number"
                      className="mt-1 w-full rounded-md border border-input bg-background p-2"
                      value={tier.cardCostRupees ?? 0}
                      onChange={(e) => updateTier(key, "cardCostRupees", Number(e.target.value))}
                    />
                  </label>
                  <label className="text-sm">
                    Discount badge (%)
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={0.01}
                      className="mt-1 w-full rounded-md border border-input bg-background p-2"
                      value={tier.discountPercent ?? 0}
                      onChange={(e) =>
                        updateTier(key, "discountPercent", e.target.value === "" ? 0 : parseFloat(e.target.value))
                      }
                    />
                  </label>
                  <label className="text-sm">
                    Label
                    <input
                      className="mt-1 w-full rounded-md border border-input bg-background p-2"
                      value={tier.label || ""}
                      onChange={(e) => updateTier(key, "label", e.target.value)}
                    />
                  </label>
                  <label className="text-sm sm:col-span-2 lg:col-span-4">
                    Subtext
                    <input
                      className="mt-1 w-full rounded-md border border-input bg-background p-2"
                      value={tier.description || ""}
                      onChange={(e) => updateTier(key, "description", e.target.value)}
                    />
                  </label>
                </div>
              </div>
            );
          })}
        </div>
        <button type="button" className="btn btn-primary mt-4" onClick={save} disabled={busy}>
          Save pricing
        </button>
      </section>

      <section>
        <h2 className="font-serif text-xl">Card asset approval queue</h2>
        {assets.length ? (
          <ul className="mt-4 space-y-3">
            {assets.map((a) => (
              <li key={a.id} className="rounded-lg border border-border p-3 flex flex-wrap gap-3 items-center justify-between">
                <div>
                  <p className="font-semibold">{a.displayName} · {a.bpcId}</p>
                  <p className="text-sm text-muted-foreground">{a.tier} · {a.tagline || "No tagline"}</p>
                </div>
                <div className="flex gap-2">
                  <button type="button" className="btn btn-primary btn-sm" onClick={() => reviewAsset(a.id, "approved")}>
                    Approve
                  </button>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => reviewAsset(a.id, "rejected")}>
                    Reject
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground mt-2">No pending card assets.</p>
        )}
      </section>
      {message ? <p className="text-sm">{message}</p> : null}
    </AdminGlassPanel>
    </div>
  );
}
