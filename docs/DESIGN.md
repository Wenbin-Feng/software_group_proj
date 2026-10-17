# Design rationale and future ideas

## Why this prototype exists

The group product already explores course files, AI question-answering, personal Wiki notes and teacher management. ReviewRoom AI explores a different part of the assignment brief: interactive role-play, soft skills and product skills in software development.

The design question is:

> Can a short guided simulation help a student practise how to explain a software decision, rather than only learn the correct technical answer?

This matters because a code review comment can be technically correct but still unhelpful if it has no evidence, no user impact and no actionable next step.

## Main user flow

```text
Choose scenario
    ↓
Read one communication goal
    ↓
Answer three prompts
    ↓
Receive focused coaching
    ↓
Review clarity / evidence / action
    ↓
Save one reflection for the next team discussion
```

The flow is intentionally short. A student should be able to finish one practice during a class activity or before a project meeting.

## Design decisions

### One skill per scenario

Each exercise has one visible goal. This reduces the feeling of chatting with an open-ended bot and gives the feedback a clear purpose.

### Evidence before scores

The feedback screen explains what was done well and what to improve. The three numbers are secondary and are labelled as a demo assessment, not a grade.

### Student and instructor perspectives

The student flow validates the learning interaction. Teacher Studio shows how an instructor could customise the same pattern without requiring a complete course-authoring system.

### Honest simulation

Prepared prompts and responses are enough to test navigation, pacing and usefulness. Connecting an LLM before validating those questions would add cost and uncertainty without proving that the learning design is good.

### Accessible, dependency-free frontend

The prototype uses labelled controls, keyboard focus, a skip link, reduced-motion support and responsive layouts. Plain HTML, CSS and JavaScript keep setup simple for group review.

## Ideas for a later integrated feature

These are proposals, not implemented claims:

1. **Course-linked scenarios:** a teacher creates a practice from a real lecture file or code example in Folio.
2. **Rubric-based AI feedback:** an LLM returns feedback against instructor-selected criteria, while the interface asks the student to review the advice critically.
3. **Evidence comparison:** show the student's first and second attempt side by side so improvement is visible.
4. **Peer calibration:** students compare two anonymised review comments and discuss which is more useful.
5. **Teacher insight without exposing private text:** show completion and common skill gaps while keeping the student's draft conversation private by default.
6. **AI Fluency reflection:** ask what was delegated to AI, how the output was checked, and who made the final decision.

## Questions for user validation

- Is an 8-minute activity short enough to use before a group meeting?
- Do students prefer typing a response, choosing between examples, or speaking aloud?
- Are the three feedback dimensions understandable without explanation?
- Would students feel comfortable if a teacher could read the full practice transcript?
- Should feedback appear after every response or only at the end?

## Known risks

- A language model may reward long answers instead of useful answers.
- Automated feedback could sound authoritative even when it is wrong.
- Students may optimise for a score rather than practise an authentic conversation.
- Saving full conversations could create privacy concerns.

A real implementation should use a transparent rubric, allow students to challenge the feedback, and avoid presenting the AI score as an objective grade.

