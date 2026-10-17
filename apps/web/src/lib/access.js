const sameStudent = (data, ownerId, studentId) => {
  const student = data.students.find(
    (item) => item.id === studentId || item.studentId === studentId,
  );
  return (
    ownerId === studentId ||
    Boolean(
      student && (ownerId === student.id || ownerId === student.studentId),
    )
  );
};
export const isEnrolled = (data, courseId, studentId) =>
  (data.enrollments || []).some(
    (item) =>
      item.courseId === courseId &&
      sameStudent(data, item.studentId, studentId),
  );
export const canTeach = (data, teacherId, courseId) =>
  Boolean(
    teacherId &&
    data.courses.some(
      (course) => course.id === courseId && course.teacherId === teacherId,
    ),
  );
export const canReadCourse = (data, actor, courseId) =>
  actor?.role === "teacher"
    ? canTeach(data, actor.id, courseId)
    : actor?.role === "student" && isEnrolled(data, courseId, actor.id);
export const visibleCourses = (data, actor) =>
  data.courses.filter((course) => canReadCourse(data, actor, course.id));
export const enrolledStudents = (data, courseId) =>
  data.students.filter((student) => isEnrolled(data, courseId, student.id));
export const canReadSession = (data, actor, session) =>
  Boolean(
    session &&
    canReadCourse(data, actor, session.courseId) &&
    isEnrolled(data, session.courseId, session.studentId) &&
    (actor.role === "teacher" ||
      sameStudent(data, session.studentId, actor.id)),
  );
export const canReadMaterial = (data, actor, material) =>
  Boolean(
    material &&
    canReadCourse(data, actor, material.courseId) &&
    (!material.ownerId ||
      (isEnrolled(data, material.courseId, material.ownerId) &&
        (actor.role === "teacher" ||
          sameStudent(data, material.ownerId, actor.id)))),
  );
export const canReadPrivateNote = (data, actor, note) =>
  Boolean(
    note &&
    actor?.role === "student" &&
    canReadCourse(data, actor, note.courseId) &&
    sameStudent(data, note.studentId, actor.id),
  );
export const canReadThread = (data, actor, thread) =>
  Boolean(
    thread &&
    canReadCourse(data, actor, thread.courseId) &&
    isEnrolled(data, thread.courseId, thread.studentId) &&
    data.courses.find((course) => course.id === thread.courseId)?.teacherId ===
      thread.teacherId &&
    (actor.role === "teacher"
      ? actor.id === thread.teacherId
      : sameStudent(data, thread.studentId, actor.id)),
  );
export const visibleThreads = (data, actor) =>
  (data.threads || []).filter((thread) => canReadThread(data, actor, thread));
export function threadStatus(thread) {
  if (thread.status === "resolved") return "resolved";
  return thread.messages?.at(-1)?.senderRole === "teacher"
    ? "replied"
    : "needs-reply";
}
export function isThreadUnread(thread, actor) {
  const last = thread.messages?.at(-1);
  return Boolean(
    last &&
    last.senderRole !== actor.role &&
    Date.parse(last.createdAt) >
      (Date.parse(thread.lastReadAt?.[actor.role]) || 0),
  );
}
export const inboxUnreadCount = (data, actor) =>
  visibleThreads(data, actor).filter((thread) => isThreadUnread(thread, actor))
    .length;
