import { createSeed } from '../data/seed';

export type Role = 'student' | 'instructor' | 'admin';
export type User = {
  id: string;
  name: string;
  email: string;
  role: Role;
  initials: string;
  color: string;
};
export type Course = {
  id: string;
  code: string;
  title: string;
  description: string;
  instructorId: string;
  inviteCode: string;
  color: string;
  icon: string;
  term: string;
  topics: string[];
  nextSession: string;
};
export type Material = {
  id: string;
  courseId: string;
  title: string;
  filename: string;
  kind: string;
  size: string;
  category: string;
  body: string;
  seeded: boolean;
  topic: string;
  uploadedAt: string;
  mime?: string;
};
export type Note = {
  id: string;
  ownerId: string;
  title: string;
  content: string;
  tags: string[];
  updatedAt: string;
  sourceAuthorId?: string;
  sourceMaterialId?: string;
};
export type Publication = {
  id: string;
  noteId: string;
  authorId: string;
  title: string;
  description: string;
  content: string;
  tags: string[];
  color: string;
  publishedAt: string;
};
export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  supported?: boolean;
  sourceId?: string;
};
export type Conversation = { userId: string; materialId: string; messages: ChatMessage[] };
export type DemoState = {
  version: 1;
  currentUserId: string | null;
  users: User[];
  courses: Course[];
  memberships: { courseId: string; userId: string }[];
  materials: Material[];
  notes: Note[];
  publications: Publication[];
  bookmarks: { userId: string; publicationId: string }[];
  conversations: Conversation[];
};

export const id = () => crypto.randomUUID();
export const today = () => new Date().toISOString().slice(0, 10);

export function uniqueTitle(title: string, notes: Pick<Note, 'title'>[]): string {
  const base = title.trim() || 'Untitled note';
  const existing = new Set(notes.map((n) => n.title.trim().toLowerCase()));
  if (!existing.has(base.toLowerCase())) return base;
  let number = 2;
  while (existing.has(`${base} (${number})`.toLowerCase())) number++;
  return `${base} (${number})`;
}

export function publishNote(note: Note, publicationId: string): Publication {
  // A publication is a snapshot; later private edits must not alter shared content.
  return {
    id: publicationId,
    noteId: note.id,
    authorId: note.ownerId,
    title: note.title,
    content: note.content,
    tags: [...note.tags],
    description: note.content
      .replace(/[#*>`\[\]]/g, '')
      .replace(/\s+/g, ' ')
      .slice(0, 145),
    color: 'sage',
    publishedAt: today(),
  };
}

export function copyPublication(
  pub: Publication,
  ownerId: string,
  notes: Note[],
  noteId: string,
): Note {
  return {
    id: noteId,
    ownerId,
    title: uniqueTitle(
      pub.title,
      notes.filter((n) => n.ownerId === ownerId),
    ),
    content: pub.content,
    tags: [...pub.tags],
    sourceAuthorId: pub.authorId,
    updatedAt: today(),
  };
}

export function wikiLinks(content: string): string[] {
  const result: string[] = [];
  for (const match of content.matchAll(/\[\[([^\]\n]+)\]\]/g)) {
    const title = match[1].trim();
    if (title && !result.some((t) => t.toLowerCase() === title.toLowerCase())) result.push(title);
  }
  return result;
}

export function renameNote(notes: Note[], noteId: string, title: string, ownerId: string): Note[] {
  const current = notes.find((n) => n.id === noteId && n.ownerId === ownerId);
  if (!current) throw new Error('Note not found');
  const next = title.trim();
  if (!next) throw new Error('Please give your note a title.');
  if (
    notes.some(
      (n) =>
        n.ownerId === ownerId && n.id !== noteId && n.title.toLowerCase() === next.toLowerCase(),
    )
  )
    throw new Error('A note with this title already exists.');
  // Rewriting is scoped to the owner. Another user's copied Wiki remains independent.
  return notes.map((n) =>
    n.ownerId !== ownerId
      ? n
      : {
          ...n,
          title: n.id === noteId ? next : n.title,
          content: n.content.replace(/\[\[([^\]\n]+)\]\]/g, (match, target: string) =>
            target.trim().toLowerCase() === current.title.toLowerCase() ? `[[${next}]]` : match,
          ),
          updatedAt: n.id === noteId ? today() : n.updatedAt,
        },
  );
}

