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

## Study cards: a smaller entry point

The additional design question is: can a familiar workplace situation help a learner reconnect an academic term with something concrete during a short study window?

The optional flow is **plain language → workplace example → connection back to the term**. Three concepts cover technical design, project scope and verification. Each offers two fictional examples from office software projects, such as changing an email provider, negotiating an export feature or agreeing expense-form acceptance criteria. The final card includes a caveat so the example does not replace the definition.

Short cards and read-aloud share the same text. No quiz is required to unlock an explanation. A learner can stop after a card or enter an existing role-play; the existing practice flow, scores and teacher drafts are unchanged. Traditional Chinese explanations retain the English terminology learners are likely to encounter in technical material.

Speech uses the browser's available Chinese voices, with a preference for `zh-HK` / `yue`, then `zh-TW`. The interface shows the actual voice language and remains usable without audio. Nothing plays automatically. Changing the card, example, concept or view cancels narration. Speech completion does not turn the page or mark a concept as mastered.

Content, rendering and styles are separated into `study-data.js`, `study.js` and `study.css`, with small navigation hooks in the existing application. There is no slide parser, generated explanation, new backend or uploaded audio.

Validation still needed: whether the examples help students explain the terms unaided, whether one card fits their available time, and audible narration on real commuter devices. If integrated into Folio later, teacher-reviewed cards could link to the relevant course source; this is not implemented yet.

### Further reading used to check the examples

- [Microsoft: Architectural principles](https://learn.microsoft.com/en-us/dotnet/architecture/modern-web-apps-azure/architectural-principles) — loose coupling and explicit interfaces.
- [The Scrum Guide: The Sprint](https://scrumguides.org/scrum-guide.html#the-sprint) — scope negotiation without endangering the Sprint Goal.
- [Scrum Alliance: Acceptance criteria](https://resources.scrumalliance.org/Article/need-know-acceptance-criteria) — testable, item-specific conditions and their distinction from the Definition of Done.
- [MDN: SpeechSynthesis](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesis) — voice discovery and playback lifecycle.

These are external references, not the course's assigned slides. Examples were written for this prototype.

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
