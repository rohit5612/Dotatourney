import {
  PLAYER_RULES_DISCORD_SECTION_TITLE,
  PLAYER_RULES_REGISTRATION_NOTICE,
  PLAYER_RULES_SECTIONS,
} from "../constants/playerRules.js";
import { SITE_BRAND_FULL, SITE_BRAND_SHORT } from "../constants/siteMeta.js";

export const RULEBOOK_DOWNLOAD_FILENAME = "BPC-League-Season-3-Rulebook.html";

function escapeHtml(text) {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Self-contained offline rulebook page (matches /rules content, Season 3 edition).
 */
export function buildRulebookDownloadHtml({ discordUrl = "" } = {}) {
  const invite = String(discordUrl || "").trim();
  const sectionsHtml = PLAYER_RULES_SECTIONS.map(([title, body], index) => {
    const discordExtra =
      title === PLAYER_RULES_DISCORD_SECTION_TITLE && invite
        ? `<p class="note"><a href="${escapeHtml(invite)}">Join the Discord server</a> — required for pairings, announcements, and admin messages during the event.</p>`
        : "";
    return `<section class="article" id="section-${index + 1}">
      <header class="article-head">
        <span class="article-num">§${index + 1}</span>
        <h2>${escapeHtml(title)}</h2>
      </header>
      <p>${escapeHtml(body)}</p>
      ${discordExtra}
    </section>`;
  }).join("\n");

  const tocHtml = PLAYER_RULES_SECTIONS.map(
    ([title], index) =>
      `<li><a href="#section-${index + 1}"><span class="toc-num">${index + 1}.</span> ${escapeHtml(title)}</a></li>`,
  ).join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(SITE_BRAND_SHORT)} — Season 3 Player Rulebook</title>
  <style>
    :root {
      --bg: #f5ead8;
      --bg-deep: #e8d4bc;
      --ink: #1c1410;
      --muted: #5c4a3a;
      --accent: #c67139;
      --accent-dark: #8f4f28;
      --card: rgba(255, 252, 247, 0.92);
      --border: rgba(28, 20, 16, 0.12);
      --serif: "Palatino Linotype", "Book Antiqua", Palatino, "Times New Roman", serif;
      --sans: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    }
    * { box-sizing: border-box; margin: 0; }
    body {
      font-family: var(--sans);
      color: var(--ink);
      background: var(--bg);
      background-image:
        radial-gradient(ellipse 120% 80% at 50% -20%, rgba(198, 113, 57, 0.18), transparent 55%),
        linear-gradient(180deg, var(--bg) 0%, var(--bg-deep) 100%);
      line-height: 1.65;
      min-height: 100vh;
    }
    .wrap {
      max-width: 46rem;
      margin: 0 auto;
      padding: clamp(1.25rem, 4vw, 2.5rem) clamp(1rem, 4vw, 1.75rem) 3rem;
    }
    .cover {
      text-align: center;
      padding: clamp(1.5rem, 4vw, 2.25rem) clamp(1rem, 3vw, 1.5rem);
      border-radius: 1rem;
      border: 1px solid var(--border);
      background: var(--card);
      box-shadow: 0 12px 40px rgba(28, 20, 16, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.65);
    }
    .mark {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 3.25rem;
      height: 3.25rem;
      border-radius: 50%;
      background: var(--accent);
      color: var(--bg);
      font-family: var(--serif);
      font-weight: 700;
      font-size: 1.1rem;
      letter-spacing: 0.04em;
      margin-bottom: 0.85rem;
    }
    .edition {
      font-size: 0.68rem;
      font-weight: 700;
      letter-spacing: 0.2em;
      text-transform: uppercase;
      color: var(--accent-dark);
    }
    .season {
      display: inline-block;
      margin-top: 0.5rem;
      padding: 0.2rem 0.65rem;
      border-radius: 999px;
      border: 1px solid color-mix(in srgb, var(--accent) 35%, transparent);
      background: color-mix(in srgb, var(--accent) 12%, white);
      font-size: 0.72rem;
      font-weight: 700;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: var(--accent-dark);
    }
    h1 {
      font-family: var(--serif);
      font-size: clamp(1.45rem, 4vw, 1.85rem);
      font-weight: 650;
      margin-top: 0.65rem;
      line-height: 1.2;
    }
    .subtitle {
      margin-top: 0.75rem;
      color: var(--muted);
      font-size: 0.95rem;
      max-width: 36rem;
      margin-inline: auto;
    }
    .toc {
      margin-top: 1.75rem;
      padding: 1.25rem 1.35rem;
      border-radius: 0.85rem;
      border: 1px solid var(--border);
      background: rgba(255, 255, 255, 0.45);
    }
    .toc h3 {
      font-size: 0.7rem;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: var(--muted);
      margin-bottom: 0.75rem;
    }
    .toc ol {
      list-style: none;
      padding: 0;
      columns: 1;
      column-gap: 1.5rem;
    }
    @media (min-width: 520px) { .toc ol { columns: 2; } }
    .toc li { break-inside: avoid; margin-bottom: 0.35rem; }
    .toc a {
      color: var(--ink);
      text-decoration: none;
      font-size: 0.9rem;
    }
    .toc a:hover { color: var(--accent-dark); text-decoration: underline; }
    .toc-num { color: var(--accent); font-weight: 650; margin-right: 0.25rem; }
    .articles { margin-top: 1.75rem; display: flex; flex-direction: column; gap: 1.15rem; }
    .article {
      padding: 1.15rem 1.25rem;
      border-radius: 0.85rem;
      border: 1px solid var(--border);
      background: var(--card);
      box-shadow: 0 4px 18px rgba(28, 20, 16, 0.05);
    }
    .article-head {
      display: flex;
      align-items: baseline;
      gap: 0.65rem;
      margin-bottom: 0.55rem;
    }
    .article-num {
      font-family: var(--serif);
      font-size: 0.85rem;
      font-weight: 700;
      color: var(--accent);
      flex-shrink: 0;
    }
    .article h2 {
      font-family: var(--serif);
      font-size: 1.12rem;
      font-weight: 650;
      line-height: 1.25;
    }
    .article p { color: var(--muted); font-size: 0.95rem; }
    .note {
      margin-top: 0.65rem;
      padding-top: 0.65rem;
      border-top: 1px dashed var(--border);
      font-size: 0.9rem;
      color: var(--ink);
    }
    .note a { color: var(--accent-dark); font-weight: 600; }
    footer {
      margin-top: 2rem;
      text-align: center;
      font-size: 0.82rem;
      color: var(--muted);
    }
    footer a { color: var(--accent-dark); }
    @media print {
      body { background: white; }
      .cover, .article { box-shadow: none; break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="wrap">
    <header class="cover">
      <div class="mark" aria-hidden="true">BR</div>
      <p class="edition">${escapeHtml(SITE_BRAND_FULL)}</p>
      <p class="season">Season 3</p>
      <h1>Official Player Rulebook</h1>
      <p class="subtitle">${escapeHtml(PLAYER_RULES_REGISTRATION_NOTICE)}</p>
    </header>
    <nav class="toc" aria-label="Table of contents">
      <h3>Contents</h3>
      <ol>${tocHtml}</ol>
    </nav>
    <div class="articles">
      ${sectionsHtml}
    </div>
    <footer>
      ${invite ? `<p><a href="${escapeHtml(invite)}">Discord</a> · </p>` : ""}
      <p>Published for ${escapeHtml(SITE_BRAND_SHORT)} · Season 3</p>
    </footer>
  </div>
</body>
</html>`;
}

export function downloadRulebookHtml({ discordUrl = "" } = {}) {
  const html = buildRulebookDownloadHtml({ discordUrl });
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = RULEBOOK_DOWNLOAD_FILENAME;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
