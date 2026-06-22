import { useEffect, useState } from "react";
import { CardRendererSkeleton } from "./CardRendererSkeleton.jsx";

function resolveTemplate(manifest) {
  if (!manifest || manifest.cardPending) return "default";
  if (manifest.renderTier === "gold" || manifest.template === "gold") return "gold";
  if (manifest.cardPayload?.template === "gold") return "gold";
  if (manifest.renderTier === "player" || manifest.template === "player") return "player";
  if (manifest.cardPayload?.template === "player") return "player";
  if (manifest.renderTier === "holo" || manifest.template === "holo") return "holo";
  if (manifest.cardPayload?.template === "holo") return "holo";
  if (manifest.renderTier && manifest.renderTier !== "default") return manifest.renderTier;
  return manifest.template || manifest.tier || "default";
}

async function loadTierModule(template) {
  if (template === "gold") {
    await import("./GoldCardStyles.css");
    const mod = await import("./BpclGoldCard.jsx");
    return { kind: "gold", Component: mod.BpclGoldCard };
  }
  if (template === "player") {
    await import("./PlayerCardStyles.css");
    const mod = await import("./BpclPlayerCard.jsx");
    return { kind: "player", Component: mod.BpclPlayerCard };
  }
  if (template === "holo") {
    await import("./HoloCardStyles.css");
    const mod = await import("./BpclHoloCard.jsx");
    return { kind: "holo", Component: mod.BpclHoloCard };
  }
  if (template === "default") {
    await import("./DefaultCardStyles.css");
    const mod = await import("./BpclDefaultCard.jsx");
    return { kind: "default", Component: mod.BpclDefaultCard };
  }
  await import("./CardTierStyles.css");
  const mod = await import("./BpclCard.jsx");
  return { kind: "legacy", Component: mod.BpclCard };
}

function CardPendingNote({ manifest }) {
  if (!manifest?.cardPending) return null;
  return (
    <p className="bpcl-card__pending-banner">
      Your {manifest.tier} card is being prepared — admins will upload it within 48 hours. You&apos;re showing the
      default season card until then.
    </p>
  );
}

function SeasonValidityNote({ manifest }) {
  const validity = manifest?.seasonValidity;
  if (!validity?.badge && !manifest?.seasonBadge) return null;
  const label = validity?.label || (validity?.badge ? `Valid for ${validity.badge}` : null);
  if (!label) return null;
  return <p className="bpcl-card__season-note">{label}</p>;
}

function LazyTierCard({ template, manifest, size, interactive, showAura }) {
  const [loaded, setLoaded] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoaded(null);

    loadTierModule(template)
      .then((mod) => {
        if (!cancelled) setLoaded(mod);
      })
      .catch(() => {
        if (!cancelled) setLoaded(null);
      });

    return () => {
      cancelled = true;
    };
  }, [template]);

  if (!loaded) return <CardRendererSkeleton size={size} />;

  const { kind, Component } = loaded;
  const effectiveTier = manifest.renderTier || manifest.tier || template;

  if (kind === "default") {
    return <Component manifest={manifest} size={size} />;
  }
  if (kind === "holo") {
    return <Component manifest={manifest} size={size} interactive={interactive} showAura={showAura} />;
  }
  if (kind === "legacy") {
    return <Component manifest={{ ...manifest, tier: effectiveTier }} size={size} />;
  }
  return <Component manifest={manifest} size={size} interactive={interactive} />;
}

export function BpclCardRenderer({
  manifest,
  size = "md",
  className = "",
  interactive = true,
  showMeta = true,
  showAura = true,
}) {
  if (!manifest) return null;

  const template = resolveTemplate(manifest);
  const pendingClass = manifest.cardPending ? " bpcl-card--pending" : "";
  const wrapClass = `bpcl-card-renderer${pendingClass}${className ? ` ${className}` : ""}`.trim();

  const card = (
    <LazyTierCard
      template={template}
      manifest={manifest}
      size={size}
      interactive={interactive}
      showAura={showAura}
    />
  );

  if (!showMeta) return card;

  return (
    <div className={wrapClass}>
      {card}
      <CardPendingNote manifest={manifest} />
      <SeasonValidityNote manifest={manifest} />
    </div>
  );
}

export function BpclCardMini({ manifest, className = "", showMeta = false }) {
  return <BpclCardRenderer manifest={manifest} size="sm" className={className} showMeta={showMeta} interactive={false} />;
}
