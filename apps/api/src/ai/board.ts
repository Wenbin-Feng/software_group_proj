export const boardSchema = {
  type: "object",
  additionalProperties: false,
  required: ["quiet", "summary", "themes"],
  properties: {
    quiet: { type: "boolean" },
    summary: { type: "string", maxLength: 400 },
    themes: {
      type: "array",
      maxItems: 6,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "detail", "mentions", "severity", "sources"],
        properties: {
          title: { type: "string", maxLength: 80 },
          detail: { type: "string", maxLength: 280 },
          mentions: { type: "integer", minimum: 1, maximum: 99 },
          severity: { type: "string", enum: ["low", "medium", "high"] },
          sources: {
            type: "array",
            maxItems: 4,
            items: { type: "string", maxLength: 8 },
          },
        },
      },
    },
  },
};

export type BoardTheme = {
  title: string;
  detail: string;
  mentions: number;
  severity: "low" | "medium" | "high";
  sessionIds: string[];
};

export type BoardReport = {
  id: string;
  courseId: string;
  teacherId: string;
  generatedAt: string;
  sessionCount: number;
  questionCount: number;
  quiet: boolean;
  summary: string;
  themes: BoardTheme[];
};

const clean = (value: unknown, max: number) =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);

export function boardSources(sessions: any[]) {
  const recent = (sessions || [])
    .map((session) => ({
      id: String(session?.id || ""),
      updatedAt: String(session?.updatedAt || session?.createdAt || ""),
      turns: (session?.messages || [])
        .filter((message: any) => ["user", "assistant"].includes(message?.role))
        .slice(-8)
        .map((message: any) => ({
          role: message.role as string,
          content: clean(message.content, 280),
        }))
        .filter((message: { content: string }) => message.content),
    }))
    .filter(
      (session) =>
        session.id &&
        session.turns.some((turn: { role: string }) => turn.role === "user"),
    )
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 24);
  const questionCount = recent.reduce(
    (count, session) =>
      count +
      session.turns.filter((turn: { role: string }) => turn.role === "user")
        .length,
    0,
  );
  const text = recent
    .map((session, index) => {
      const body = session.turns
        .map((turn: { role: string; content: string }) =>
          `${turn.role === "user" ? "Student" : "Tutor"}: ${turn.content}`,
        )
        .join("\n");
      return `[S${index + 1}]\n${body}`;
    })
    .join("\n\n");
  return { text, ids: recent.map((session) => session.id), questionCount };
}

export function validateBoard(
  input: any,
  sourceIds: string[],
): { quiet: boolean; summary: string; themes: BoardTheme[] } {
  if (!input || typeof input.quiet !== "boolean" || !Array.isArray(input.themes))
    throw new Error("The course board was incomplete. Please retry.");
  if (input.themes.length > 6)
    throw new Error("The course board returned too many themes.");
  const themes = input.themes
    .map((theme: any) => {
      const title = clean(theme?.title, 80);
      const detail = clean(theme?.detail, 280);
      if (!title || !detail) return null;
      const mentions = Number(theme?.mentions);
      const severity = ["low", "medium", "high"].includes(theme?.severity)
        ? theme.severity
        : "low";
      const sessionIds = [
        ...new Set(
          (Array.isArray(theme?.sources) ? theme.sources : [])
            .map((label: unknown) => {
              const match = String(label || "").match(/^S(\d+)$/);
              const index = match ? Number(match[1]) - 1 : -1;
              return sourceIds[index] || "";
            })
            .filter(Boolean),
        ),
      ].slice(0, 4);
      return {
        title,
        detail,
        mentions: Number.isInteger(mentions)
          ? Math.min(99, Math.max(1, mentions))
          : 1,
        severity,
        sessionIds,
      } as BoardTheme;
    })
    .filter(Boolean) as BoardTheme[];
  return {
    quiet: input.quiet === true || themes.length === 0,
    summary: clean(input.summary, 400) || "No recurring difficulty stood out.",
    themes,
  };
}
