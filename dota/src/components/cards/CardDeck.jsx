import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { BpclCardRenderer } from "./BpclCardRenderer.jsx";
import { useBodyScrollLock } from "../../hooks/useBodyScrollLock.js";
import { isGoldTierFx, isHoloTierFx, premiumCardGlowClass } from "../../utils/cardTierEffects.js";
import { deckBadgeInlineStyle, hasDeckBadgeTheme, parseTournamentDeckTheme } from "../../utils/tournamentDeckTheme.js";
import "./CardDeckStyles.css";

function seasonBadgeLabel(entry) {
  if (entry.seasonNumber != null) return `S${entry.seasonNumber}`;
  const manifest = entry.manifest || {};
  const badge = manifest.seasonBadge || manifest.seasonValidity?.badge;
  if (badge) {
    const short = String(badge).match(/^S\d+/i);
    if (short) return short[0].toUpperCase();
  }
  if (entry.seasonSlug) {
    const slugMatch = String(entry.seasonSlug).match(/^s(\d+)$/i);
    if (slugMatch) return `S${slugMatch[1]}`;
  }
  if (entry.seasonName) return entry.seasonName;
  return "Season";
}

function resolveEntryTier(entry) {
  return entry.tier || entry.manifest?.tier || entry.manifest?.renderTier || "default";
}

function vaultManifest(manifest) {
  if (!manifest) return null;
  const tier = manifest.tier || manifest.renderTier || "default";
  return {
    ...manifest,
    tier,
    renderTier: tier,
    cardPending: false,
    frozenSnapshot: true,
    seasonValidity: {
      ...(manifest.seasonValidity || {}),
      collectionOnly: true,
      active: false,
    },
  };
}

function tileAccentClass(tier) {
  if (isHoloTierFx(tier)) return "card-deck__tile--holo";
  if (isGoldTierFx(tier)) return "card-deck__tile--gold";
  if (tier === "player") return "card-deck__tile--player";
  return "card-deck__tile--default";
}

function deckAccentClass(collection) {
  const tiers = collection.map(resolveEntryTier);
  if (tiers.some(isHoloTierFx)) return "card-deck--accent-holo";
  if (tiers.some(isGoldTierFx)) return "card-deck--accent-gold";
  return "";
}

function surfaceClass(tier) {
  if (isHoloTierFx(tier)) return "card-deck--surface-holo";
  if (isGoldTierFx(tier)) return "card-deck--surface-gold";
  return "card-deck--surface-default";
}

function resolveDeckBadgeTheme(entry) {
  return parseTournamentDeckTheme(
    entry.deckBadgeTheme ||
      entry.manifest?.tournamentPresentation?.deckBadgeTheme ||
      entry.manifest?.deckBadgeTheme,
  );
}

function DeckTile({ entry, onSelect }) {
  const manifest = vaultManifest(entry.manifest);
  if (!manifest) return null;

  const tier = resolveEntryTier(entry);
  const glowClass = premiumCardGlowClass(tier);
  const badgeTheme = resolveDeckBadgeTheme(entry);
  const badgeStyle = deckBadgeInlineStyle(badgeTheme);
  const badgeClassName = `card-deck__season-badge${hasDeckBadgeTheme(badgeTheme) ? " card-deck__season-badge--themed" : ""}`;

  return (
    <button
      type="button"
      className={`card-deck__tile ${tileAccentClass(tier)}`}
      onClick={() => onSelect({ ...entry, manifest })}
      aria-label={`${seasonBadgeLabel(entry)} card`}
    >
      <span className={badgeClassName} style={badgeStyle}>{seasonBadgeLabel(entry)}</span>
      <div className="card-deck__tile-card">
        {glowClass ? (
          <div className={glowClass}>
            <BpclCardRenderer manifest={manifest} size="sm" interactive={false} showMeta={false} showAura={false} />
          </div>
        ) : (
          <BpclCardRenderer manifest={manifest} size="sm" interactive={false} showMeta={false} showAura={false} />
        )}
      </div>
    </button>
  );
}

function DeckLightbox({ entry, onClose }) {
  useBodyScrollLock(Boolean(entry));

  useEffect(() => {
    if (!entry) return undefined;
    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [entry, onClose]);

  if (!entry?.manifest) return null;

  const tier = resolveEntryTier(entry);
  const manifest = vaultManifest(entry.manifest);
  const badgeTheme = resolveDeckBadgeTheme(entry);
  const badgeStyle = deckBadgeInlineStyle(badgeTheme);

  return createPortal(
    <div
      className={`card-deck__lightbox ${tileAccentClass(tier).replace("__tile", "__lightbox")}`}
      role="dialog"
      aria-modal="true"
      aria-label="Card deck"
      onClick={onClose}
    >
      <button type="button" className="card-deck__lightbox-close" onClick={onClose} aria-label="Close">
        ×
      </button>
      <div className="card-deck__lightbox-inner" onClick={(event) => event.stopPropagation()}>
        <span
          className={`card-deck__season-badge card-deck__season-badge--lightbox${hasDeckBadgeTheme(badgeTheme) ? " card-deck__season-badge--themed" : ""}`}
          style={badgeStyle}
        >
          {seasonBadgeLabel(entry)}
        </span>
        <BpclCardRenderer manifest={manifest} size="xl" interactive={false} showMeta={false} showAura={isHoloTierFx(tier)} />
      </div>
    </div>,
    document.body,
  );
}

function DeckHeader({ title, description }) {
  return (
    <header className="card-deck__header">
      <h2 className="card-deck__title">{title}</h2>
      {description ? <p className="card-deck__description">{description}</p> : null}
    </header>
  );
}

export function CardDeck({
  deck,
  loading = false,
  className = "",
  title = "Card Deck",
  description = "Your cards from finished seasons are saved here.",
  surfaceTier = "default",
  hideWhenEmpty = false,
}) {
  const [selectedEntry, setSelectedEntry] = useState(null);
  const collection = deck?.collection || [];
  const accentClass = useMemo(() => deckAccentClass(collection), [collection]);
  const surfaceTierClass = surfaceClass(surfaceTier);
  const sectionClass = `card-deck ${accentClass} ${surfaceTierClass}${className ? ` ${className}` : ""}`.trim();

  if (loading) {
    if (hideWhenEmpty) return null;
    return (
      <section className={`${sectionClass} card-deck--loading`}>
        <DeckHeader title={title} description={description} />
      </section>
    );
  }

  if (!collection.length) {
    if (hideWhenEmpty) return null;
    return (
      <section className={sectionClass}>
        <DeckHeader title={title} description={description} />
      </section>
    );
  }

  return (
    <section className={sectionClass}>
      <DeckHeader title={title} description={description} />
      <div className="card-deck__grid">
        {collection.map((entry) => (
          <DeckTile
            key={entry.seasonId || entry.seasonSlug || entry.snapshotAt}
            entry={entry}
            onSelect={setSelectedEntry}
          />
        ))}
      </div>
      <DeckLightbox entry={selectedEntry} onClose={() => setSelectedEntry(null)} />
    </section>
  );
}
