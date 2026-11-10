// GitHub-style pipe tables for the lightweight Markdown renderers.
const cells = (line) => {
  const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return trimmed.split(/(?<!\\)\|/).map((cell) => cell.trim().replace(/\\\|/g, "|"));
};
const isSeparator = (line) => {
  if (!line || !line.includes("-")) return false;
  const parts = cells(line);
  return parts.length > 0 && parts.every((cell) => /^:?-{1,}:?$/.test(cell));
};

/** A table that starts at lines[index], or null. `end` is the first line after it. */
export function tableAt(lines, index) {
  const header = lines[index];
  if (!header || !header.includes("|") || !isSeparator(lines[index + 1])) return null;
  const head = cells(header);
  const align = cells(lines[index + 1]).map((cell) =>
    cell.endsWith(":") ? (cell.startsWith(":") ? "center" : "right") : "left",
  );
  const rows = [];
  let end = index + 2;
  while (end < lines.length && lines[end].trim() && lines[end].includes("|")) {
    const row = cells(lines[end]);
    rows.push(head.map((_, i) => row[i] ?? ""));
    end++;
  }
  return { head, align: head.map((_, i) => align[i] || "left"), rows, end };
}