export function joinCourse(state: DemoState, code: string, userId: string): DemoState {
  const course = state.courses.find(
    (c) => c.inviteCode.toLowerCase() === code.trim().toLowerCase(),
  );
  if (!course) throw new Error('Invalid class code. Try SE2026, AI2026, or DESIGN26.');
  if (state.memberships.some((m) => m.courseId === course.id && m.userId === userId)) return state;
  return { ...state, memberships: [...state.memberships, { courseId: course.id, userId }] };
}

const record = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const fields = (v: unknown, keys: string[]) =>
  record(v) && keys.every((k) => typeof v[k] === 'string');
const strings = (v: unknown) => Array.isArray(v) && v.every((x) => typeof x === 'string');
export function restoreState(raw: string | null): { state: DemoState; recovered: boolean } {
  if (raw === null) return { state: createSeed(), recovered: false };
  try {
    const s: unknown = JSON.parse(raw);
    if (!record(s) || s.version !== 1) throw new Error();
    const checks: Record<string, (v: unknown) => boolean> = {
      users: (v) =>
        fields(v, ['id', 'name', 'email', 'initials', 'color']) &&
        record(v) &&
        ['student', 'instructor', 'admin'].includes(String(v.role)),
      courses: (v) =>
        fields(v, [
          'id',
          'code',
          'title',
          'description',
          'instructorId',
          'inviteCode',
          'color',
          'icon',
          'term',
          'nextSession',
        ]) &&
        record(v) &&
        strings(v.topics),
      memberships: (v) => fields(v, ['courseId', 'userId']),
      materials: (v) =>
        fields(v, [
          'id',
          'courseId',
          'title',
          'filename',
          'kind',
          'size',
          'category',
          'body',
          'topic',
          'uploadedAt',
        ]) &&
        record(v) &&
        typeof v.seeded === 'boolean',
      notes: (v) =>
        fields(v, ['id', 'ownerId', 'title', 'content', 'updatedAt']) &&
        record(v) &&
        strings(v.tags),
      publications: (v) =>
        fields(v, [
          'id',
          'noteId',
          'authorId',
          'title',
          'content',
          'description',
          'color',
          'publishedAt',
        ]) &&
        record(v) &&
        strings(v.tags),
      bookmarks: (v) => fields(v, ['userId', 'publicationId']),
      conversations: (v) =>
        fields(v, ['userId', 'materialId']) &&
        record(v) &&
        Array.isArray(v.messages) &&
        v.messages.every(
          (m) =>
            fields(m, ['id', 'content']) &&
            record(m) &&
            ['user', 'assistant'].includes(String(m.role)),
        ),
    };
    if (
      !Object.entries(checks).every(
        ([k, check]) => Array.isArray(s[k]) && (s[k] as unknown[]).every(check),
      )
    )
      throw new Error();
    const state = s as unknown as DemoState;
    const collections = [
      state.users,
      state.courses,
      state.materials,
      state.notes,
      state.publications,
    ];
    const uniqueIds = collections.every(
      (items) =>
        items.every((item) => item.id.trim()) &&
        new Set(items.map((item) => item.id)).size === items.length,
    );
    const userIds = new Set(state.users.map((user) => user.id));
    const courseIds = new Set(state.courses.map((course) => course.id));
    const validReferences =
      state.courses.every((course) => userIds.has(course.instructorId)) &&
      state.materials.every((material) => courseIds.has(material.courseId)) &&
      state.memberships.every(
        (membership) => userIds.has(membership.userId) && courseIds.has(membership.courseId),
      ) &&
      state.notes.every(
        (note) =>
          userIds.has(note.ownerId) && (!note.sourceAuthorId || userIds.has(note.sourceAuthorId)),
      ) &&
      state.publications.every((publication) => userIds.has(publication.authorId));
    // Deleted source notes/materials are allowed: publications and study notes retain snapshots.
    const noteTitles = state.notes.map(
      (note) => `${note.ownerId}:${note.title.trim().toLowerCase()}`,
    );
    const validNotes =
      new Set(noteTitles).size === noteTitles.length &&
      state.notes.every(
        (note) =>
          note.title.trim() &&
          /^\d{4}-\d{2}-\d{2}$/.test(note.updatedAt) &&
          Number.isFinite(Date.parse(`${note.updatedAt}T12:00:00`)),
      );
    if (
      !state.users.length ||
      !uniqueIds ||
      !validReferences ||
      !validNotes ||
      !(state.currentUserId === null || state.users.some((u) => u.id === state.currentUserId))
    )
      throw new Error();
    return { state, recovered: false };
  } catch {
    return { state: createSeed(), recovered: true };
  }
}

