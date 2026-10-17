# Folio deployment

Production deploys **only when `release` changes**, including a merge or direct push. Development pushes and PRs run CI. A manual release workflow also checks that the selected ref is `release`. Vercel Git deployments are disabled in `vercel.json`; the release workflow promotes the frontend only after the matching Azure backend is healthy.

## Setup status, 17 October 2026

The VM prerequisites, persistent directories, root-only server environment, SSH deployment secrets, Vercel deployment token, and backup/renewal timers are configured. A real isolated SQLite/file backup test passed. The initial Azure inbound-port block was resolved on 17 October 2026: the public HTTP challenge preflight and HTTPS certificate validation both passed. A trusted Let's Encrypt IP certificate is installed, and the six-hourly renewal timer is enabled. Langfuse runtime configuration is present with root-only permissions and outbound authentication has passed. Application deployment status is established by the release workflow and public frontend/API smoke checks, rather than infrastructure readiness alone.

Both CI verification jobs build and run browser integration checks with synthetic wallets, a temporary SQLite database, and a local mock AI provider. They upload screenshots and a generated test PPTX under `test-results/` even when a test fails, retaining artifacts for seven days. This checks real browser/API interactions without using the production database or making paid AI calls. Both verification jobs also build the actual Linux backend image, run native SQLite migrations, and check non-root API startup and version using temporary storage with no credentials, network access, or published ports. The production job runs only after the release verification job succeeds.

## Accounts, courses, and generation

The frontend uses React/Vite in `apps/web`; Fastify, the SQLite/Drizzle store, off-chain SIWE verification, and the embedded generation worker live in `apps/api`. Google is the primary sign-in option, with MetaMask retained. First login asks for a display name and **Student or Teacher** role; students also provide a student number. The chosen role is persisted by the backend and becomes immutable after onboarding. Existing wallet users link Google explicitly from Your account; Google users do not need a wallet. There is no teacher-wallet whitelist in this version. A login signature sends no blockchain transaction and costs zero Gas; model calls use the configured provider account separately.

Teachers create courses and share/reset their join codes; students join by code. Teachers may only manage their own courses and see enrolled students' sessions/uploads read-only; private student Wiki metadata and contents remain inaccessible. Sample course materials are seeded on a fresh database with student join codes `FOLIO-SE` and `FOLIO-WEB`, without copying browser prototype records into real accounts.

The provider defaults to `qwen/qwen3.6-plus` and is configurable by `H2A_LLM_MODEL`. The default per-account UTC-day quotas are 60 chat requests and 10 combined courseware/visualization generations. Configure `H2A_DAILY_CHAT_LIMIT` and `H2A_DAILY_GENERATION_LIMIT` on the backend to change them. Failed provider calls and user retries consume quota. One worker runs generation jobs; an account may have two queued/running jobs, with at most three attempts per task. Existing exports can be downloaded without another model call.

Uploads accept text-based PDF, Markdown, and UTF-8 plain text up to 10 MB, with a 500-page/2-million-character PDF extraction bound and no OCR. AI requests select at most 30 accessible active materials. Teachers generate 1–20 slides (default 10), choose English/simplified/traditional Chinese, edit the validated slide structure, then preview HTML or download native editable 16:9 PPTX text, tables, and basic shapes. Drafts stay private until published. The renderer supports Folio-generated structured decks; arbitrary external HTML and executable PowerPoint animations are outside this version.

## Runtime layout

- Frontend: separate Vercel project `folio-group-project`, repository root directory, Node.js 24. Build output: `apps/web/dist`.
- API and embedded task worker: prebuilt `folio-api:<commit SHA>` Docker image, Node.js 24, container user 1000, loopback-only `127.0.0.1:3001`.
- Public API: Nginx at `https://20.164.17.72/api/`, proxied by Vercel `/api`. Browser cookies stay on the Vercel origin.
- Persistent SQLite, files, and generated decks: `/srv/folio/data`. Runtime environment: `/srv/folio/server.env`, root-owned mode 600. Backups: `/srv/folio/backups`, root-only. Secrets and production data are never part of a Docker image or Git commit.

