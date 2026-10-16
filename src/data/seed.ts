import type { DemoState } from '../lib/domain';

export const lifecycleContent = `# The software development lifecycle

Good software starts with a clear understanding of the problem. A development lifecycle gives a team a shared way to turn an idea into a reliable product.

## 01 · Start with the problem

Before writing code, talk to the people who will use your product. Identify their goals, constraints, and the outcome that would make their work easier. Turn those observations into testable requirements.

> A requirement describes a need. A design describes one way to meet it.

## 02 · Waterfall: a sequential approach

Waterfall organizes work into distinct phases: **Requirements → Design → Implementation → Testing → Release**. Each phase produces a deliverable for the next. This can suit projects with stable requirements, but discovering a mistaken assumption late can be expensive.

## 03 · Agile: learn through iteration

Agile teams deliver small, useful increments. They plan, build, test, and review repeatedly. Feedback informs the next iteration, so a team can adapt as it learns about users and the problem.

| Dimension | Waterfall | Agile |
| --- | --- | --- |
| Delivery | At the end of the lifecycle | In small increments |
| Feedback | Often after a phase or release | Throughout each iteration |
| Change | More costly late in the process | Expected and managed |
| Useful when | Requirements are stable | The team needs to learn |

## 04 · Choose for your context

Neither approach removes the need for good engineering. Consider uncertainty, team size, compliance needs, and how quickly users can provide feedback. Many teams combine deliberate planning with iterative delivery.

## Reflection

Your team is building a campus study app. What would you deliver in the first iteration, and what feedback would you collect before the second?
`;

export const requirementsContent = `# Requirements that people can use

## Understand the person behind the request

A stakeholder request is the beginning of a conversation. Ask what they are trying to achieve, observe their current workflow, and distinguish the underlying need from a suggested solution.

## Functional and non-functional requirements

**Functional requirements** describe what the system does: a student can join a class with an invitation code. **Non-functional requirements** describe qualities and constraints: a class page should remain readable on a phone and protect private notes.

## Write a useful user story

As a **student**, I want to **ask questions about a lecture document**, so that **I can understand a difficult concept without losing my place**.

## Make acceptance criteria testable

- A valid invitation code adds the class to the student's workspace.
- An invalid code shows a clear message without creating a membership.
- Joining the same class twice does not create duplicate membership.

## Validate before building

Show a small prototype to a stakeholder. Ask them to complete a realistic task, observe the friction, and update your requirements with what you learn.
`;

