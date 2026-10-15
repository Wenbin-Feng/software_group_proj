import { initialData } from "../data.js";
const TEACHERS = [
  { id: "richard", name: "Richard Lui", initials: "RL", color: "#b16c4b" },
  { id: "emily", name: "Emily Chan", initials: "EC", color: "#8b6ac0" },
];
export function migrateWorkspace(input) {
  const source =
    input?.courses?.length &&
    ["sessions", "notes", "market", "students", "materials"].every((key) =>
      Array.isArray(input[key]),
    )
      ? input
      : structuredClone(initialData);
  const teachers = source.teachers?.length
    ? source.teachers
    : structuredClone(TEACHERS);
  const courses = source.courses.map((course) => ({
    ...course,
    teacherId:
      course.teacherId ||
      teachers.find((teacher) => teacher.name === course.instructor)?.id ||
      "richard",
  }));
  const enrollments = Array.isArray(source.enrollments)
    ? source.enrollments
    : courses.flatMap((course) =>
        source.students.map((student) => ({
          courseId: course.id,
          studentId: student.id,
        })),
      );
  return {
    ...source,
    schemaVersion: 2,
    teachers,
    courses,
    enrollments,
    materials: source.materials.map((material) => ({
      archivedAt: null,
      ...material,
    })),
    market: source.market.map((publication) => ({
      featured: false,
      ...publication,
    })),
    threads: Array.isArray(source.threads)
      ? source.threads
      : seedThreads(courses, source.students),
  };
}
function seedThreads(courses, students) {
  const samples = [
    {
      id: "thread-sarah-interviews",
      courseId: "se",
      studentId: "sarah",
      subject: "Could you look at my interview questions?",
      body: "I am preparing a learner interview. How can I avoid leading questions?",
      sessionId: "s-sarah-1",
      time: "2026-10-15T16:20:00+08:00",
    },
    {
      id: "thread-wenbin-locks",
      courseId: "se",
      studentId: "wenbin",
      subject: "Which concurrency strategy fits our prototype?",
      body: "I understand the race condition now. For our project, should we compare a conditional update with a row lock?",
      sessionId: "s-wenbin-1",
      time: "2026-10-15T15:30:00+08:00",
      reply:
        "Compare the two approaches using the same last-item scenario. Explain the invariant first, then show what happens to the losing request.",
      replyTime: "2026-10-15T16:00:00+08:00",
    },
    {
      id: "thread-alex-review",
      courseId: "se",
      studentId: "alex",
      subject: "Thanks for the review checklist advice",
      body: "The behavior-first checklist helped us review the agent output. Thank you.",
      time: "2026-10-14T14:00:00+08:00",
      reply:
        "Glad it helped. Keep the concrete checks and the corrections you make for your project reflection.",
      replyTime: "2026-10-14T15:00:00+08:00",
      resolved: true,
    },
    {
      id: "thread-wenbin-browser",
      courseId: "web",
      studentId: "wenbin",
      subject: "Where should I inspect a failed request?",
      body: "If the HTML loads but a script fails, should I start with the Network panel or the Console?",
      sessionId: "s-wenbin-web",
      time: "2026-10-15T17:10:00+08:00",
    },
  ];
  return samples.flatMap((sample) => {
    const course = courses.find((item) => item.id === sample.courseId);
    if (!course || !students.some((item) => item.id === sample.studentId))
      return [];
    const messages = [
      {
        id: `${sample.id}-1`,
        senderRole: "student",
        senderId: sample.studentId,
        body: sample.body,
        createdAt: sample.time,
      },
    ];
    if (sample.reply)
      messages.push({
        id: `${sample.id}-2`,
        senderRole: "teacher",
        senderId: course.teacherId,
        body: sample.reply,
        createdAt: sample.replyTime,
      });
    return [
      {
        id: sample.id,
        courseId: course.id,
        studentId: sample.studentId,
        teacherId: course.teacherId,
        subject: sample.subject,
        status: sample.resolved ? "resolved" : "open",
        relatedSessionId: sample.sessionId || null,
        createdAt: sample.time,
        updatedAt: sample.replyTime || sample.time,
        lastReadAt: {
          student: sample.resolved ? sample.replyTime : sample.time,
          teacher: sample.replyTime || null,
        },
        messages,
      },
    ];
  });
}
export function loadIdentity(data) {
  try {
    const stored = JSON.parse(localStorage.getItem("folio-identity"));
    if (
      stored &&
      ["student", "teacher"].includes(stored.role) &&
      data.students.some((student) => student.id === stored.studentId) &&
      data.teachers.some((teacher) => teacher.id === stored.teacherId)
    )
      return stored;
  } catch {}
  return {
    role: "student",
    studentId: data.students[0].id,
    teacherId: data.teachers[0].id,
  };
}
