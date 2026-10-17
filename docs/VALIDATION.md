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
