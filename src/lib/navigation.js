const decodeCourse = (value) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

export function parseRoute(hash, data, fallbackCourseId = "se") {
  const [path = "", query] = hash.replace(/^#\/?/, "").split("?");
  const params = new URLSearchParams(query);
  const parts = path.split("/").filter(Boolean);
  const sessionId = params.get("session");
  const noteId = params.get("note");
  const inferred =
    data.sessions.find((item) => item.id === sessionId)?.courseId ||
    data.notes.find((item) => item.id === noteId)?.courseId;
  const courseId =
    (parts[0] === "courses" && parts[1]
      ? decodeCourse(parts[1])
      : params.get("course")) ||
    inferred ||
    fallbackCourseId;
  let view = parts[0] || "courses";
  if (view === "overview") view = "courses";
  if (
    view === "studio" ||
    view === "materials" ||
    (view === "courses" && parts[1])
  )
    view = "course";
  if (!["courses", "course", "wiki", "market", "teacher"].includes(view))
    view = "courses";
  return {
    view,
    courseId,
    sessionId,
    noteId,
    panel: params.get("panel") || (parts[0] === "materials" ? "files" : null),
  };
}

export function buildRoute(next, params, data, currentCourseId) {
  const courseId =
    params.courseId ||
    data.sessions.find((item) => item.id === params.sessionId)?.courseId ||
    data.notes.find((item) => item.id === params.noteId)?.courseId ||
    currentCourseId;
  if (next === "overview" || next === "courses") return "#/courses";
  const query = new URLSearchParams();
  if (params.sessionId) query.set("session", params.sessionId);
  if (params.noteId) query.set("note", params.noteId);
  if (["studio", "course", "materials"].includes(next)) {
    if (next === "materials") query.set("panel", "files");
    return `#/courses/${encodeURIComponent(courseId)}${query.size ? `?${query}` : ""}`;
  }
  query.set("course", courseId);
  return `#/${next}${query.size ? `?${query}` : ""}`;
}
