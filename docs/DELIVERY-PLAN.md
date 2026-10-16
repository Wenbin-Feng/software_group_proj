# Local source and CI integration

Date: 2026-10-16, Asia/Shanghai.

## Initial local-only scope

Integrate the existing approved Luma frontend into the fresh clone after its screenshot-only commit. Preserve the orphan history of `dev/WangJiahe`, complete the PDF preview, verify the runnable application, and commit locally. Then create `feature/wangjiahe-prototype-ci` from that application commit and add a checks/build/archive workflow. Do not push, deploy, merge, or change `main`.

The approved product scope remains in [the design](superpowers/specs/2026-10-15-learning-platform-design.md). Sign-in and AI remain explicitly simulated; this integration does not add a backend or new product features.

## Steps and completion evidence

1. Copy the source, dependency lockfile, startup script, and application documentation. Keep `images/` as the single screenshot directory and preserve the existing offline gallery.
2. Reproduce and resolve the interrupted PDF installation and TypeScript issue. Verify real PDF pages, navigation, and session-file recovery in the connected browser.
3. Run locked dependency installation, formatting, domain tests, TypeScript/Vite build, and README image checks. Review the final source before its local application commit.
4. Create the feature branch, add a feature-push-only workflow and CI documentation, validate YAML and the equivalent local commands, and commit. GitHub-hosted Actions cannot be claimed as executed before a later push.

## Integration decisions

- Use the user's explicitly requested fresh clone rather than creating a second worktree. The original prototype folder remains available as the source backup.
- Preserve the current 34 screenshots and add a real PDF capture only after its canvas content is visually verified. Do not copy the assignment PDF or `main` rule files into the prototype.
- Keep the application source on `dev/WangJiahe`; keep the workflow and CI-specific documentation on the separate feature branch.
- Keep local Node 24 and the pinned CI Node 22 runtime distinct in the verification record. Compatibility metadata is not a substitute for a hosted CI execution.

## Verified progress

- Source integration, PDF pages and recovery, fresh production smoke checks, 10 domain tests, formatting, build and 35-image documentation checks passed.
- The application was committed locally on `dev/WangJiahe`. Text files use LF consistently on Windows and Linux so that a branch checkout does not invalidate formatting checks.
- The separate `feature/wangjiahe-prototype-ci` branch now contains the workflow and its usage guide. Its equivalent local checks passed before the CI commit.

## Publication stage

After accepting the repository collaboration invitation, the user requested publication in the format required by `main` and illustrated by `dev/wenbin`: complete prototype source, a personal README, startup instructions, actual screenshots and verification records. Publish only `dev/WangJiahe` and `feature/wangjiahe-prototype-ci`; keep `main` and other member branches unchanged. Hosted CI results are tracked in GitHub Actions rather than inferred from local checks.
