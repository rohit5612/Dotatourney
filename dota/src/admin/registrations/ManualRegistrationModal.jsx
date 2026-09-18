import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { api } from "../../lib/api.js";
import { useBodyScrollLock } from "../../hooks/useBodyScrollLock.js";

const CARD_TIERS = [
  { id: "default", label: "Default (no card bundle)" },
  { id: "player", label: "Player card" },
  { id: "gold", label: "Gold card" },
  { id: "holo", label: "Holo card" },
];

function tierLabelFromCommerce(commerce, tierId) {
  if (!tierId || tierId === "default") return "Default (no card bundle)";
  const tierConfig = commerce?.cardTiers?.[tierId];
  if (tierConfig?.label) return tierConfig.label;
  const fallback = CARD_TIERS.find((t) => t.id === tierId);
  return fallback?.label || tierId;
}

export function ManualRegistrationModal({ open, onClose, onSuccess, defaultTournamentId }) {
  useBodyScrollLock(open);

  const [seasons, setSeasons] = useState([]);
  const [seasonId, setSeasonId] = useState("");
  const [commerce, setCommerce] = useState(null);
  const [playerSearch, setPlayerSearch] = useState("");
  const [playerResults, setPlayerResults] = useState([]);
  const [playerLoading, setPlayerLoading] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [cardTier, setCardTier] = useState("default");
  const [amountRupees, setAmountRupees] = useState("");
  const [offlinePaymentAccount, setOfflinePaymentAccount] = useState("");
  const [superadminPassword, setSuperadminPassword] = useState("");
  const [step, setStep] = useState("form");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const selectedSeason = useMemo(
    () => seasons.find((s) => s.id === seasonId) || null,
    [seasons, seasonId],
  );
  const tournamentId = selectedSeason?.tournamentId || defaultTournamentId || "";

  const resetForm = useCallback(() => {
    setPlayerSearch("");
    setPlayerResults([]);
    setSelectedPlayer(null);
    setCardTier("default");
    setAmountRupees("");
    setOfflinePaymentAccount("");
    setSuperadminPassword("");
    setStep("form");
    setError("");
  }, []);

  useEffect(() => {
    if (!open) {
      resetForm();
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { seasons: list } = await api.getAdminSeasons();
        if (cancelled) return;
        const sorted = [...(list || [])].sort((a, b) => (b.number || 0) - (a.number || 0));
        setSeasons(sorted);
        const active = sorted.find((s) => s.status === "active") || sorted[0];
        if (active) setSeasonId(active.id);
        else if (defaultTournamentId) {
          const match = sorted.find((s) => s.tournamentId === defaultTournamentId);
          if (match) setSeasonId(match.id);
        }
      } catch (err) {
        if (!cancelled) setError(err.message || "Could not load seasons");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, defaultTournamentId, resetForm]);

  useEffect(() => {
    if (!open || !tournamentId) {
      setCommerce(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const data = await api.getTournamentCommerce(tournamentId);
        if (!cancelled) setCommerce(data?.commerce || data);
      } catch {
        if (!cancelled) setCommerce(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, tournamentId]);

  useEffect(() => {
    if (!open) return undefined;
    function onKey(event) {
      if (event.key === "Escape" && !busy) onClose?.();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, onClose]);

  useEffect(() => {
    if (!open || !playerSearch.trim() || playerSearch.trim().length < 2) {
      setPlayerResults([]);
      return;
    }
    const handle = window.setTimeout(async () => {
      setPlayerLoading(true);
      try {
        const data = await api.listPlayerAccounts({ search: playerSearch.trim(), limit: 20 });
        setPlayerResults(data.accounts || []);
      } catch {
        setPlayerResults([]);
      } finally {
        setPlayerLoading(false);
      }
    }, 300);
    return () => window.clearTimeout(handle);
  }, [open, playerSearch]);

  async function submitManualRegistration() {
    if (!selectedPlayer?.id || !tournamentId) return;
    setBusy(true);
    setError("");
    try {
      const amount = Number(amountRupees);
      if (!Number.isFinite(amount) || amount < 0) {
        throw new Error("Enter a valid amount received offline");
      }
      if (!offlinePaymentAccount.trim()) {
        throw new Error("Enter the account number or UPI ID used for payment");
      }
      if (!superadminPassword) {
        throw new Error("Superadmin password is required");
      }
      const result = await api.createManualRegistration(tournamentId, {
        seasonId: seasonId || undefined,
        playerAccountId: selectedPlayer.id,
        cardTier,
        amountRupees: amount,
        offlinePaymentAccount: offlinePaymentAccount.trim(),
        superadminPassword,
      });
      onSuccess?.(result);
      onClose?.();
    } catch (err) {
      setError(err.message || "Manual registration failed");
    } finally {
      setBusy(false);
    }
  }

  function goToPasswordStep() {
    setError("");
    if (!selectedPlayer) {
      setError("Select a player account");
      return;
    }
    if (!tournamentId) {
      setError("Select a season with a linked tournament");
      return;
    }
    const amount = Number(amountRupees);
    if (!Number.isFinite(amount) || amount < 0) {
      setError("Enter a valid amount received offline");
      return;
    }
    if (!offlinePaymentAccount.trim()) {
      setError("Enter account number or UPI ID for tracking");
      return;
    }
    setStep("password");
  }

  if (!open) return null;

  const tierOptions = CARD_TIERS.map((tier) => ({
    ...tier,
    label: tier.id === "default" ? tier.label : tierLabelFromCommerce(commerce, tier.id) || tier.label,
  }));

  return createPortal(
    <div className="user-mgmt-modal" role="presentation">
      <button type="button" className="user-mgmt-modal__backdrop" aria-label="Close" onClick={onClose} disabled={busy} />
      <div
        className="user-mgmt-modal__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="manual-reg-title"
        style={{ maxWidth: "32rem" }}
      >
        <h3 id="manual-reg-title" className="user-mgmt-modal__title">Manual registration</h3>
        <p className="user-mgmt-modal__lead text-sm text-muted-foreground">
          Register a player without checkout. Bypasses registration cap and open/closed state. Superadmin only.
        </p>

        {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}

        {step === "form" ? (
          <div className="mt-4 space-y-4">
            <label className="block space-y-1 text-sm">
              <span className="text-muted-foreground">Season</span>
              <select
                className="w-full rounded-md border border-input bg-background p-2"
                value={seasonId}
                onChange={(e) => setSeasonId(e.target.value)}
              >
                {seasons.map((season) => (
                  <option key={season.id} value={season.id}>
                    {season.name || `Season ${season.number}`} ({season.status})
                  </option>
                ))}
              </select>
            </label>

            <div className="space-y-1 text-sm">
              <span className="text-muted-foreground">Player account</span>
              {selectedPlayer ? (
                <div className="flex items-center justify-between gap-2 rounded-md border border-border p-2">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{selectedPlayer.displayName || selectedPlayer.email}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {selectedPlayer.bpcId || "—"} · {selectedPlayer.email}
                    </p>
                  </div>
                  <button type="button" className="btn btn-outline btn-sm shrink-0" onClick={() => setSelectedPlayer(null)}>
                    Change
                  </button>
                </div>
              ) : (
                <>
                  <input
                    className="w-full rounded-md border border-input bg-background p-2"
                    placeholder="Search by email, BPC ID, or name"
                    value={playerSearch}
                    onChange={(e) => setPlayerSearch(e.target.value)}
                  />
                  {playerLoading ? <p className="text-xs text-muted-foreground">Searching…</p> : null}
                  {playerResults.length > 0 ? (
                    <ul className="max-h-40 overflow-y-auto rounded-md border border-border">
                      {playerResults.map((account) => (
                        <li key={account.id}>
                          <button
                            type="button"
                            className="w-full px-3 py-2 text-left text-sm hover:bg-muted/50"
                            onClick={() => {
                              setSelectedPlayer(account);
                              setPlayerSearch("");
                              setPlayerResults([]);
                            }}
                          >
                            <span className="font-medium">{account.displayName || account.email}</span>
                            <span className="block text-xs text-muted-foreground">
                              {account.bpcId || "—"} · {account.email}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </>
              )}
            </div>

            <label className="block space-y-1 text-sm">
              <span className="text-muted-foreground">Registration card tier</span>
              <select
                className="w-full rounded-md border border-input bg-background p-2"
                value={cardTier}
                onChange={(e) => setCardTier(e.target.value)}
              >
                {tierOptions.map((tier) => (
                  <option key={tier.id} value={tier.id}>{tier.label}</option>
                ))}
              </select>
            </label>

            <label className="block space-y-1 text-sm">
              <span className="text-muted-foreground">Amount received offline (₹)</span>
              <input
                type="number"
                min="0"
                step="1"
                className="w-full rounded-md border border-input bg-background p-2"
                value={amountRupees}
                onChange={(e) => setAmountRupees(e.target.value)}
                placeholder="0"
              />
            </label>

            <label className="block space-y-1 text-sm">
              <span className="text-muted-foreground">Account number / UPI ID (tracking only)</span>
              <input
                className="w-full rounded-md border border-input bg-background p-2"
                value={offlinePaymentAccount}
                onChange={(e) => setOfflinePaymentAccount(e.target.value)}
                placeholder="e.g. player@upi or bank account ref"
              />
            </label>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            <p className="text-sm text-muted-foreground">
              Confirm manual registration for{" "}
              <strong className="text-foreground">{selectedPlayer?.displayName || selectedPlayer?.email}</strong>
              {" "}— {selectedSeason?.name || "season"} · ₹{amountRupees} · {tierLabelFromCommerce(commerce, cardTier)}
            </p>
            <label className="block space-y-1 text-sm">
              <span className="text-muted-foreground">Superadmin password</span>
              <input
                type="password"
                autoComplete="current-password"
                className="w-full rounded-md border border-input bg-background p-2"
                value={superadminPassword}
                onChange={(e) => setSuperadminPassword(e.target.value)}
              />
            </label>
          </div>
        )}

        <div className="user-mgmt-modal__actions mt-6">
          <button type="button" className="btn btn-outline" disabled={busy} onClick={step === "password" ? () => setStep("form") : onClose}>
            {step === "password" ? "Back" : "Cancel"}
          </button>
          {step === "form" ? (
            <button type="button" className="btn btn-primary" onClick={goToPasswordStep}>
              Continue
            </button>
          ) : (
            <button type="button" className="btn btn-primary" disabled={busy} onClick={submitManualRegistration}>
              {busy ? "Registering…" : "Register player"}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
