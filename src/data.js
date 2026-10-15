const source = (materialId, name, page) => ({ materialId, name, page });
const txName = "Week 04 — Transactions & concurrency.pdf";
const txSource = source("m-transactions", txName, 3);

export const initialData = {
  courses: [
    {
      id: "se",
      code: "COMP 4342",
      name: "Software Engineering",
      instructor: "Richard Lui",
      term: "Fall 2026",
      color: "#3156d3",
      description: "Build better software. Understand the thinking behind it.",
    },
    {
      id: "web",
      code: "COMP 3421",
      name: "Web Application Development",
      instructor: "Emily Chan",
      term: "Fall 2026",
      color: "#8b6ac0",
      description: "From browser fundamentals to thoughtful web experiences.",
    },
  ],
  students: [
    {
      id: "wenbin",
      name: "Wenbin Feng",
      studentId: "24010538G",
      initials: "WF",
      color: "#3156d3",
    },
    {
      id: "sarah",
      name: "Sarah Chen",
      studentId: "24010872G",
      initials: "SC",
      color: "#b16c4b",
    },
    {
      id: "alex",
      name: "Alex Wong",
      studentId: "24010316G",
      initials: "AW",
      color: "#53816f",
    },
    {
      id: "maya",
      name: "Maya Patel",
      studentId: "24010954G",
      initials: "MP",
      color: "#8c6bb0",
    },
  ],
  materials: [
    {
      id: "m-transactions",
      courseId: "se",
      ownerId: null,
      name: txName,
      type: "pdf",
      size: 1842300,
      uploadedAt: "2026-10-14T09:00:00+08:00",
      pages: [
        {
          page: 1,
          text: "Transactions & concurrency\nA transaction groups several data operations into one logical unit of work. A checkout flow might read inventory, reserve a product, create an order and update stock. The system must preserve its invariants even if requests overlap or fail.",
        },
        {
          page: 2,
          text: "ACID properties\nAtomicity: all operations complete, or their effects are rolled back. Consistency: a successful transaction preserves the rules of the data model. Isolation: concurrent work is separated according to an isolation level. Durability: committed changes survive a subsequent failure.",
        },
        {
          page: 3,
          text: "The lost update problem\nSuppose stock = 1. Request A reads stock = 1. Request B also reads stock = 1 before A writes. A creates an order and writes stock = 0. B creates another order and also writes stock = 0. Two orders were accepted for one item. A read-check-write sequence can race when requests operate on the same value.",
        },
        {
          page: 4,
          text: "Preventing overselling\nOne option is an atomic conditional update: UPDATE inventory SET stock = stock - 1 WHERE product_id = ? AND stock > 0. Check the affected-row count before accepting an order. Another option is a transaction that locks the inventory row while it checks and updates stock. Each strategy has trade-offs in waiting, retries and contention.",
        },
        {
          page: 5,
          text: "Isolation levels\nRead uncommitted permits dirty reads. Read committed prevents dirty reads but values can change between reads. Repeatable read typically provides a stable view for repeated reads, although exact guarantees differ by database. Serializable aims for results equivalent to a serial execution; implementations may block or abort a transaction that must be retried.",
        },
        {
          page: 6,
          text: "Reasoning exercise\nDraw a timeline for two requests competing for one remaining seat. Identify the point where the invariant bookings <= available seats can break. Compare a row-lock solution with an atomic conditional update. Explain where the losing request receives a clear outcome.",
        },
      ],
    },
    {
      id: "m-requirements",
      courseId: "se",
      ownerId: null,
      name: "Week 02 — Understanding requirements.pdf",
      type: "pdf",
      size: 960400,
      uploadedAt: "2026-10-09T09:00:00+08:00",
      pages: [
        {
          page: 1,
          text: "Understanding requirements\nA requirement describes an outcome or constraint that matters to a stakeholder. Begin by learning who has the problem, when it occurs, what they do today and how they will recognize an improvement.",
        },
        {
          page: 2,
          text: "Functional and non-functional requirements\nFunctional requirements describe what a system does, such as letting a student upload course notes. Quality requirements describe measurable expectations such as response time, accessibility, reliability and confidentiality. Avoid vague statements such as fast or user friendly without a testable criterion.",
        },
        {
          page: 3,
          text: "Acceptance criteria\nGiven a student belongs to a course, when they upload a supported file under the size limit, then it appears in their materials list and cannot be read by another student. Write observable outcomes and include failure cases such as an unsupported format or an unreadable file.",
        },
        {
          page: 4,
          text: "Clarification before implementation\nAsk for a concrete example, the current workaround, exceptions and the evidence needed to call the result successful. Separate facts reported by a user from ideas proposed by the team. Validate assumptions using a small prototype.",
        },
      ],
    },
    {
      id: "m-ai",
      courseId: "se",
      ownerId: null,
      name: "Week 03 — Working with AI agents.pdf",
      type: "pdf",
      size: 1286000,
      uploadedAt: "2026-10-12T09:00:00+08:00",
      pages: [
        {
          page: 1,
          text: "Working with AI agents\nDelegation starts with a clear objective, useful context, constraints and an observable completion condition. Give the agent enough information to make progress and require review at consequential boundaries.",
        },
        {
          page: 2,
          text: "Describe the task\nInclude the desired user behavior, relevant files, environment, examples and the checks that should pass. Define the scope. Avoid asking for a large system with no acceptance criteria.",
        },
        {
          page: 3,
          text: "Discernment and review\nRead the changes, inspect assumptions and compare the implementation with the actual user need. Generated code may look plausible while missing authorization checks, edge cases or failure states. Use appropriate tests and verify the running behavior.",
        },
        {
          page: 4,
          text: "Diligence\nThe team remains responsible for the result. Keep useful records of the task, decisions, human corrections and validation. Do not submit generated work that nobody can explain.",
        },
      ],
    },
    {
      id: "m-design",
      courseId: "se",
      ownerId: null,
      name: "Week 05 — Designing a learning platform.md",
      type: "md",
      size: 4400,
      uploadedAt: "2026-10-15T09:00:00+08:00",
      pages: [
        {
          page: 1,
          text: "# Designing a learning platform\n\nStart with actors: students and teachers. A course owns shared materials. A learning session belongs to one student and one course. An authorization check must use the authenticated identity rather than a student ID supplied by the browser.\n\n## Clear boundaries\n\nA student can access course materials and their own sessions. The assigned teacher can review learning activity within their course. A published wiki is an explicit snapshot chosen by its author.\n\n## Retrieval\n\nFilter candidate documents by access rules before retrieval. Preserve document and page references. Distinguish source-grounded statements from general explanation. An empty or scanned PDF needs a helpful failure message rather than invented extraction results.",
        },
      ],
    },
    {
      id: "m-wenbin-notes",
      courseId: "se",
      ownerId: "wenbin",
      name: "My concurrency questions.md",
      type: "md",
      size: 1640,
      uploadedAt: "2026-10-15T10:20:00+08:00",
      pages: [
        {
          page: 1,
          text: "# My concurrency questions\n\nWhy can two requests both buy the last item? If both read the same stock value before either writes, the read-check-write operation is not atomic.\n\nThings to explore: atomic updates, row locks, retries, and where to show an out-of-stock message.",
        },
      ],
    },
    {
      id: "m-sarah",
      courseId: "se",
      ownerId: "sarah",
      name: "Interview observations.md",
      type: "md",
      size: 1240,
      uploadedAt: "2026-10-14T14:30:00+08:00",
      pages: [
        {
          page: 1,
          text: "# Interview observations\n\nA learner struggled to turn lecture definitions into concrete examples. They wanted short worked examples and a visible connection to the original slide. Follow-up: test whether a step-by-step animation helps explain the concept.",
        },
      ],
    },
    {
      id: "m-alex",
      courseId: "se",
      ownerId: "alex",
      name: "Agent review checklist.txt",
      type: "txt",
      size: 890,
      uploadedAt: "2026-10-14T11:10:00+08:00",
      pages: [
        {
          page: 1,
          text: "Agent review checklist\n1. Confirm the user problem.\n2. Inspect changes and assumptions.\n3. Check access rules and failure states.\n4. Run the product and verify its behavior.\n5. Record the human corrections.",
        },
      ],
    },
    {
      id: "m-web",
      courseId: "web",
      ownerId: null,
      name: "Week 01 — The browser request cycle.md",
      type: "md",
      size: 2100,
      uploadedAt: "2026-10-13T09:00:00+08:00",
      pages: [
        {
          page: 1,
          text: "# The browser request cycle\n\nA browser turns a URL into a request. DNS resolves a hostname. A network connection carries an HTTP request to a server, which returns status, headers and a response body. The browser parses HTML, requests referenced assets, creates a DOM and CSSOM, and lays out and paints the page.\n\nUse the Network panel to inspect requests and the Elements panel to inspect the rendered document.",
        },
      ],
    },
  ],
  sessions: [
    {
      id: "s-wenbin-1",
      courseId: "se",
      studentId: "wenbin",
      title: "Why does the last item sell twice?",
      updatedAt: "2026-10-15T14:42:00+08:00",
      animation: "race",
      messages: [
        {
          id: "msg-1",
          role: "user",
          content:
            "I understand what a transaction is, but why can two people still buy the last item? Can you explain it visually?",
        },
        {
          id: "msg-2",
          role: "assistant",
          content:
            "The problem is the gap between reading stock and updating it. Both requests can read “1 item left” before either finishes. Each request believes it can proceed.\n\nImagine two cashiers checking the same shelf at the same moment: each sees the final item and accepts an order. The inventory value may still end at 0, while two orders have been created.\n\nStep through the animation to see the interleaving. Then switch on “Protect with a lock” to compare what changes.",
          sources: [txSource, source("m-transactions", txName, 4)],
        },
      ],
    },
    {
      id: "s-wenbin-2",
      courseId: "se",
      studentId: "wenbin",
      title: "Turning a user story into acceptance criteria",
      updatedAt: "2026-10-14T15:20:00+08:00",
      animation: null,
      messages: [
        {
          id: "msg-3",
          role: "user",
          content:
            "How do I make “students can upload documents” into a testable requirement?",
        },
        {
          id: "msg-4",
          role: "assistant",
          content:
            "Define the actor, supported input and observable outcome. For example: given an enrolled student, when they upload a supported PDF under 10 MB, the document appears in their private materials. Add explicit cases for unsupported formats, empty files and access by another student.",
          sources: [
            source(
              "m-requirements",
              "Week 02 — Understanding requirements.pdf",
              3,
            ),
          ],
        },
      ],
    },
    {
      id: "s-wenbin-3",
      courseId: "se",
      studentId: "wenbin",
      title: "How should I review AI-generated code?",
      updatedAt: "2026-10-13T11:05:00+08:00",
      animation: null,
      messages: [
        {
          id: "msg-5",
          role: "user",
          content:
            "The agent says the feature is done. What should I check before accepting it?",
        },
        {
          id: "msg-6",
          role: "assistant",
          content:
            "Start from the intended user behavior. Run it, inspect the changes, and check the assumptions. Look at failure states and permission boundaries as well as the successful path. Keep the checks proportional to the change and record any corrections you make.",
          sources: [source("m-ai", "Week 03 — Working with AI agents.pdf", 3)],
        },
      ],
    },
    {
      id: "s-sarah-1",
      courseId: "se",
      studentId: "sarah",
      title: "What makes a useful user interview?",
      updatedAt: "2026-10-15T13:15:00+08:00",
      animation: null,
      messages: [
        {
          id: "msg-s1",
          role: "user",
          content:
            "How can I ask about a learning problem without pushing my own solution?",
        },
        {
          id: "msg-s2",
          role: "assistant",
          content:
            "Ask about a recent real experience: what were they trying to do, what happened, and what did they try next? Ask for concrete examples before showing your concept. Separate observations from your interpretation.",
          sources: [
            source(
              "m-requirements",
              "Week 02 — Understanding requirements.pdf",
              4,
            ),
          ],
        },
      ],
    },
    {
      id: "s-alex-1",
      courseId: "se",
      studentId: "alex",
      title: "Choosing what to delegate to an AI agent",
      updatedAt: "2026-10-14T16:10:00+08:00",
      animation: null,
      messages: [
        {
          id: "msg-a1",
          role: "user",
          content:
            "What context should I include when delegating a component to an agent?",
        },
        {
          id: "msg-a2",
          role: "assistant",
          content:
            "Include the desired behavior, the relevant files, constraints, examples and a clear completion condition. Scope the task so the result can be reviewed. Explain any conventions the agent should follow.",
          sources: [source("m-ai", "Week 03 — Working with AI agents.pdf", 2)],
        },
      ],
    },
    {
      id: "s-maya-1",
      courseId: "se",
      studentId: "maya",
      title: "Serializable isolation and retries",
      updatedAt: "2026-10-15T10:48:00+08:00",
      animation: null,
      messages: [
        {
          id: "msg-m1",
          role: "user",
          content:
            "Why does a serializable transaction sometimes need a retry?",
        },
        {
          id: "msg-m2",
          role: "assistant",
          content:
            "The database may detect that concurrent transactions cannot both complete with a result equivalent to a serial order. It can abort one transaction so the application can retry it. The full transaction must be designed for a safe retry.",
          sources: [source("m-transactions", txName, 5)],
        },
      ],
    },
    {
      id: "s-wenbin-web",
      courseId: "web",
      studentId: "wenbin",
      title: "What happens after I enter a URL?",
      updatedAt: "2026-10-14T09:40:00+08:00",
      animation: "request",
      messages: [
        {
          id: "msg-w1",
          role: "user",
          content: "Walk me through how a browser loads a page.",
        },
        {
          id: "msg-w2",
          role: "assistant",
          content:
            "The browser resolves the hostname, establishes a connection and sends an HTTP request. It parses the response HTML, fetches referenced resources, then lays out and paints the page. The developer tools Network panel lets you inspect those requests.",
          sources: [
            source("m-web", "Week 01 — The browser request cycle.md", 1),
          ],
        },
      ],
    },
  ],
  notes: [
    {
      id: "n-transactions",
      courseId: "se",
      studentId: "wenbin",
      title: "Understanding race conditions",
      category: "Database systems",
      updatedAt: "2026-10-15T14:45:00+08:00",
      tags: ["concurrency", "transactions"],
      links: ["n-isolation", "n-atomic"],
      source: txSource,
      hasAnimation: true,
      content:
        "# Understanding race conditions\n\nA race condition occurs when the result depends on the timing of concurrent operations.\n\n## The last-item example\n\nTwo requests can read the same stock value before either writes a new value. Each accepts an order, so the application oversells even though the final stock value looks valid.\n\n1. Request A reads stock = 1.\n2. Request B reads stock = 1.\n3. Both decide the purchase is allowed.\n4. Both write stock = 0.\n\n## Why it matters\n\nA transaction alone does not explain which operations are protected. Check the isolation level and the exact read/write sequence. See [[Isolation levels]] and [[Atomic operations]].\n\n## My mental model\n\nReading an available item is an observation. Reserving it must be a protected change.\n\n> Learning check: can I point to the exact step where the invariant breaks?",
    },
    {
      id: "n-isolation",
      courseId: "se",
      studentId: "wenbin",
      title: "Isolation levels",
      category: "Database systems",
      updatedAt: "2026-10-15T11:30:00+08:00",
      tags: ["database", "ACID"],
      links: ["n-transactions"],
      source: source("m-transactions", txName, 5),
      hasAnimation: false,
      content:
        "# Isolation levels\n\nIsolation defines how concurrent transactions interact. Exact guarantees depend on the database.\n\n## A useful ladder\n\n- Read uncommitted: dirty reads may occur.\n- Read committed: prevents dirty reads, but repeated reads can change.\n- Repeatable read: typically gives a stable view for repeated reads.\n- Serializable: aims for a result equivalent to serial execution; retries may be needed.\n\n## Connection\n\n[[Understanding race conditions]] shows why the behavior of concurrent reads and writes matters.\n\n## Still exploring\n\nHow do snapshot isolation and row locks differ in the database used by our project?",
    },
    {
      id: "n-atomic",
      courseId: "se",
      studentId: "wenbin",
      title: "Atomic operations",
      category: "Database systems",
      updatedAt: "2026-10-14T17:00:00+08:00",
      tags: ["concurrency", "SQL"],
      links: ["n-transactions", "n-isolation"],
      source: source("m-transactions", txName, 4),
      hasAnimation: false,
      content:
        "# Atomic operations\n\nAn atomic operation completes as one indivisible change from the perspective of competing work.\n\n## Inventory update\n\nUse a conditional update that decrements stock only when it is positive. Check the affected-row count before accepting an order.\n\nThe check and change happen together. This removes the vulnerable gap in a separate read-check-write flow.\n\n## Related\n\n[[Understanding race conditions]] · [[Isolation levels]]",
    },
    {
      id: "n-requirements",
      courseId: "se",
      studentId: "wenbin",
      title: "From user stories to testable requirements",
      category: "Requirements",
      updatedAt: "2026-10-14T15:35:00+08:00",
      tags: ["user stories", "acceptance criteria"],
      links: [],
      source: source(
        "m-requirements",
        "Week 02 — Understanding requirements.pdf",
        3,
      ),
      hasAnimation: false,
      content:
        "# From user stories to testable requirements\n\nA story expresses a need. Acceptance criteria make success observable.\n\n## Example: document upload\n\nGiven an enrolled student, when they upload a supported file under the size limit, it appears in their private materials.\n\n## Questions to ask\n\n- Which file formats are accepted?\n- What happens when extraction fails?\n- Who can access the file?\n- How does the student know the upload worked?\n\n> Start with a concrete example and include the failure path.",
    },
    {
      id: "n-sarah",
      courseId: "se",
      studentId: "sarah",
      title: "Better questions, better requirements",
      category: "Requirements",
      updatedAt: "2026-10-15T13:30:00+08:00",
      tags: ["interviews", "discovery"],
      links: [],
      hasAnimation: false,
      content:
        "# Better questions, better requirements\n\nAsk about recent behavior before asking someone to predict future behavior.\n\n## Three prompts\n\n1. Tell me about the last time this happened.\n2. What did you try next?\n3. What made that difficult?\n\nSeparate observations from interpretations. Validate the proposed solution with a small prototype.",
    },
    {
      id: "n-alex",
      courseId: "se",
      studentId: "alex",
      title: "A practical AI agent checklist",
      category: "AI collaboration",
      updatedAt: "2026-10-14T16:20:00+08:00",
      tags: ["AI agents", "review"],
      links: [],
      hasAnimation: false,
      content:
        "# A practical AI agent checklist\n\n## Before delegation\n\nDescribe the outcome, context, constraints and acceptance criteria.\n\n## During review\n\nRead the changes. Check assumptions. Run the behavior. Exercise failure states.\n\n## After completion\n\nDocument meaningful corrections and what the team learned.",
    },
    {
      id: "n-maya",
      courseId: "se",
      studentId: "maya",
      title: "A visual guide to ACID",
      category: "Database systems",
      updatedAt: "2026-10-15T10:55:00+08:00",
      tags: ["ACID", "transactions"],
      links: [],
      hasAnimation: true,
      content:
        "# A visual guide to ACID\n\n- Atomicity: the whole unit of work succeeds, or it is rolled back.\n- Consistency: valid transactions preserve data rules.\n- Isolation: concurrent work is separated according to a defined level.\n- Durability: committed data survives a subsequent failure.\n\n## Remember\n\nACID properties solve different problems. Use a concrete transaction to explain what each property protects.",
    },
    {
      id: "n-web",
      courseId: "web",
      studentId: "wenbin",
      title: "The life of a web request",
      category: "Web fundamentals",
      updatedAt: "2026-10-14T09:50:00+08:00",
      tags: ["HTTP", "browser"],
      links: [],
      hasAnimation: true,
      source: source("m-web", "Week 01 — The browser request cycle.md", 1),
      content:
        "# The life of a web request\n\nURL → DNS → connection → HTTP request → response → parsing → layout → paint.\n\nThe browser discovers additional resources while parsing the page. Open the Network panel to inspect the order and timing of requests.",
    },
  ],
  market: [
    {
      id: "market-maya",
      noteId: "n-maya",
      courseId: "se",
      title: "A visual guide to ACID",
      description:
        "Four properties, one checkout flow. A visual explanation with an interactive example.",
      author: "Maya Patel",
      authorId: "maya",
      initials: "MP",
      color: "#8c6bb0",
      category: "Database systems",
      tags: ["ACID", "visual guide"],
      likes: 24,
      bookmarkedBy: [],
      version: 2,
      updatedAt: "2026-10-15T10:55:00+08:00",
      hasAnimation: true,
      content:
        "# A visual guide to ACID\n\nUse a checkout flow to understand all four properties.\n\n## Atomicity\n\nThe order and inventory update complete together, or both are rolled back.\n\n## Consistency\n\nAn accepted order must preserve the rules of the data model.\n\n## Isolation\n\nConcurrent orders must respect the database isolation guarantees.\n\n## Durability\n\nA committed order survives a subsequent failure.\n\n> Try explaining each property without using its definition.",
    },
    {
      id: "market-sarah",
      noteId: "n-sarah",
      courseId: "se",
      title: "Better questions, better requirements",
      description:
        "My interview field guide for finding the problem behind a feature request.",
      author: "Sarah Chen",
      authorId: "sarah",
      initials: "SC",
      color: "#b16c4b",
      category: "Requirements",
      tags: ["interviews", "field notes"],
      likes: 18,
      bookmarkedBy: ["wenbin"],
      version: 1,
      updatedAt: "2026-10-14T13:30:00+08:00",
      hasAnimation: false,
      content:
        "# Better questions, better requirements\n\nAsk about a recent concrete experience.\n\n1. Tell me about the last time this happened.\n2. What did you try next?\n3. What made that difficult?\n\n## After the interview\n\nRecord the observation, your interpretation and what still needs evidence separately. A feature request is a starting point for a conversation.",
    },
    {
      id: "market-alex",
      noteId: "n-alex",
      courseId: "se",
      title: "Your first AI coding teammate",
      description:
        "A compact checklist for delegating clearly and reviewing the result with confidence.",
      author: "Alex Wong",
      authorId: "alex",
      initials: "AW",
      color: "#53816f",
      category: "AI collaboration",
      tags: ["AI agents", "checklist"],
      likes: 15,
      bookmarkedBy: [],
      version: 1,
      updatedAt: "2026-10-14T16:20:00+08:00",
      hasAnimation: false,
      content:
        "# Your first AI coding teammate\n\n## Give the task a useful boundary\n\nExplain the desired outcome, relevant context, constraints and what done means.\n\n## Review the work\n\nInspect the changes, verify the assumptions and exercise the running behavior. Test permission boundaries and failure states when relevant.\n\n## Own the result\n\nKeep a record of the meaningful corrections. Make sure the team can explain what was built.",
    },
    {
      id: "market-wenbin",
      noteId: "n-transactions",
      courseId: "se",
      title: "Understanding race conditions",
      description:
        "Why two people can buy the last item — and the one step that changes everything.",
      author: "Wenbin Feng",
      authorId: "wenbin",
      initials: "WF",
      color: "#3156d3",
      category: "Database systems",
      tags: ["concurrency", "animation"],
      likes: 12,
      bookmarkedBy: [],
      version: 1,
      updatedAt: "2026-10-15T14:45:00+08:00",
      hasAnimation: true,
      content:
        "# Understanding race conditions\n\nTwo requests can read the same stock value before either writes. Both decide a purchase is allowed, so the system accepts two orders for one item.\n\n## The vulnerable gap\n\nRead → check → write are separate steps. The gap lets concurrent requests act on the same observation.\n\n## A solution to compare\n\nUse an atomic conditional update and check whether a row was changed. A losing request receives an out-of-stock outcome.\n\n## Learning check\n\nCan you point to the exact step where the inventory invariant breaks?",
    },
  ],
};

initialData.materials = initialData.materials.map((material) => ({
  ...material,
  text: material.pages.map((p) => p.text).join("\n\n"),
}));
export default initialData;