The API checks `ORIGIN_SECRET` supplied by the Vercel proxy. Put the same randomly generated value in **Vercel production environment variables** and the server environment. It must not use a `VITE_` prefix. The browser never needs the OpenRouter key or origin secret. Authentication and private API responses disable both browser and CDN caching.

## First-time server setup

Copy `deploy/` to the existing SSH account, then run on the VM:

```sh
sudo bash deploy/provision.sh azureuserwjh 20.164.17.72
```

The idempotent script installs Docker, Nginx, SQLite tools, and a dedicated Certbot virtualenv (5.4 or later). It preserves existing application data, certificates, and other Nginx sites. It installs daily backup and six-hourly certificate-renewal timers.

From outside Azure, verify that this returns `folio-http-preflight`:

```sh
curl --fail http://20.164.17.72/.well-known/acme-challenge/folio-preflight
```

The server administrator must allow inbound TCP **80 and 443** in Azure networking. SSH access cannot change an Azure security group. Do not issue a certificate until the HTTP check works; 443 must also be reachable after Nginx starts listening there.

Create `/srv/folio/server.env` from `.env.example` without printing secret values, with these production overrides:

```dotenv
NODE_ENV=production
PORT=3001
DATA_DIR=/data
APP_PUBLIC_URL=https://folio-group-project.vercel.app
ORIGIN_SECRET=<random shared proxy secret>
H2A_LLM_BASE_URL=https://openrouter.ai/api/v1
H2A_LLM_API_KEY=<existing OpenRouter key>
H2A_LLM_MODEL=qwen/qwen3.6-plus
H2A_DAILY_CHAT_LIMIT=60
H2A_DAILY_GENERATION_LIMIT=10
LANGFUSE_PUBLIC_KEY=<Langfuse project public key>
LANGFUSE_SECRET_KEY=<Langfuse project secret key>
LANGFUSE_BASE_URL=https://jp.cloud.langfuse.com
LANGFUSE_TRACING_ENVIRONMENT=production
GOOGLE_CLIENT_ID=<Google OAuth Web application client ID>
GOOGLE_CLIENT_SECRET=<Google OAuth client secret>
```

Then run `sudo chmod 600 /srv/folio/server.env` and `sudo bash /srv/folio/bin/enable-https.sh`. The script requests a trusted, short-lived IP certificate and switches Nginx to HTTPS. Set `ACME_EMAIL` when running it if certificate account notices should go to a known email address. Without it, renewal still runs automatically. The deploy hook tests and reloads Nginx after renewal.

Google credentials also stay in the API runtime environment. Register `https://folio-group-project.vercel.app/api/auth/google/callback` in Google Cloud. This domain callback passes through the existing Vercel proxy; the Azure IP is not the Google redirect URI. The application derives the callback from `APP_PUBLIC_URL`. Apply the updated Folio Nginx HTTPS template (which logs paths without OAuth query strings), test its configuration, and reload it before enabling Google on an existing installation. OAuth state lives in SQLite, expires after ten minutes, and survives restarts. Database migrations retain the original four-column auth session table for rollback compatibility.

Langfuse credentials belong only in this root-readable runtime environment, not Vercel frontend variables, GitHub build logs, or images. The release image reads them through the existing Docker environment file, so future releases retain the configuration. Tracing uses outbound HTTPS and does not require opening an additional public port. The API batches exports and flushes after requests and workers drain during graceful shutdown. Set `LANGFUSE_ENABLED=false` to temporarily disable tracing; missing credentials also disable it. The optional live test documented in the README checks real ingestion in the separate `test` environment and is never run automatically by CI or releases.

