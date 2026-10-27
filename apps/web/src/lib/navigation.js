const decode = (value) => {
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
  const wikiId = params.get("wiki");
  const noteCourseId = data.notes.find((note) => note.id === noteId)?.courseId;
  const inferred =
    data.sessions.find((session) => session.id === sessionId)?.courseId ||
    noteCourseId;
  const base = {
    courseId: params.get("course") || inferred || fallbackCourseId,
    sessionId,
    noteId,
    wikiId,
    threadId: params.get("thread"),
    status: params.get("status") || "all",
    query: params.get("q") || "",
    returnTo: params.get("returnTo"),
    panel: params.get("panel") || (parts[0] === "materials" ? "files" : null),
    upload: params.get("upload") === "1",
  };
  if (parts[0] === "teacher") {
    if (parts[1] === "courses") {
      if (!parts[2])
        return { ...base, view: "teacher", teacherPage: "courses" };
      const courseId = decode(parts[2]);
      const studentId =
        parts[3] === "students" && parts[4] ? decode(parts[4]) : null;
      if (studentId && parts[5] === "sessions" && parts[6])
        return {
          ...base,
          courseId,
          studentId,
          sessionId: decode(parts[6]),
          view: "teacher",
          teacherPage: "review",
        };
      if (parts[3] === "sessions" && parts[4])
        return {
          ...base,
          courseId,
          sessionId: decode(parts[4]),
          view: "teacher",
          teacherPage: "review",
          studentId: data.sessions.find(
            (session) => session.id === decode(parts[4]),
          )?.studentId,
        };
      return {
        ...base,
        courseId,
        studentId,
        view: "teacher",
        teacherPage: studentId
          ? "student"
          : ["overview", "materials", "students", "market", "courseware"].includes(parts[3])
            ? parts[3]
            : "overview",
      };
    }
    return { ...base, view: "teacher", teacherPage: "overview" };
  }
  let view = parts[0] || "courses";
  let courseId = base.courseId;
  if (view === "wiki" && noteCourseId) courseId = noteCourseId;
  if (view === "overview") view = "courses";
  if (
    view === "studio" ||
    view === "materials" ||
    (view === "courses" && parts[1])
  )
    view = "course";
  if (parts[0] === "courses" && parts[1]) courseId = decode(parts[1]);
  if (!["courses", "course", "wiki", "market", "inbox"].includes(view))
    view = "courses";
  return {
    ...base,
    courseId: view === "inbox" ? params.get("course") || null : courseId,
    view,
  };
}
export function buildRoute(next, params = {}, data, currentCourseId) {
  const courseId =
    params.courseId ||
    data.sessions.find((session) => session.id === params.sessionId)
      ?.courseId ||
    data.notes.find((note) => note.id === params.noteId)?.courseId ||
    currentCourseId;
  const query = new URLSearchParams();
  if (params.query) query.set("q", params.query);
  if (params.returnTo) query.set("returnTo", params.returnTo);
  if (params.upload) query.set("upload", "1");
  const suffix = () => (query.size ? `?${query}` : "");
  if (next === "teacher-courses") return "#/teacher/courses";
  if (next.startsWith("teacher-") || next === "teacher") {
    const page = next === "teacher" ? "overview" : next.slice(8);
    const base = `#/teacher/courses/${encodeURIComponent(courseId)}`;
    if (page === "student")
      return `${base}/students/${encodeURIComponent(params.studentId)}${suffix()}`;
    if (page === "review") {
      const studentId =
        params.studentId ||
        data.sessions.find((session) => session.id === params.sessionId)
          ?.studentId;
      return `${base}/students/${encodeURIComponent(studentId || "unknown")}/sessions/${encodeURIComponent(params.sessionId || "unknown")}${suffix()}`;
    }
    return `${base}/${["overview", "materials", "students", "market", "courseware"].includes(page) ? page : "overview"}${suffix()}`;
  }
  if (next === "inbox") {
    if (params.courseId) query.set("course", params.courseId);
    if (params.threadId) query.set("thread", params.threadId);
    if (params.status && params.status !== "all")
      query.set("status", params.status);
    return `#/inbox${suffix()}`;
  }
  if (next === "courses" || next === "overview") return "#/courses";
  if (next === "wiki" && !params.noteId && !params.wikiId) return "#/wiki";
  if (params.sessionId) query.set("session", params.sessionId);
  if (params.noteId) query.set("note", params.noteId);
  if (params.wikiId) query.set("wiki", params.wikiId);
  if (["course", "studio", "materials"].includes(next)) {
    if (next === "materials") query.set("panel", "files");
    return `#/courses/${encodeURIComponent(courseId)}${suffix()}`;
  }
  query.set("course", courseId);
  return `#/${next}${suffix()}`;
}
