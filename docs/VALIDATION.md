# Validation record

**Date:** 17 October 2026  
**Prototype:** ReviewRoom AI  
**Branch:** `dev/LICK_Alex`

## Environment

- Local HTTP server on `127.0.0.1:4173`
- Google Chrome
- Desktop viewport: 1440 × 900
- Mobile viewport: 390 × 844
- No network API, account or secret used

## Browser flow exercised

| Check | Result |
| --- | --- |
| Home renders the hero, three scenario cards and learning snapshot | Pass |
| Start the pull-request scenario from the main call to action | Pass |
| Submit three responses and advance through all three prompts | Pass |
| Short-answer guard rejects a response under 12 characters without advancing | Pass |
| Complete the session and open the feedback screen | Pass |
| Feedback shows summary, three skill dimensions and reflection field | Pass |
| Open Code Review Lab and reveal the HTTP-status explanation | Pass |
| Open Teacher Studio, edit title and learning goal, and save locally | Pass |
| Saved Teacher Studio values update the student preview | Pass |
| Navigate back to Home at 390 × 844 and inspect the full mobile page | Pass |
| Check that the mobile document width does not exceed the viewport | Pass |
| Reload and confirm the locally saved teacher title is restored | Pass |
| JavaScript console errors or uncaught page errors during checked flow | None |

## Test answers used

1. “I would ask whether an empty result could hide a service failure and affect the student.”
2. “A smooth screen is useful, but hiding the error makes support and recovery harder because nobody knows the request failed.”
3. “I suggest returning an error state and adding tests for a timeout and a server error.”

These answers exercise the full flow; the prototype does not semantically evaluate their content.

## Visual review

Six screenshots were captured from the running application and reviewed:

- desktop home and scenario library
- role-play workspace
- feedback and reflection
- Code Review Lab
- Teacher Studio after editing a draft
- full mobile home page

The checked screenshots show readable text, aligned cards and controls, no horizontal overflow at the tested widths, and a clear “No real AI call” label.

## Not yet validated

- External student or instructor feedback
- Screen-reader testing beyond semantic labels and keyboard-focus support
- Other browsers
- Real LLM response quality or safety
- Shared accounts, classes, server persistence or analytics

## Study cards addition — 17 October 2026

Local automated Chrome checks passed **67 assertions**, with zero console or uncaught page errors in the exercised flows. An isolated headless Chrome profile was used; no signed-in user profile was accessed. The local QA runner is outside the application repository.

| Check | Result |
| --- | --- |
| All three concepts: first-card boundary, forward/back navigation and academic caveat | Pass |
| All six workplace examples: switch, wrap and retain selected example on returning | Pass |
| Changed card receives keyboard focus | Pass |
| Speech: start, pause, resume, stop, completion, selected language and speed | Pass with mocked speech engine |
| Duplicate play prevented; card/example/topic/view changes cancel narration | Pass with mocked speech engine |
| Canceled speech callbacks cannot overwrite the new card's state | Pass with mocked speech engine |
| Speech errors, thrown failures and no-start timeout show readable fallback | Pass with mocked speech engine |
| Missing or late-loaded voices update controls; absent speech API leaves cards readable | Pass with mocked / absent APIs |
| Study card links to the matching existing practice | Pass |
| Existing three-prompt practice, short-answer guard, feedback and saved reflection | Pass |
| Existing three code-review concerns and teacher-draft persistence after reload | Pass |
| All three topics at widths 320, 390, 768, 930, 1024 and 1440 pixels | No horizontal overflow |

### Visual checks

New desktop and mobile Study cards screenshots were captured from the running application using **native**, not mocked, voice availability. Home screenshots were refreshed to include the new entry point. Card hierarchy, wrapping, navigation and the unavailable-audio message were inspected. Full-page screenshots were taken from scroll position zero to avoid misrepresenting the sticky header.

### Audio limits of this test

The native headless browser returned an empty voice list. The UI therefore disabled playback and displayed its fallback. The host's legacy Windows speech listing exposed only an English voice; that listing is not a guarantee of what every browser can provide. Audible output, Cantonese pronunciation, real pause/resume, network voice behaviour, phone lock-screen playback and Bluetooth/headphone behaviour **have not been verified**. Mocked engine checks validate UI state transitions, not sound quality or device support.

### Manual review before a demonstration

1. Open Study cards in the intended browser and check whether a Chinese voice appears.
2. If available, listen to one complete card, pause/resume and change cards while it plays. Confirm that the old card stops and the displayed language matches what is heard.
3. On a phone, check text size and controls. Do not assume audio will continue after locking the screen.
4. Ask a learner to explain the term after reading its example; no learning-outcome claim has been established by the automated tests.