[Let's Encrypt's Certbot IP certificate instructions](https://letsencrypt.org/2026/03/11/shorter-certs-certbot) require Certbot 5.4+ for webroot support, the `shortlived` profile, and explicit webserver certificate installation. Check `sudo systemctl list-timers folio-*` and periodically inspect `journalctl -u folio-certbot-renew.service`; IP certificates are valid for approximately six days.

## GitHub and Vercel configuration

Configure these in **Wenbin-Feng/software_group_proj**, separately from the DApp repository:

| Kind | Name | Value |
| --- | --- | --- |
| Secret | `DEPLOY_SSH_KEY` | Authorized deployment private key, never committed |
| Secret | `DEPLOY_KNOWN_HOSTS` | Verified existing SSH host-key entries for `20.164.17.72` |
| Secret | `VERCEL_TOKEN` | Vercel token permitted to deploy the Folio project |
| Secret, optional | `VERCEL_AUTOMATION_BYPASS_SECRET` | Needed if staged deployment protection is enabled |
| Variable | `VERCEL_ORG_ID` | Folio Vercel organization/team ID |
| Variable | `VERCEL_PROJECT_ID` | Folio Vercel project ID |
| Variable | `APP_PUBLIC_URL` | Production origin, default `https://folio-group-project.vercel.app` |
| Variable, optional | `DEPLOY_HOST` | Defaults to `20.164.17.72` |
| Variable, optional | `DEPLOY_USER` | Defaults to `azureuserwjh` |

The SSH account currently requires noninteractive sudo for the release helpers. Keep the server's verified host key pinned; never use `StrictHostKeyChecking=no` or trust a fresh key scan without checking its fingerprint. Add `ORIGIN_SECRET` to the Folio project's **production** Vercel environment before the first release. Set the project's production branch to `release` for dashboard consistency, even though Git-triggered Vercel deploys are disabled.

## Database updates and rollback

Developers commit incremental Drizzle SQL migration files with the application. **No manual SQL is needed for normal releases.** The release workflow builds on a Linux runner, uploads the image, stops application writers briefly, backs up the database and files, and runs the image's migration entry point. Only unapplied migrations execute, including initial schema creation. A migration failure stops the release and restarts the previous application.

The release then starts the API/worker and requires `/api/health` to report both `status: "ok"` and the exact commit SHA. It stages a matching production frontend, tests the actual Vercel-to-Azure HTTPS proxy, promotes the frontend, and verifies the public URL. Failure restores the previous application/frontend where a previous version exists. First deployment has no earlier version to restore.

Rollback **does not undo SQL or restore a database automatically**. Use compatible, additive migrations; remove old columns only after a separate reviewed cleanup. The database and files remain in place across container replacement and reboot. To revert a backend after a known failed deployment:

```sh
sudo /srv/folio/bin/rollback.sh <failed-commit-sha>
```

Pair an operational rollback with a revert on `release` so the next pipeline deploys the intended code. Vercel's previous deployment can be promoted from the dashboard or CLI; the workflow captures it before promotion.

## Backups and recovery

A timer runs daily around 02:15 in the VM's timezone and each release takes another snapshot. The backup briefly stops writers, uses SQLite `.backup` plus `PRAGMA quick_check`, and archives the associated files. The original container is restarted even if a daily backup fails. Completed backups are retained for seven full days. Check `journalctl -u folio-backup.service` and copy important backups off the VM; backups on the same VM do not protect against losing that VM.

To restore, stop `folio-api`, preserve a copy of the current data, select a completed snapshot, restore its `folio.sqlite` and `files.tar.gz`, remove stale WAL/SHM files, restore ownership to UID/GID 1000, then start the matching saved application image. Restoring a backup intentionally loses writes made after that snapshot and is a manual recovery action, never an automatic deployment step.

The VM performs no npm builds. The current 2 CPU / 4 GB configuration runs one API process and one embedded task worker, and persists task state in SQLite so interrupted jobs can recover after restart. Use `sudo docker logs --tail 100 folio-api`, `sudo docker inspect folio-api`, and the two systemd timer logs for diagnostics. Deployment archives remain under `/srv/folio/incoming/<sha>`; keep the active and previous image available for rollback when cleaning older Folio-only images.
