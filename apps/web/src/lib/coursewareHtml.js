import { deckLayoutStyle } from "../../../api/src/ai/deck-layout.ts";

// Existing published courseware keeps its saved content. Only its display styles
// are refreshed; CSP and the caller's sandbox remain unchanged.
export function coursewareHtml(html) {
  if (!html) return html;
  const content = html.replace(
    /<style\b[^>]*\bdata-folio-courseware-layout\b[^>]*>[\s\S]*?<\/style\s*>/gi,
    "",
  );
  return /<\/head\s*>/i.test(content)
    ? content.replace(/<\/head\s*>/i, () => `${deckLayoutStyle}</head>`)
    : `${deckLayoutStyle}${content}`;
}
