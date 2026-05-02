import DOMPurify from "dompurify";

/** Minimal tags for public tournament description / overview (landing + hub). */
const DESCRIPTION_PURIFY = {
  ALLOWED_TAGS: ["p", "br", "strong", "b", "em", "i", "u", "a", "ul", "ol", "li"],
  ALLOWED_ATTR: ["href", "title", "target", "rel"],
  ALLOW_DATA_ATTR: false,
};

const RULEBOOK_PURIFY = {
  ALLOWED_TAGS: [
    "p",
    "br",
    "hr",
    "div",
    "span",
    "strong",
    "b",
    "em",
    "i",
    "u",
    "s",
    "ul",
    "ol",
    "li",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "blockquote",
    "a",
    "small",
    "sub",
    "sup",
    "table",
    "thead",
    "tbody",
    "tr",
    "th",
    "td",
  ],
  ALLOWED_ATTR: ["class", "style", "href", "title", "target", "rel", "colspan", "rowspan"],
  ALLOW_DATA_ATTR: false,
};

/**
 * Sanitizes organizer-authored rulebook HTML for safe `dangerouslySetInnerHTML`.
 * Plain text (no tags) is converted so line breaks still show.
 */
export function sanitizeRulebookHtml(raw) {
  if (!raw || typeof raw !== "string") return "";
  const trimmed = raw.trim();
  if (!trimmed) return "";
  const looksLikeHtml = /<\/?[a-z][\s\S]*?>/i.test(trimmed);
  const html = looksLikeHtml ? trimmed : trimmed.replace(/\n/g, "<br>");
  return DOMPurify.sanitize(html, RULEBOOK_PURIFY);
}

/**
 * Sanitizes tournament description (overview) HTML — leaner allowlist than the full rulebook.
 * Plain text line breaks become `<br>` when the value is not already HTML-like.
 */
export function sanitizeDescriptionHtml(raw) {
  if (!raw || typeof raw !== "string") return "";
  const trimmed = raw.trim();
  if (!trimmed) return "";
  const looksLikeHtml = /<\/?[a-z][\s\S]*?>/i.test(trimmed);
  const html = looksLikeHtml ? trimmed : trimmed.replace(/\n/g, "<br>");
  return DOMPurify.sanitize(html, DESCRIPTION_PURIFY);
}

/** Tailwind hooks for rendered overview / description blocks. */
export const descriptionContentClassName =
  "tournament-description-html [&_a]:font-medium [&_a]:text-secondary [&_a]:underline [&_a]:underline-offset-2 hover:[&_a]:text-foreground [&_p+p]:mt-3 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-0.5";
export const rulebookContentClassName =
  "rulebook-content [&_a]:font-medium [&_a]:text-secondary [&_a]:underline [&_a]:underline-offset-2 hover:[&_a]:text-foreground [&_h1,&_h2,&_h3,&_h4]:font-serif [&_h1,&_h2,&_h3,&_h4]:font-semibold [&_h1]:mt-4 [&_h1]:text-2xl [&_h1]:first:mt-0 [&_h2]:mt-4 [&_h2]:text-xl [&_h3]:mt-3 [&_h3]:text-lg [&_h4]:mt-3 [&_h4]:text-base [&_p+p]:mt-3 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:my-0.5 [&_blockquote]:my-2 [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_table]:my-3 [&_table]:w-full [&_table]:border-collapse [&_table]:text-sm [&_th,&_td]:border [&_th,&_td]:border-border [&_th,&_td]:px-2 [&_th,&_td]:py-1 [&_th]:bg-background/80";
