# Prototype delivery and branch layout

Date: 2026-10-16, Asia/Shanghai.

## Current arrangement

Keep the application, README, 35 screenshots, verification records and CI workflow together on `dev/WangJiahe`. The user requested removal of the extra feature branch after the initial publication. CI now responds only to pushes to `dev/WangJiahe`, checking, building and archiving artifacts without deployment. Keep `main` and every other member's branch unchanged.

The approved product scope remains in [the design](superpowers/specs/2026-10-15-learning-platform-design.md). Sign-in and AI remain explicitly simulated; the branch simplification does not add a backend or change application behavior.

## Recorded milestones

1. Cloned the original repository into a new local directory and created the orphan `dev/WangJiahe` root. Preserved the original prototype folder as a source backup.
2. Committed the screenshot package, then integrated the complete frontend, dependency lockfile, startup script and application documentation. Kept `images/` as the single screenshot directory.
3. Completed PDF.js installation and rendering, verified pages and session recovery, and expanded the gallery to 35 actual screenshots. Passed locked installation, formatting, 10 domain tests, production build and image-documentation checks.
4. Initially configured CI on `feature/wangjiahe-prototype-ci` and published both branches following the repository's prototype format. Hosted run 38885667323 passed all checks and both artifact uploads.
5. Following the user's preference for one branch, preserved all feature commits by fast-forwarding `dev/WangJiahe`. Updated the workflow trigger and documentation. Remove the old feature reference after the migrated workflow passes remotely.

## Preservation and verification

- No prototype code, assignment PDF or rules were inherited from `main` or another member's prototype.
- Deleting the old feature branch does not discard its commits: they remain ancestors of `dev/WangJiahe`.
- Text files use LF consistently on Windows and Linux so that a checkout does not invalidate formatting checks.
- The application is verified locally with Node 24.19.0 and pnpm 11.25.0; hosted CI uses Node 22.23.3. GitHub Actions records actual hosted results.
- The main and Wenbin branch references are checked before and after branch cleanup. There is no deployment or merge into `main`.