export type Answer = {
  supported: boolean;
  content: string;
  sourceId?: string;
  animation?: boolean;
};
export const demoQuestions: Record<string, string[]> = {
  lifecycle: [
    'How do Waterfall and Agile differ?',
    'Explain the development lifecycle',
    'Which approach fits our class project?',
  ],
  requirements: [
    'What makes a good user story?',
    'Compare functional and non-functional requirements',
    'How can we validate requirements?',
  ],
  ai: ['How should I work with an AI coding agent?', 'How do I verify AI output?'],
  design: ['How do I run a useful user interview?', 'How can a prototype test an assumption?'],
};
export function answerQuestion(question: string, material: Material): Answer {
  const q = question.toLowerCase();
  const fallback = {
    supported: false,
    content: material.seeded
      ? 'This prototype has prepared explanations for this material. Try one of the suggested questions below to explore a source-linked answer.'
      : 'This is your uploaded material. In this frontend demo I cannot analyze new files. Open the seeded lifecycle guide to try source-linked explanations and an interactive animation.',
  };
  if (!material.seeded) return fallback;
  if (material.topic === 'lifecycle' && /waterfall|agile|approach|iterat/.test(q))
    return {
      supported: true,
      sourceId: material.id,
      animation: true,
      content:
        '## Two approaches, one goal\n\n**Waterfall** follows a sequence: requirements, design, implementation, testing, then release. It works best when the problem and requirements are well understood.\n\n**Agile** delivers in small increments. Each cycle creates a chance to test an assumption and use feedback to shape the next one.\n\n| | Waterfall | Agile |\n|---|---|---|\n| Delivery | One planned release | Small, frequent increments |\n| Feedback | Often later in the process | During every iteration |\n| Change | More costly late on | Expected and managed |\n\nFor our class project, short iterations can help us learn whether the prototype meets students’ needs. The right approach still depends on the context.\n\n**See it in action:** open the interactive comparison below.',
    };
  if (material.topic === 'lifecycle' && /lifecycle|development|phase|summari|explain/.test(q))
    return {
      supported: true,
      sourceId: material.id,
      animation: true,
      content:
        '## From an idea to useful software\n\n1. **Requirements:** understand people and the problem.\n2. **Design:** decide how the system will meet those needs.\n3. **Implementation:** build a useful solution.\n4. **Testing:** check behavior against requirements.\n5. **Release:** put it in people’s hands and learn.\n\nThese activities can happen sequentially or repeat in short iterations. Good engineering connects them through feedback.\n\nTry the Waterfall vs Agile animation to see two ways of organizing this journey.',
    };
  if (material.topic === 'requirements' && /stor|functional|requirement|validat|acceptance/.test(q))
    return {
      supported: true,
      sourceId: material.id,
      content:
        '## Start with the need\n\nA **functional requirement** describes behavior: a student can join a class with a code. A **non-functional requirement** describes a quality or constraint: the page is usable on a phone.\n\nA useful story connects a person, action, and benefit:\n\n> As a student, I want to ask questions about a lecture document, so that I can understand an unfamiliar concept.\n\nAdd observable **acceptance criteria**. For example, an invalid class code shows an error and creates no membership. Validate the story by watching someone use a small prototype.',
    };
  if (material.topic === 'ai' && /ai|agent|verif|coding|output|prompt/.test(q))
    return {
      supported: true,
      sourceId: material.id,
      content:
        '## Work with AI deliberately\n\n- **Describe** the outcome, user, constraints, and a concrete example.\n- **Delegate** a small task that can be checked.\n- **Evaluate** the changes and the assumptions behind them.\n- **Verify** the actual behavior with relevant tests and a browser walkthrough.\n\nKeep responsibility for the result. A confident answer is not evidence that the implementation works.',
    };
  if (material.topic === 'design' && /interview|prototype|assumption|research|user/.test(q))
    return {
      supported: true,
      sourceId: material.id,
      content:
        '## Learn from what people actually do\n\nAsk someone to show you a recent example of the task. Notice friction and workarounds; ask what made them necessary.\n\nTurn the pattern into a focused problem statement, then build a small prototype. Ask the person to complete a realistic task and observe where your assumption fails.\n\nUse that evidence to guide the next iteration.',
    };
  return fallback;
}