export function createSeed(): DemoState {
  return {
    version: 1,
    currentUserId: null,
    users: [
      {
        id: 'student-1',
        name: 'Alex Morgan',
        email: 'alex.morgan@gmail.com',
        role: 'student',
        initials: 'AM',
        color: 'sage',
      },
      {
        id: 'student-2',
        name: 'Jamie Chen',
        email: 'jamie.chen@gmail.com',
        role: 'student',
        initials: 'JC',
        color: 'purple',
      },
      {
        id: 'instructor-1',
        name: 'Dr. Sarah Wilson',
        email: 'sarah.wilson@gmail.com',
        role: 'instructor',
        initials: 'SW',
        color: 'peach',
      },
      {
        id: 'admin-1',
        name: 'Taylor Brooks',
        email: 'taylor.brooks@gmail.com',
        role: 'admin',
        initials: 'TB',
        color: 'blue',
      },
    ],
    courses: [
      {
        id: 'se',
        code: 'COMP  Software Engineering',
        title: 'Software Engineering Fundamentals',
        description:
          'From a good idea to software that matters. Explore the principles, people, and processes behind great products.',
        instructorId: 'instructor-1',
        inviteCode: 'SE2026',
        color: 'sage',
        icon: 'layers',
        term: 'Fall 2026',
        topics: ['Development lifecycle', 'Requirements', 'Agile'],
        nextSession: 'Tuesday, 10:30 AM',
      },
      {
        id: 'ai',
        code: 'COMP  Artificial Intelligence',
        title: 'Building with AI',
        description:
          'Think critically, build creatively. Discover how to work with AI as a thoughtful engineering partner.',
        instructorId: 'instructor-1',
        inviteCode: 'AI2026',
        color: 'purple',
        icon: 'sparkles',
        term: 'Fall 2026',
        topics: ['Prompting', 'AI fluency', 'Evaluation'],
        nextSession: 'Thursday, 2:30 PM',
      },
      {
        id: 'product',
        code: 'COMP  Product & Design',
        title: 'Human-Centered Product Design',
        description:
          'Turn real human needs into useful experiences through research, prototyping, and iteration.',
        instructorId: 'instructor-1',
        inviteCode: 'DESIGN26',
        color: 'peach',
        icon: 'shapes',
        term: 'Fall 2026',
        topics: ['User research', 'Prototyping', 'Usability'],
        nextSession: 'Friday, 9:30 AM',
      },
    ],
    memberships: [
      { courseId: 'se', userId: 'student-1' },
      { courseId: 'ai', userId: 'student-1' },
      { courseId: 'product', userId: 'student-1' },
      { courseId: 'ai', userId: 'student-2' },
    ],
    materials: [
      {
        id: 'mat-lifecycle',
        courseId: 'se',
        title: 'The Software Development Lifecycle',
        filename: '01_Development_Lifecycle.md',
        kind: 'Guide',
        size: '6 min read',
        category: 'Lecture notes',
        body: lifecycleContent,
        seeded: true,
        topic: 'lifecycle',
        uploadedAt: 'Oct 12, 2026',
      },
      {
        id: 'mat-requirements',
        courseId: 'se',
        title: 'Understanding Requirements',
        filename: '02_Understanding_Requirements.md',
        kind: 'Guide',
        size: '5 min read',
        category: 'Lecture notes',
        body: requirementsContent,
        seeded: true,
        topic: 'requirements',
        uploadedAt: 'Oct 13, 2026',
      },
      {
        id: 'mat-workshop',
        courseId: 'se',
        title: 'Workshop 01: Your First User Story',
        filename: 'Workshop_01.md',
        kind: 'Activity',
        size: '15 min activity',
        category: 'Workshops',
        body: '# Workshop 01: Your First User Story\n\n## Your challenge\n\nDesign a better way for students to find a quiet place to study. Work in pairs to interview a classmate, write a user story, and define three acceptance criteria.\n\n## Deliverables\n\n1. A short description of the problem.\n2. One user story with a clear user, action, and benefit.\n3. Three observable acceptance criteria.\n\n## Reflect\n\nWhat did you learn from your partner that changed your initial idea?',
        seeded: true,
        topic: 'requirements',
        uploadedAt: 'Oct 14, 2026',
      },
      {
        id: 'mat-ai',
        courseId: 'ai',
        title: 'A Thoughtful Guide to AI Coding',
        filename: 'AI_Coding_Guide.md',
        kind: 'Guide',
        size: '7 min read',
        category: 'Lecture notes',
        body: '# A Thoughtful Guide to AI Coding\n\n## Describe the outcome\n\nExplain the user, the problem, constraints, and success criteria before asking an AI agent to implement a feature.\n\n## Delegate deliberately\n\nBreak work into verifiable pieces. Let AI help with implementation while you keep responsibility for requirements and decisions.\n\n## Evaluate and verify\n\nRead the changes, run relevant tests, and check behavior in the actual interface. A confident explanation is not proof.\n\n## Reflect\n\nRecord what the AI contributed and what you changed after evaluating the output.',
        seeded: true,
        topic: 'ai',
        uploadedAt: 'Oct 10, 2026',
      },
      {
        id: 'mat-design',
        courseId: 'product',
        title: 'Start with the People',
        filename: 'User_Research.md',
        kind: 'Guide',
        size: '5 min read',
        category: 'Lecture notes',
        body: '# Start with the People\n\n## Observe before proposing\n\nAsk someone to walk through a real task. Observe workarounds and moments of friction instead of asking only which features they want.\n\n## Synthesize what you learn\n\nGroup observations into patterns and write a focused problem statement.\n\n## Prototype a small change\n\nBuild the smallest useful representation of your idea, then watch someone use it. Test your assumptions before committing to a solution.',
        seeded: true,
        topic: 'design',
        uploadedAt: 'Oct 11, 2026',
      },
    ],
    notes: [
      {
        id: 'note-lifecycle',
        ownerId: 'student-1',
        title: 'The Software Development Lifecycle',
        content:
          '# The Software Development Lifecycle\n\nA map for turning ideas into reliable software.\n\n## The big picture\n\n**Requirements → Design → Implementation → Testing → Release**\n\nUnderstanding the problem comes first. See [[Requirements Analysis]] for how to discover what users really need.\n\n## Two ways to organize the journey\n\n- **Waterfall:** move through defined phases when requirements are stable.\n- **Agile:** deliver small increments and learn from feedback.\n\nThe key is [[Iterative Development]]: build a little, learn a little, improve a little.\n\n> Good process helps people learn. It does not replace their judgment.\n\n## A question to explore\n\nHow would our campus study app change after its first week with real students?',
        tags: ['Software engineering', 'Core concepts'],
        updatedAt: '2026-10-15',
      },
      {
        id: 'note-requirements',
        ownerId: 'student-1',
        title: 'Requirements Analysis',
        content:
          '# Requirements Analysis\n\nStart by understanding a person’s goal, then describe the behavior a system needs to support.\n\n## Useful distinctions\n\n- **Functional:** what the system does.\n- **Non-functional:** how well it does it and the constraints it respects.\n\n[[User Stories]] turn needs into a conversation about value. Requirements evolve through [[Iterative Development]].\n\n## A concrete example\n\nA student can join a classroom using a valid invitation code. An invalid code explains what went wrong.',
        tags: ['Software engineering', 'Requirements'],
        updatedAt: '2026-10-14',
      },
      {
        id: 'note-iterations',
        ownerId: 'student-1',
        title: 'Iterative Development',
        content:
          '# Iterative Development\n\nBuild a small increment, gather feedback, and use it to guide the next one.\n\n## The learning loop\n\n1. Choose a useful outcome.\n2. Implement and test a small slice.\n3. Show it to a real user.\n4. Reconsider your assumptions.\n\nThis connects [[The Software Development Lifecycle]] with [[User Research]] and [[Requirements Analysis]].',
        tags: ['Agile', 'Core concepts'],
        updatedAt: '2026-10-13',
      },
      {
        id: 'note-stories',
        ownerId: 'student-1',
        title: 'User Stories',
        content:
          '# User Stories\n\nAs a **student**, I want to **ask a question about my lecture notes**, so that **I can understand a difficult idea**.\n\nA story is an invitation to discuss the need. Add testable acceptance criteria.\n\nRelated: [[Requirements Analysis]] · [[User Research]]',
        tags: ['Requirements', 'Product'],
        updatedAt: '2026-10-12',
      },
      {
        id: 'note-research',
        ownerId: 'student-1',
        title: 'User Research',
        content:
          '# User Research\n\nObserve what people do, ask about concrete experiences, and keep a record of the evidence.\n\n## Try this\n\nAsk a classmate to show how they currently organize lecture notes. Notice the steps they repeat.\n\nUse what you learn to improve [[User Stories]] and plan the next round of [[Iterative Development]].',
        tags: ['Product', 'Research'],
        updatedAt: '2026-10-11',
      },
      {
        id: 'note-ai',
        ownerId: 'student-1',
        title: 'Working Thoughtfully with AI',
        content:
          '# Working Thoughtfully with AI\n\nDescribe the problem clearly, delegate a verifiable task, inspect the output, and remain accountable.\n\nGood [[Requirements Analysis]] makes an AI coding assistant more useful. Use [[Iterative Development]] to validate its work in small steps.',
        tags: ['AI', 'Engineering'],
        updatedAt: '2026-10-10',
      },
      {
        id: 'note-jamie',
        ownerId: 'student-2',
        title: 'My Learning Journal',
        content:
          '# My Learning Journal\n\nA place for questions, connections, and the things I learn along the way.\n\n## This week\n\nExplore the community and bring a useful idea into my own words.',
        tags: ['Personal'],
        updatedAt: '2026-10-15',
      },
    ],
    publications: [
      {
        id: 'pub-agile',
        noteId: 'community-agile',
        authorId: 'student-2',
        title: 'Agile, without the jargon',
        description:
          'A visual, practical guide to working in small increments and learning as you go.',
        content:
          '# Agile, without the jargon\n\nAgile is a way to learn while building. Deliver a small useful piece, observe how it works, and improve the next piece.\n\n## A week in practice\n\n- **Monday:** choose a small outcome.\n- **Tuesday–Thursday:** build and test together.\n- **Friday:** show the result and listen.\n\n## Remember\n\nA sprint is not a race to ship more tasks. It is a short opportunity to learn whether your work helps someone.\n\n## Try it\n\nFor a class study app, release a simple shared reading list before building an elaborate recommendation system.',
        tags: ['Agile', 'Software engineering'],
        color: 'sage',
        publishedAt: '2026-10-14',
      },
      {
        id: 'pub-prompts',
        noteId: 'community-prompts',
        authorId: 'instructor-1',
        title: 'Better prompts start with better questions',
        description:
          'A reusable framework for describing your goals, context, and constraints to an AI coding agent.',
        content:
          '# Better prompts start with better questions\n\n## Give the task a purpose\n\nDescribe who needs the feature and the outcome they care about.\n\n## Share useful context\n\nInclude the existing behavior, relevant constraints, and a concrete example.\n\n## Define success\n\nDescribe how you will verify the output. Ask the agent to explain assumptions you need to check.\n\n## Example\n\nBuild an invitation-code form for students. A valid code joins one class. An unknown code shows an error. Joining twice must not create duplicates.',
        tags: ['AI', 'Study guides'],
        color: 'purple',
        publishedAt: '2026-10-13',
      },
      {
        id: 'pub-stories',
        noteId: 'community-stories',
        authorId: 'student-2',
        title: 'From user needs to user stories',
        description:
          'Turn research observations into clear stories and acceptance criteria, with worked examples.',
        content:
          '# From user needs to user stories\n\nStart with an observed need: a student repeatedly loses track of important lecture documents.\n\n## Story\n\nAs a student, I want one searchable place for classroom files so I can find the material I need before class.\n\n## Acceptance criteria\n\n1. Search matches titles without case sensitivity.\n2. An empty search shows all available materials.\n3. A search with no matches explains the empty result.\n\nValidate the story with a student before treating it as a settled requirement.',
        tags: ['Requirements', 'Product'],
        color: 'peach',
        publishedAt: '2026-10-12',
      },
      {
        id: 'pub-testing',
        noteId: 'community-testing',
        authorId: 'instructor-1',
        title: 'A little field guide to software testing',
        description:
          'What to test, why it matters, and how to turn a bug into a useful regression test.',
        content:
          '# A little field guide to software testing\n\nA useful test catches a realistic mistake. Start with the behavior a user needs, then choose the smallest check that protects it.\n\n## Three layers\n\n- Unit checks for pure transformations.\n- Integration checks for connected components.\n- Browser checks for important user journeys.\n\n## When you find a bug\n\nReproduce it with a failing check, change the implementation, and verify the whole relevant suite.\n\n## An example\n\nPublishing a note should create a snapshot. Changing your private draft should not silently change what other people see.',
        tags: ['Software engineering', 'Study guides'],
        color: 'blue',
        publishedAt: '2026-10-11',
      },
      {
        id: 'pub-research',
        noteId: 'community-research',
        authorId: 'student-2',
        title: 'Five questions for your next user interview',
        description:
          'Make your conversations more concrete and uncover the needs behind feature requests.',
        content:
          '# Five questions for your next user interview\n\n1. Tell me about the last time you did this.\n2. Can you show me the steps?\n3. Where did you get stuck?\n4. What workaround did you use?\n5. What did that cost you in time or effort?\n\nListen for real examples. Avoid leading questions about whether someone would use your idea.',
        tags: ['Research', 'Product'],
        color: 'pink',
        publishedAt: '2026-10-10',
      },
      {
        id: 'pub-links',
        noteId: 'community-links',
        authorId: 'instructor-1',
        title: 'Build a Wiki that grows with you',
        description:
          'Connect ideas, write in your own words, and turn scattered notes into lasting understanding.',
        content:
          '# Build a Wiki that grows with you\n\n## One note, one useful idea\n\nGive a note a descriptive title and explain the idea in your own words.\n\n## Make the connection explicit\n\nA link is more useful when you explain why the two ideas belong together.\n\n## Revisit your questions\n\nKeep open questions at the end of a note. Update it when a new class or project gives you better evidence.',
        tags: ['Learning', 'Study guides'],
        color: 'yellow',
        publishedAt: '2026-10-09',
      },
    ],
    bookmarks: [],
    conversations: [],
  };
}
