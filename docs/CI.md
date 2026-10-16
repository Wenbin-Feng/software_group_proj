# Prototype checks, build and artifacts

The workflow is stored at `.github/workflows/prototype-ci.yml` on `dev/WangJiahe`, alongside the complete application, screenshots and this guide. The user chose to keep one prototype branch; the original feature-branch CI work is preserved in this branch's history.

The workflow runs only after a push to `dev/WangJiahe`. Pushes to `main` or other members' branches, pull requests and manual requests do not trigger it. A newer push to `dev/WangJiahe` cancels that branch's previous run. No merge into `main` is required.

Each run executes these gates in order:

1. Install the lockfile with pnpm 11.25.0 and `--frozen-lockfile`.
2. Check formatting with `pnpm run format:check`.
3. Run domain tests with `pnpm test`.
4. Type-check and build the Vite application with `pnpm build`.
5. Validate screenshots, catalog entries and documentation links with `pnpm run docs:check`.

After all gates succeed, the workflow uploads two artifacts and retains them for 14 days. The screenshot archive includes documentation so README links remain usable after extraction:

| Artifact                    | Contents                                                | How to use                                                                                                   |
| --------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `luma-dist-<commit>`        | The contents of `dist/`                                 | Extract and serve the production build with a static HTTP server.                                            |
| `luma-screenshots-<commit>` | `images/`, `gallery.html`, root `README.md` and `docs/` | Extract the complete archive and open `gallery.html`. Relative image links retain their directory structure. |

Download them from the successful GitHub Actions run's **Artifacts** section after the branch is pushed. The screenshots already exist in the repository; the workflow validates and archives them. It does not take new browser screenshots.

The job requests read-only repository contents access, disables checkout credential persistence and pins every action to an immutable commit. It needs no configured secrets and performs no deployment.

## Local validation and remote status

The workflow runs after `dev/WangJiahe` is pushed. [GitHub Actions](https://github.com/Wenbin-Feng/software_group_proj/actions) records the hosted run and its artifact uploads. Local checks are evidence for the project commands, not a claim that the hosted workflow passed.

On 16 October 2026, locked installation, formatting, all 10 domain tests, the TypeScript/Vite build and all 35 screenshot checks passed locally with Node 24.19.0 and pnpm 11.25.0. The workflow YAML was parsed, and its branch trigger, read-only permission, fixed action references, command sequence and archive paths were checked. Local ZIPs mirror the two artifact layouts in `output/`; they are not GitHub-hosted artifact downloads.

From the repository root, run the same project gates with:

```powershell
pnpm install --frozen-lockfile
pnpm run format:check
pnpm test
pnpm build
pnpm run docs:check
```

Use Node 22.23.3 and pnpm 11.25.0 to match CI exactly. Local verification used the bundled Node 24 runtime; see `docs/VERIFICATION.md` for the actual commands and outcomes. Check the `dev/WangJiahe` Actions run for hosted execution and archive availability.

## Version evidence

Versions and action references were checked against official sources on 16 October 2026:

| Component               | Pinned version                              | Official evidence                                                                                                           |
| ----------------------- | ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Project Node.js runtime | 22.23.3                                     | The [official release index](https://nodejs.org/dist/index.json) lists this Node 22 LTS release.                            |
| pnpm                    | 11.25.0                                     | [Package metadata](https://registry.npmjs.org/pnpm/11.25.0) declares Node `>=22.13`.                                        |
| Vite                    | 6.4.4, resolved by the application lockfile | [Package metadata](https://registry.npmjs.org/vite/6.4.4) supports Node `^18.0.0 \|\| ^20.0.0 \|\| >=22.0.0`.               |
| Vitest                  | 3.2.7, resolved by the application lockfile | [Package metadata](https://registry.npmjs.org/vitest/3.2.7) has the same Node engine range.                                 |
| Checkout                | v7.0.1                                      | [Official tag](https://github.com/actions/checkout/tree/v7.0.1), commit `3d3c42e5aac5ba805825da76410c181273ba90b1`.         |
| Set up Node             | v7.1.0                                      | [Official tag](https://github.com/actions/setup-node/tree/v7.1.0), commit `949feb2413d6458794dcd2491c4babbbce0c15c1`.       |
| Set up pnpm             | v6.1.0                                      | [Official tag](https://github.com/pnpm/action-setup/tree/v6.1.0), peeled commit `ea17c68df8912ef543352723c149a84f56e3d413`. |
| Upload artifact         | v7.0.2                                      | [Official tag](https://github.com/actions/upload-artifact/tree/v7.0.2), commit `cf430e030ddbb5b0abf93d22962f4752f3646cd9`.  |

The official action manifests declare their own Node 24 execution runtime, supplied by the GitHub-hosted runner. `setup-node` separately selects Node 22.23.3 for this project's shell commands. The Node engine ranges were checked for compatibility; they do not replace an actual run on the hosted runner.
