import { useEffect, useRef, useState } from "react";
import { api } from "../../lib/api.js";
import { AdminGlassPanel } from "../components/AdminGlassPanel.jsx";
import { BpclCardRenderer, BpclCardMini } from "../../components/cards/BpclCardRenderer.jsx";
import { readPortraitUploadFile, isHostedPortraitGifUrl } from "../../utils/readPortraitUploadFile.js";
import { resolveAccountAvatarUrl } from "../../utils/resolvePlayerAvatar.js";
import { PortraitGifPickerModal } from "./PortraitGifPickerModal.jsx";
import "../../components/cards/CardTierStyles.css";
import "../../styles/player-crm.css";

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function LinkBadge({ linked, label }) {
  return (
    <span className={`player-crm__badge${linked ? " player-crm__badge--ok" : ""}`}>
      {label} {linked ? "✓" : "—"}
    </span>
  );
}

function DetailField({ label, value, mono = false }) {
  if (value == null || value === "") return null;
  return (
    <div className="player-crm__field">
      <span className="player-crm__field-label">{label}</span>
      <span className={`player-crm__field-value${mono ? " font-mono text-xs" : ""}`}>{value}</span>
    </div>
  );
}

function PlayerAccountDetailModal({
  detail,
  loading,
  adminNotes,
  onAdminNotesChange,
  onClose,
  onSaveNotes,
  savingNotes,
  coinDelta,
  coinReason,
  onCoinDeltaChange,
  onCoinReasonChange,
  onGrantCoins,
  grantingCoins,
  cardJson,
  cardTierUpload,
  applyProfileTier,
  onCardJsonChange,
  onCardTierUploadChange,
  onApplyProfileTierChange,
  onUploadCard,
  uploadingCard,
  onCardPortraitFileSelect,
  onOpenGifPicker,
  cardPortraitBusy,
  avatarUrlDraft,
  onAvatarUrlDraftChange,
  onAvatarFileSelect,
  avatarUploadBusy,
  onSaveAvatar,
  onClearAvatar,
  savingAvatar,
  canWrite = true,
}) {
  const account = detail?.account;
  const accountAvatar = resolveAccountAvatarUrl(account);
  const avatarPreview = avatarUrlDraft || accountAvatar;
  const avatarSource = avatarUrlDraft || account?.avatarUrl ? "custom" : account?.steamAvatarUrl ? "steam" : "none";
  let cardPortraitUrl = "";
  if (cardJson.trim()) {
    try {
      cardPortraitUrl = String(JSON.parse(cardJson).avatarUrl || "").trim();
    } catch {
      cardPortraitUrl = "";
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="player-crm-modal-title">
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Close dialog" onClick={onClose} />
      <div className="player-crm__modal relative z-10 flex max-h-[92dvh] w-full max-w-4xl flex-col overflow-hidden rounded-t-2xl border border-border bg-card shadow-2xl sm:rounded-2xl">
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-border/60 px-4 py-4 sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            {accountAvatar ? (
              <img src={accountAvatar} alt="" className="player-crm__modal-avatar" />
            ) : (
              <div className="player-crm__modal-avatar player-crm__modal-avatar--fallback" aria-hidden="true">
                {(account?.displayName || "?")[0]}
              </div>
            )}
            <div className="min-w-0">
              <h3 id="player-crm-modal-title" className="truncate font-serif text-xl">
                {loading ? "Loading…" : account?.displayName || account?.email || "Player account"}
              </h3>
              {account ? (
                <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                  {account.bpcId} · /player/{account.slug}
                </p>
              ) : null}
            </div>
          </div>
          <button type="button" className="btn btn-outline btn-sm shrink-0" onClick={onClose}>
            Close
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading account details…</p>
          ) : account ? (
            <div className="player-crm__modal-grid">
              <section className="player-crm__modal-section">
                <h4 className="player-crm__section-title">Account</h4>
                <div className="player-crm__avatar-override">
                  <div className="player-crm__avatar-override-preview-wrap">
                    {avatarPreview ? (
                      <img src={avatarPreview} alt="" className="player-crm__avatar-override-preview" />
                    ) : (
                      <div className="player-crm__avatar-override-preview player-crm__avatar-override-preview--empty" aria-hidden="true">
                        {(account?.displayName || "?")[0]}
                      </div>
                    )}
                    <span className="player-crm__avatar-override-source">
                      {avatarSource === "custom" ? "Custom override" : avatarSource === "steam" ? "Steam avatar" : "No avatar"}
                    </span>
                  </div>
                  <div className="player-crm__avatar-override-form">
                    <label className="player-crm__field-label" htmlFor="player-crm-avatar-url">
                      Custom avatar URL
                    </label>
                    <input
                      id="player-crm-avatar-url"
                      className="player-crm__avatar-url-input"
                      type="url"
                      placeholder="https://… or upload an image / GIF"
                      value={avatarUrlDraft}
                      disabled={!canWrite || avatarUploadBusy}
                      onChange={(event) => onAvatarUrlDraftChange(event.target.value)}
                    />
                    <div className="player-crm__avatar-override-actions">
                      <label className="btn btn-outline btn-sm player-crm__avatar-upload-btn">
                        {avatarUploadBusy ? "Processing…" : "Upload image or GIF"}
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp,image/gif"
                          className="sr-only"
                          disabled={!canWrite || avatarUploadBusy}
                          onChange={(event) => {
                            const file = event.target.files?.[0];
                            if (file) onAvatarFileSelect(file);
                            event.target.value = "";
                          }}
                        />
                      </label>
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        disabled={!canWrite || avatarUploadBusy}
                        onClick={() => onOpenGifPicker("avatar")}
                      >
                        {isHostedPortraitGifUrl(avatarUrlDraft) ? "Change hosted GIF" : "Choose hosted GIF"}
                      </button>
                      {avatarUrlDraft || account?.avatarUrl ? (
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          disabled={!canWrite || savingAvatar || avatarUploadBusy}
                          onClick={onClearAvatar}
                        >
                          Clear custom
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        disabled={!canWrite || savingAvatar || avatarUploadBusy}
                        onClick={onSaveAvatar}
                      >
                        {savingAvatar ? "Saving…" : "Save avatar"}
                      </button>
                    </div>
                    <p className="player-crm__avatar-override-hint">
                      Custom avatar overrides Steam on player cards and public profile. Use{" "}
                      <strong>Choose hosted GIF</strong> to pick from{" "}
                      <code className="text-[0.7rem]">/cards/gifs</code> (faster than inline data URLs).
                      Static images can use inline upload; very large GIFs should be hosted.
                    </p>
                  </div>
                </div>
                <div className="player-crm__field-grid mt-4">
                  <DetailField label="Email" value={account.email} />
                  <DetailField label="Phone" value={account.phoneNumber} />
                  <DetailField label="BPC ID" value={account.bpcId} mono />
                  <DetailField label="Slug" value={account.slug} mono />
                  <DetailField label="Created" value={formatDate(account.createdAt)} />
                  <DetailField label="Updated" value={formatDate(account.updatedAt)} />
                  <DetailField label="Profile completed" value={formatDate(account.profileCompletedAt)} />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <LinkBadge linked={account.emailVerified} label="Email" />
                  <LinkBadge linked={Boolean(account.steamId)} label="Steam" />
                  <LinkBadge linked={Boolean(account.discordId)} label="Discord" />
                  <LinkBadge linked={account.googleLinked} label="Google" />
                  <LinkBadge linked={account.hasPassword} label="Password" />
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <a className="btn btn-outline btn-sm" href={`/player/${account.slug}`} target="_blank" rel="noreferrer">
                    Public profile
                  </a>
                  {account.steamProfile ? (
                    <a className="btn btn-outline btn-sm" href={account.steamProfile} target="_blank" rel="noreferrer">
                      Steam
                    </a>
                  ) : null}
                </div>
              </section>

              <section className="player-crm__modal-section player-crm__modal-section--card">
                <h4 className="player-crm__section-title">Player card</h4>
                <div className="player-crm__card-layout">
                  {detail.card ? (
                    <div className="player-crm__card-preview">
                      <BpclCardMini manifest={detail.card} />
                      {detail.card.cardPending ? (
                        <p className="player-crm__card-pending" title="Admins will upload the custom card within 48 hours">
                          <span className="player-crm__card-pending-dot" aria-hidden="true" />
                          {detail.card.tier} card pending upload
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                  <div className="player-crm__card-meta">
                    <div className="player-crm__field-grid player-crm__field-grid--card">
                      <DetailField label="Purchased tier" value={detail.card?.purchasedTier || detail.card?.tier || "default"} />
                      <DetailField label="Profile tier" value={detail.card?.tier || "default"} />
                      <DetailField
                        label="Admin override"
                        value={detail.card?.tierOverride || detail.account?.cardTierOverride || null}
                      />
                      <DetailField label="Rendered as" value={detail.card?.renderTier || detail.card?.tier || "default"} />
                      <DetailField
                        label="Season"
                        value={detail.card?.seasonValidity?.label || detail.card?.seasonBadge || null}
                      />
                      <DetailField
                        label="Asset status"
                        value={detail.card?.assetStatus || (detail.card?.cardPending ? "pending upload" : "default")}
                      />
                      <DetailField label="Display name" value={account.displayName} />
                      <DetailField label="MMR" value={account.mmr != null ? String(account.mmr) : null} />
                    </div>
                  </div>
                </div>
                {detail.cardAssets?.length ? (
                  <ul className="player-crm__list player-crm__list--rows mt-3">
                    {detail.cardAssets.map((asset) => (
                      <li key={asset.id}>
                        <span className="capitalize">{asset.tier}</span>
                        <span className="text-muted-foreground">
                          {asset.status}
                          {asset.approvedAt ? ` · approved ${formatDate(asset.approvedAt)}` : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : null}
                <div className="mt-4 space-y-2">
                  <p className="text-xs text-muted-foreground">
                    Paste JSON from the offline card builder. Choose any tier — it does not have to match what the
                    player purchased. Uploading sets their profile card and premium status to the selected tier.
                    {cardTierUpload === "holo" ? (
                      <>
                        {" "}
                        Holo cards support animated GIF portraits — use{" "}
                        <strong>Choose hosted GIF</strong> or embed{" "}
                        <code className="text-[0.7rem]">avatarUrl</code> in JSON.
                      </>
                    ) : null}
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="text-xs text-muted-foreground" htmlFor="player-crm-card-tier">
                      Card tier
                    </label>
                    <select
                      id="player-crm-card-tier"
                      className="rounded border border-input bg-background p-2 text-sm"
                      value={cardTierUpload}
                      disabled={!canWrite}
                      onChange={(event) => onCardTierUploadChange(event.target.value)}
                    >
                      <option value="gold">Gold</option>
                      <option value="player">Player</option>
                      <option value="holo">Holo</option>
                    </select>
                    <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={applyProfileTier}
                        disabled={!canWrite}
                        onChange={(event) => onApplyProfileTierChange(event.target.checked)}
                      />
                      Apply tier to profile &amp; community
                    </label>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      disabled={!canWrite || uploadingCard || !cardJson.trim()}
                      onClick={onUploadCard}
                    >
                      {uploadingCard ? "Uploading…" : "Upload card JSON"}
                    </button>
                    {cardTierUpload === "holo" ? (
                      <>
                        <label className="btn btn-outline btn-sm">
                          {cardPortraitBusy ? "Processing…" : "Add portrait to JSON"}
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp,image/gif"
                            className="sr-only"
                            disabled={!canWrite || cardPortraitBusy || uploadingCard}
                            onChange={(event) => {
                              const file = event.target.files?.[0];
                              if (file) onCardPortraitFileSelect(file);
                              event.target.value = "";
                            }}
                          />
                        </label>
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          disabled={!canWrite || cardPortraitBusy || uploadingCard}
                          onClick={() => onOpenGifPicker("cardJson")}
                        >
                          {isHostedPortraitGifUrl(cardPortraitUrl) ? "Change hosted GIF" : "Choose hosted GIF"}
                        </button>
                      </>
                    ) : null}
                  </div>
                  <textarea
                    className="min-h-32 w-full rounded-md border border-input bg-background p-3 font-mono text-xs"
                    placeholder='{"version":1,"template":"player","playerName":"...","avatarUrl":"...","stats":{...}}'
                    value={cardJson}
                    disabled={!canWrite}
                    onChange={(event) => onCardJsonChange(event.target.value)}
                  />
                </div>
              </section>

              {(account.bio ||
                account.achievements?.length ||
                account.steamPersona ||
                account.discordUsername ||
                account.preferredRoles?.length ||
                account.location) ? (
                <section className="player-crm__modal-section">
                  <h4 className="player-crm__section-title">Profile</h4>
                  {account.bio ? (
                    <div className="player-crm__bio">
                      <span className="player-crm__field-label">Bio</span>
                      <p>{account.bio}</p>
                    </div>
                  ) : null}
                  {account.achievements?.length ? (
                    <div className={account.bio ? "mt-3" : ""}>
                      <span className="player-crm__field-label">Achievements</span>
                      <ul className="player-crm__list">
                        {account.achievements.map((item, index) => (
                          <li key={item.id || index}>{typeof item === "string" ? item : item.title || item.label}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  <div className="player-crm__field-grid mt-3">
                    <DetailField label="Steam persona" value={account.steamPersona} />
                    <DetailField label="Discord" value={account.discordUsername} />
                    <DetailField
                      label="Roles"
                      value={account.preferredRoles?.length ? account.preferredRoles.join(", ") : null}
                    />
                    <DetailField label="Location" value={account.location} />
                  </div>
                </section>
              ) : null}

              {detail.profile?.currentTeam?.team ? (
                <section className="player-crm__modal-section">
                  <h4 className="player-crm__section-title">Current team</h4>
                  <p className="text-sm">
                    <strong>{detail.profile.currentTeam.team.name}</strong>
                    {detail.profile.currentTeam.player?.role ? ` · ${detail.profile.currentTeam.player.role}` : ""}
                  </p>
                </section>
              ) : null}

              <section className="player-crm__modal-section">
                <h4 className="player-crm__section-title">Registrations ({detail.registrations?.length || 0})</h4>
                {detail.registrations?.length ? (
                  <ul className="player-crm__list player-crm__list--rows">
                    {detail.registrations.map((registration) => (
                      <li key={registration.id}>
                        <span>{registration.tournamentName}</span>
                        <span className="text-muted-foreground">
                          {registration.registrationStatus} / {registration.paymentStatus}
                          {registration.substituteFlag ? " · sub" : ""}
                          {registration.cardTier ? ` · ${registration.cardTier}` : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">No active registrations.</p>
                )}
              </section>

              {detail.profile?.seasonHistory?.length ? (
                <section className="player-crm__modal-section">
                  <h4 className="player-crm__section-title">Season history</h4>
                  <ul className="player-crm__list player-crm__list--rows">
                    {detail.profile.seasonHistory.map((entry) => (
                      <li key={`${entry.seasonSlug}-${entry.seasonNumber}`}>
                        <span>{entry.seasonName || `Season ${entry.seasonNumber}`}</span>
                        <span className="text-muted-foreground">
                          {[entry.teamName, entry.placement ? `#${entry.placement}` : null, entry.role]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              {detail.profile?.teamHistory?.length ? (
                <section className="player-crm__modal-section">
                  <h4 className="player-crm__section-title">Tournament teams</h4>
                  <ul className="player-crm__list player-crm__list--rows">
                    {detail.profile.teamHistory.map((entry) => (
                      <li key={entry.rosterSnapshotId}>
                        <span>{entry.teamName}</span>
                        <span className="text-muted-foreground">{entry.tournamentName}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              <section className="player-crm__modal-section">
                <h4 className="player-crm__section-title">BPC coins</h4>
                <p className="text-sm">
                  Balance: <strong>{detail.coinBalance ?? 0}</strong>
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <input
                    type="number"
                    className="w-28 rounded border border-input bg-background p-2 text-sm"
                    placeholder="± coins"
                    value={coinDelta}
                    disabled={!canWrite}
                    onChange={(event) => onCoinDeltaChange(event.target.value)}
                  />
                  <input
                    className="min-w-[12rem] flex-1 rounded border border-input bg-background p-2 text-sm"
                    value={coinReason}
                    disabled={!canWrite}
                    onChange={(event) => onCoinReasonChange(event.target.value)}
                  />
                  <button type="button" className="btn btn-primary btn-sm" disabled={!canWrite || grantingCoins || !coinDelta} onClick={onGrantCoins}>
                    {grantingCoins ? "Granting…" : "Grant"}
                  </button>
                </div>
                {detail.ledger?.length ? (
                  <ul className="player-crm__list player-crm__list--rows mt-3">
                    {detail.ledger.slice(0, 8).map((entry) => (
                      <li key={entry.id}>
                        <span className={entry.delta >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}>
                          {entry.delta >= 0 ? "+" : ""}
                          {entry.delta}
                        </span>
                        <span className="text-muted-foreground">
                          {entry.reason} · bal {entry.balanceAfter} · {formatDate(entry.createdAt)}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </section>

              <section className="player-crm__modal-section player-crm__modal-section--notes">
                <h4 className="player-crm__section-title">Admin notes</h4>
                <p className="mb-2 text-xs text-muted-foreground">Internal only — not shown on the public profile.</p>
                <textarea
                  className="min-h-28 w-full rounded-md border border-input bg-background p-3 text-sm"
                  placeholder="Payment follow-ups, verification flags, support context…"
                  value={adminNotes}
                  disabled={!canWrite}
                  onChange={(event) => onAdminNotesChange(event.target.value)}
                />
                <div className="mt-3 flex justify-end">
                  <button type="button" className="btn btn-primary btn-sm" disabled={!canWrite || savingNotes} onClick={onSaveNotes}>
                    {savingNotes ? "Saving…" : "Save notes"}
                  </button>
                </div>
              </section>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Could not load this account.</p>
          )}
        </div>
      </div>
    </div>
  );
}

export function PlayerAccountsCrmPage({ setMessage, canWrite = true }) {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [accounts, setAccounts] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [loadingList, setLoadingList] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [adminNotes, setAdminNotes] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [coinDelta, setCoinDelta] = useState("");
  const [coinReason, setCoinReason] = useState("Admin grant");
  const [grantingCoins, setGrantingCoins] = useState(false);
  const [cardJson, setCardJson] = useState("");
  const [cardTierUpload, setCardTierUpload] = useState("gold");
  const [applyProfileTier, setApplyProfileTier] = useState(true);
  const [uploadingCard, setUploadingCard] = useState(false);
  const [avatarUrlDraft, setAvatarUrlDraft] = useState("");
  const [savingAvatar, setSavingAvatar] = useState(false);
  const [avatarUploadBusy, setAvatarUploadBusy] = useState(false);
  const [cardPortraitBusy, setCardPortraitBusy] = useState(false);
  const [gifPickerTarget, setGifPickerTarget] = useState(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, pageSize]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageStart = total === 0 ? 0 : (currentPage - 1) * pageSize;
  const pageEnd = Math.min(pageStart + accounts.length, total);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  async function loadList(pageOverride = currentPage) {
    setLoadingList(true);
    try {
      const safePage = Math.max(1, pageOverride);
      const data = await api.listPlayerAccounts({
        search: debouncedSearch,
        limit: pageSize,
        offset: (safePage - 1) * pageSize,
      });
      setAccounts(data.accounts || []);
      setTotal(data.total || 0);
    } catch (error) {
      setMessage?.(error.message);
    } finally {
      setLoadingList(false);
    }
  }

  useEffect(() => {
    loadList(page).catch(() => {});
  }, [debouncedSearch, page, pageSize]);

  async function openDetail(id) {
    setSelectedId(id);
    setLoadingDetail(true);
    setDetail(null);
    setCoinDelta("");
    try {
      const data = await api.getPlayerAccount(id);
      setDetail(data);
      setAdminNotes(data.account?.adminNotes || "");
      setAvatarUrlDraft(data.account?.avatarUrl || "");
      const preferredTier =
        data.card?.tierOverride ||
        data.account?.cardTierOverride ||
        data.card?.purchasedTier ||
        data.registrations?.find((r) => r.cardTier && r.cardTier !== "default")?.cardTier ||
        "gold";
      setCardTierUpload(["player", "gold", "holo"].includes(preferredTier) ? preferredTier : "gold");
      setApplyProfileTier(true);
    } catch (error) {
      setMessage?.(error.message);
      setSelectedId(null);
    } finally {
      setLoadingDetail(false);
    }
  }

  function closeDetail() {
    setSelectedId(null);
    setDetail(null);
    setAdminNotes("");
    setCoinDelta("");
    setCardJson("");
    setCardTierUpload("gold");
    setAvatarUrlDraft("");
  }

  async function saveAdminNotes() {
    if (!selectedId) return;
    setSavingNotes(true);
    try {
      await api.patchPlayerAccount(selectedId, { adminNotes });
      setMessage?.("Admin notes saved.");
      const data = await api.getPlayerAccount(selectedId);
      setDetail(data);
      setAdminNotes(data.account?.adminNotes || "");
      await loadList();
    } catch (error) {
      setMessage?.(error.message);
    } finally {
      setSavingNotes(false);
    }
  }

  async function grantCoins() {
    if (!selectedId || !coinDelta) return;
    setGrantingCoins(true);
    try {
      await api.grantPlayerCoins(selectedId, { delta: Number(coinDelta), reason: coinReason });
      setMessage?.("Coins updated.");
      const data = await api.getPlayerAccount(selectedId);
      setDetail(data);
      setCoinDelta("");
    } catch (error) {
      setMessage?.(error.message);
    } finally {
      setGrantingCoins(false);
    }
  }

  async function uploadCardJson() {
    if (!selectedId || !cardJson.trim()) return;
    setUploadingCard(true);
    try {
      const manifestJson = JSON.parse(cardJson);
      await api.uploadPlayerCard(selectedId, {
        tier: cardTierUpload,
        manifestJson,
        approve: true,
        applyProfileTier,
      });
      const data = await api.getPlayerAccount(selectedId);
      setDetail(data);
      setMessage?.(
        applyProfileTier
          ? `Player card uploaded as ${cardTierUpload} — profile tier updated.`
          : "Player card uploaded (profile tier unchanged).",
      );
    } catch (error) {
      setMessage?.(error.message || "Could not upload card JSON.");
    } finally {
      setUploadingCard(false);
    }
  }

  function openGifPicker(target) {
    setGifPickerTarget(target);
  }

  function closeGifPicker() {
    setGifPickerTarget(null);
  }

  function resolveGifPickerSelectedUrl() {
    if (gifPickerTarget === "avatar") return avatarUrlDraft;
    if (gifPickerTarget === "cardJson") {
      if (!cardJson.trim()) return "";
      try {
        return String(JSON.parse(cardJson).avatarUrl || "").trim();
      } catch {
        return "";
      }
    }
    return "";
  }

  function handleGifPickerSelect(url) {
    if (gifPickerTarget === "avatar") {
      setAvatarUrlDraft(url);
      setMessage?.("Hosted GIF selected. Click Save avatar to apply.");
    } else if (gifPickerTarget === "cardJson") {
      let manifest = {};
      if (cardJson.trim()) {
        manifest = JSON.parse(cardJson);
      }
      manifest.version = manifest.version || 1;
      manifest.template = manifest.template || cardTierUpload;
      manifest.avatarUrl = url;
      if (!manifest.playerName && detail?.account?.displayName) {
        manifest.playerName = detail.account.displayName;
      }
      setCardJson(JSON.stringify(manifest, null, 2));
      setMessage?.("Hosted GIF selected in card JSON — review and upload when ready.");
    }
    closeGifPicker();
  }

  async function handleCardPortraitFileSelect(file) {
    setCardPortraitBusy(true);
    try {
      const dataUrl = await readPortraitUploadFile(file, { maxEdge: 512, quality: 0.88 });
      let manifest = {};
      if (cardJson.trim()) {
        manifest = JSON.parse(cardJson);
      }
      manifest.version = manifest.version || 1;
      manifest.template = manifest.template || cardTierUpload;
      manifest.avatarUrl = dataUrl;
      if (!manifest.playerName && detail?.account?.displayName) {
        manifest.playerName = detail.account.displayName;
      }
      setCardJson(JSON.stringify(manifest, null, 2));
      setMessage?.("Portrait embedded in card JSON — review and upload when ready.");
    } catch (error) {
      setMessage?.(error.message || "Could not add portrait to card JSON.");
    } finally {
      setCardPortraitBusy(false);
    }
  }

  async function handleAvatarFileSelect(file) {
    setAvatarUploadBusy(true);
    try {
      const dataUrl = await readPortraitUploadFile(file, { maxEdge: 512, quality: 0.88 });
      setAvatarUrlDraft(dataUrl);
    } catch (error) {
      setMessage?.(error.message || "Could not process image.");
    } finally {
      setAvatarUploadBusy(false);
    }
  }

  async function saveAvatarOverride() {
    if (!selectedId) return;
    setSavingAvatar(true);
    try {
      await api.patchPlayerAccount(selectedId, { avatarUrl: avatarUrlDraft });
      const data = await api.getPlayerAccount(selectedId);
      setDetail(data);
      setAvatarUrlDraft(data.account?.avatarUrl || "");
      setMessage?.("Avatar saved.");
      await loadList();
    } catch (error) {
      setMessage?.(error.message || "Could not save avatar.");
    } finally {
      setSavingAvatar(false);
    }
  }

  async function clearAvatarOverride() {
    if (!selectedId) return;
    setSavingAvatar(true);
    try {
      await api.patchPlayerAccount(selectedId, { avatarUrl: "" });
      setAvatarUrlDraft("");
      const data = await api.getPlayerAccount(selectedId);
      setDetail(data);
      setMessage?.("Custom avatar cleared.");
      await loadList();
    } catch (error) {
      setMessage?.(error.message || "Could not clear avatar.");
    } finally {
      setSavingAvatar(false);
    }
  }

  return (
    <div className="admin-page-stack player-crm">
      <AdminGlassPanel>
        <h2 className="admin-section-title">Player accounts</h2>
        <p className="mb-3 text-sm text-muted-foreground">
          Global BPC accounts — search, open a profile view, and keep internal admin notes.
        </p>
        <input
          className="w-full max-w-md rounded border border-input bg-background/80 p-2 text-sm"
          placeholder="Search email, BPC ID, name, slug…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <p className="mt-2 text-xs text-muted-foreground">
          {loadingList
            ? "Loading…"
            : `Showing ${total ? pageStart + 1 : 0}-${pageEnd} of ${total} account${total === 1 ? "" : "s"}`}
        </p>

        <div className="player-crm__table-wrap mt-4">
          <table className="player-crm__table">
            <thead>
              <tr>
                <th>BPC ID</th>
                <th>Player</th>
                <th>Email</th>
                <th>Links</th>
                <th>MMR</th>
                <th>Regs</th>
                <th>Joined</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {accounts.map((account) => (
                <tr key={account.id}>
                  <td className="font-mono text-xs">{account.bpcId}</td>
                  <td>
                    <div className="player-crm__name-cell">
                      {(account.avatarUrl || account.steamAvatarUrl) ? (
                        <img src={resolveAccountAvatarUrl(account)} alt="" className="player-crm__row-avatar" />
                      ) : null}
                      <span>{account.displayName || "—"}</span>
                    </div>
                  </td>
                  <td className="max-w-[12rem] truncate text-xs">{account.email}</td>
                  <td>
                    <div className="player-crm__mini-badges">
                      <span className={account.emailVerified ? "is-on" : ""}>E</span>
                      <span className={account.steamId ? "is-on" : ""}>S</span>
                      <span className={account.discordId ? "is-on" : ""}>D</span>
                    </div>
                  </td>
                  <td>{account.mmr ?? "—"}</td>
                  <td>{account.registrationCount ?? 0}</td>
                  <td className="text-xs text-muted-foreground">{formatDate(account.createdAt).split(",")[0]}</td>
                  <td>
                    <button type="button" className="btn btn-outline btn-sm" onClick={() => openDetail(account.id)}>
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loadingList && !accounts.length ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No accounts match your search.</p>
          ) : null}
        </div>
      </AdminGlassPanel>

      <AdminGlassPanel subtle className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <div className="text-muted-foreground">
          {loadingList
            ? "Loading accounts…"
            : `Showing ${total ? pageStart + 1 : 0}-${pageEnd} of ${total} accounts`}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-muted-foreground">
            Per page
            <select
              className="rounded-md border border-input bg-background p-2 text-foreground"
              value={pageSize}
              onChange={(event) => setPageSize(Number(event.target.value))}
            >
              {PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => setPage(1)} disabled={currentPage === 1 || loadingList}>
            First
          </button>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            disabled={currentPage === 1 || loadingList}
          >
            Previous
          </button>
          <span className="rounded-md border border-border px-3 py-2 text-muted-foreground">
            Page {currentPage} of {totalPages}
          </span>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
            disabled={currentPage === totalPages || loadingList}
          >
            Next
          </button>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => setPage(totalPages)}
            disabled={currentPage === totalPages || loadingList}
          >
            Last
          </button>
        </div>
      </AdminGlassPanel>

      {selectedId ? (
        <PlayerAccountDetailModal
          detail={detail}
          loading={loadingDetail}
          adminNotes={adminNotes}
          onAdminNotesChange={setAdminNotes}
          onClose={closeDetail}
          onSaveNotes={saveAdminNotes}
          savingNotes={savingNotes}
          coinDelta={coinDelta}
          coinReason={coinReason}
          onCoinDeltaChange={setCoinDelta}
          onCoinReasonChange={setCoinReason}
          onGrantCoins={grantCoins}
          grantingCoins={grantingCoins}
          cardJson={cardJson}
          cardTierUpload={cardTierUpload}
          applyProfileTier={applyProfileTier}
          onCardJsonChange={setCardJson}
          onCardTierUploadChange={setCardTierUpload}
          onApplyProfileTierChange={setApplyProfileTier}
          onUploadCard={uploadCardJson}
          uploadingCard={uploadingCard}
          onCardPortraitFileSelect={handleCardPortraitFileSelect}
          onOpenGifPicker={openGifPicker}
          cardPortraitBusy={cardPortraitBusy}
          avatarUrlDraft={avatarUrlDraft}
          onAvatarUrlDraftChange={setAvatarUrlDraft}
          onAvatarFileSelect={handleAvatarFileSelect}
          avatarUploadBusy={avatarUploadBusy}
          onSaveAvatar={saveAvatarOverride}
          onClearAvatar={clearAvatarOverride}
          savingAvatar={savingAvatar}
          canWrite={canWrite}
        />
      ) : null}

      <PortraitGifPickerModal
        open={Boolean(gifPickerTarget)}
        onClose={closeGifPicker}
        title={
          gifPickerTarget === "cardJson"
            ? `Choose holo portrait GIF${detail?.account?.displayName ? ` for ${detail.account.displayName}` : ""}`
            : `Choose avatar GIF${detail?.account?.displayName ? ` for ${detail.account.displayName}` : ""}`
        }
        selectedUrl={resolveGifPickerSelectedUrl()}
        onSelect={handleGifPickerSelect}
        canWrite={canWrite}
      />
    </div>
  );
}
