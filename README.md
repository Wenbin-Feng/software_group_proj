# Folio

**Make it make sense.** A course companion for learning from materials, asking questions, exploring visual explanations, and building a connected personal Wiki.

The `dev/wenbin-final` implementation separates a React/Vite frontend from a Node.js 24/Fastify API. Google and wallet accounts, permissions, courses, files, conversations, Wiki publications, Inbox messages, and generation jobs persist on the server in SQLite. It builds on the earlier `dev/wenbin` prototype; the existing `main` branch has a separate history.

## Run locally

Use **Node.js 24** and npm. From the repository root:

```sh
npm ci
cp .env.example .env
```

Edit `.env` locally. For AI features, provide `H2A_LLM_API_KEY`; the default base URL is OpenRouter and the default model is `qwen/qwen3.6-plus`. Keep all `H2A_` variables on the backend. No secret should have a `VITE_` prefix or be committed.

Start the API in one terminal:

```sh
node --env-file=.env --import tsx --watch apps/api/src/server.ts
```

Start the frontend in another terminal:

```sh
npm run dev
```

Open [http://127.0.0.1:5173](http://127.0.0.1:5173), matching `APP_PUBLIC_URL` in `.env`. Vite proxies `/api` to the API at `127.0.0.1:3001`. Local data and original files stay in `.data/`; restarting the processes preserves them. Database migrations run automatically when the backend starts. To run them explicitly:

```sh
node --env-file=.env --import tsx apps/api/src/migrate.ts
```

For a compiled backend and production frontend build:

```sh
npm run build
node --env-file=.env apps/api/dist/server.js
```

`apps/web/dist` contains the frontend. Deploy it with the API proxy configuration; serving only those static files does not provide accounts or persistence.

## Accounts and courses

- Choose **Continue with Google** to sign in without a wallet. Google requests only `openid email profile`. An existing wallet user can open **Settings → Connect Google** before switching methods; this keeps the same account, courses, sessions, and Wiki. Accounts are never automatically merged by email.
- Alternatively, connect MetaMask and sign the server-generated login message. This is an off-chain signature: login sends no transaction and costs **zero Gas**. The server validates a five-minute, one-time challenge and stores a seven-day HttpOnly session.
- On first login, enter a display name and select **Student** or **Teacher**. Students also enter a student number. Open **Account settings → Settings** to change your name, student number, or role later. Saving a role change loads the matching workspace for the same account; courses, enrollments, conversations, and private Wiki remain stored and return when you switch back. Student numbers are self-reported information.
- Teachers create courses with a name, course code, and description, then share the generated student join code. They can reset that code. Students join using the code.
- Fresh databases contain sample course materials. Students can try `FOLIO-SE` or `FOLIO-WEB` as join codes. A teacher creates their own course to manage materials, students, Inbox, and courseware.
- Google identities use the stable Google `sub`; a wallet is optional. Existing ordinary Ethereum wallet accounts remain supported. Google and wallet sessions use the same seven-day HttpOnly cookie; switching an installed wallet does not sign out a Google session. Wallet recovery and contract-wallet signatures are outside this version.

## Configure Google sign-in

Create an OAuth **Web application** client in Google Cloud, with External audience and only the basic `openid email profile` scopes. Register the exact authorized redirect URI:

```text
https://folio-group-project.vercel.app/api/auth/google/callback
```

Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` only in the API environment (`/srv/folio/server.env` in production). The callback is derived from `APP_PUBLIC_URL`, never forwarded Host headers or user-controlled redirect parameters. For local interactive Google testing, separately register `http://127.0.0.1:5173/api/auth/google/callback` in the same Google client. If the credentials are absent, the login page keeps the wallet option available.

The backend uses Authorization Code flow with S256 PKCE, a browser-bound ten-minute one-time state, and a nonce. It validates the Google ID-token signature, issuer, client audience, expiry, and verified email. Access and refresh tokens are not persisted. Linking requires the original Folio session to remain valid and rejects identities already owned by another account. Existing users keep their IDs, ownership, sessions, and files through the versioned SQLite migration. Sign-in method metadata is stored separately so the old four-column session schema remains compatible with application rollback.

OAuth callback queries and cookies are excluded from API request logs. The Folio Nginx template also logs URI paths without query strings. Existing installations must apply the updated `deploy/nginx-https.conf` template, run `nginx -t`, and reload Nginx before enabling the new public callback.

## Learning and teaching

**Student workspace:** Courses opens a three-column learning space with a file tree, conversation, and tabbed document/Wiki/HTML reader. Upload personal PDF, Markdown, or text files, select sources, and ask Qwen questions with streamed responses and page references. Visualize creates a structured interactive explanation with steps and a short understanding check, displayed in an isolated HTML iframe.

**Personal Wiki:** save explanations, edit Markdown, follow `[[wiki links]]`, inspect backlinks and the graph, and organize notes across courses. Publish selected pages as versioned course snapshots. Market saves and imports create independent copies while preserving attribution and remapping internal links.

**Teacher workspace:** manage your course's public materials, rename/archive/restore files, review enrolled students' sessions and uploaded materials in read-only mode, feature published Wiki snapshots, and reply to private course Inbox threads. Teachers cannot access students' private Wiki titles, counts, contents, or graphs. The backend enforces course ownership, enrollment, and account permissions for every resource.

**Teacher Courseware:** select active public course materials, enter a topic, teaching requirements, language, and slide count, then generate a private draft. Review and edit its title, slide content, and teaching notes; preview the HTML, download an editable PowerPoint, or publish it into course materials. Generated text, tables, and basic shapes are native PowerPoint objects. Complex web animations do not become executable PowerPoint animations. HTML preview and PPTX are rendered from the same validated slide structure; this is not an arbitrary webpage-to-PowerPoint converter.

**Inbox:** private text threads between a course teacher and an enrolled student, with session links, unread state, teacher resolution, and reopening on a student follow-up. Messages persist across accounts and devices through the API.

## AI and file limits

| Capability | Current limit |
| --- | --- |
| Uploaded originals | PDF, Markdown, UTF-8 text; non-empty and at most 10 MB |
| PDF parsing | At most 500 pages and 2 million extracted characters; text-based PDFs, no OCR |
| Selected source materials | At most 30 per request; only accessible, active materials |
| Chat | 6,000 characters per question; one active answer per session |
| Daily chat requests | 60 per account, configurable with `H2A_DAILY_CHAT_LIMIT` |
| Daily generation requests | 10 per account shared by visualizations and courseware, configurable with `H2A_DAILY_GENERATION_LIMIT` |
| Generation queue | One worker, at most two queued/running jobs per account, up to three attempts per job |
| Courseware | 1–20 slides, default 10; 16:9; topic up to 200 characters and requirements up to 4,000 characters |

Daily quotas reset at **00:00 UTC**. Failed provider attempts and user retries count toward the quota. Downloading an existing PPTX does not call the model again. AI requests use the configured OpenRouter account and its billing; application quotas limit request counts, not provider prices.

The server retrieves relevant text chunks and validates model citations against selected material/page pairs. It labels answers unsupported by selected materials as general explanation. AI output should be reviewed before publishing. File parsing runs in a separate persistent queue, so it does not wait behind model generation. Up to five file jobs per account can be pending. Generation jobs and outputs persist in SQLite; the worker resumes interrupted jobs after a restart and reports failures for retry. Existing private browser prototype data is not imported automatically.

## Langfuse observability and model costs

The backend optionally exports metadata-only traces to Langfuse Cloud using its OpenTelemetry SDK. Set `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`, and `LANGFUSE_BASE_URL` in the backend environment; never expose them through Vite or the frontend. Set `LANGFUSE_TRACING_ENVIRONMENT=production` on the server. Missing credentials or `LANGFUSE_ENABLED=false` disables tracing. Export failures do not retry or fail model requests.

Traces group **Course Chat**, **Courseware Generation**, and **Visual Explanation** with retrieval, **Model Call**, validation, and rendering steps. Exports and publication are traced separately. Generation retries are separate attempts with the same job ID; recovering an already-saved result does not create another model call. This instruments the existing fixed workflows; it does not introduce an autonomous agent.

Each model observation records the actual model ID, provider, timing, token usage, and USD cost. OpenRouter's reported `usage.cost` is preferred and marked `costSource=provider_reported`; upstream inference cost is kept separately because it is not necessarily the account charge. Input/cache and output/reasoning buckets are mutually exclusive, including usage delivered in the final streaming event. A missing final usage report is unknown, rather than zero.

`metadata.pricing` contains a dated public OpenRouter catalog snapshot: `inputUsdPerMillion`, `outputUsdPerMillion`, optional cache rates, and applied pricing overrides. Langfuse v4 read APIs return nested metadata as dotted keys such as `pricing.inputUsdPerMillion`. Prices are discovered dynamically, cached for five minutes, and fetched concurrently with generation. Catalog rates can differ from the routed provider, discounts, and extra billable operations. If actual cost is absent, only supported, complete counts/rates produce a clearly labelled `catalog_estimate`; otherwise Folio leaves cost unset. Langfuse may also infer costs from its own model definitions, so consult `costSource` for the provenance of Folio's reported charge. Unit prices are metadata; `costDetails` contains dollar amounts, not rates.

Raw prompts, answers, uploaded materials, personal profiles, wallet addresses, and private Wiki contents are excluded. Account and session correlation uses pseudonymous IDs; only allowlisted operational IDs, counts, and accounting metadata are exported. Errors use fixed labels rather than exception messages.

Normal automated tests use in-memory exporters or disable Langfuse entirely, with no paid requests. For an explicit live test with **two short billable Qwen calls**, run:

```sh
node --env-file=.env --import tsx scripts/test-langfuse.mjs --run
```

The script forces the `test` environment, verifies non-streaming and streaming generation, flushes the SDK, reads observations back from Langfuse, and checks hierarchy, actual costs, unit rates, token totals, and privacy. It prints safe trace IDs and accounting summaries only.

To repeat readback without another model request, replace `--run` with `--trace-id=<test trace ID>` within one hour of the original test.

## Repository and validation

```text
apps/web/       React, Vite, course workspace, Wiki, Inbox, teacher Courseware
apps/api/       Fastify, SIWE authentication, SQLite/Drizzle, Qwen and task worker
scripts/e2e.mjs Browser integration checks with isolated accounts and a mock AI server
deploy/         VM provisioning, Nginx/TLS, backup, release and rollback helpers
.github/        CI and release-only production deployment workflows
```

```sh
npm run check
npm test
npm run build
npx playwright install chromium
CI=1 npm run test:e2e
```

The browser checks use actual API signature verification and SQLite, with synthetic wallets and a local mock model. They exercise first-login roles, teacher course creation, student joining, uploads, streamed chat, private Wiki, interactive HTML, editable Chinese PPTX, publication, reload persistence, and responsive Courseware. The additional Google browser suite uses an injected local identity provider and a temporary database to exercise callbacks, wallet-free student/teacher onboarding, account linking, role switches from Settings, retained learning and teaching data, failed-save feedback, session persistence, privacy and mobile layout. Unit tests separately validate real signed JWT processing and reject forged tokens. These automated checks make no real Google requests or paid OpenRouter calls. Screenshots and the generated test PPTX go into ignored `test-results/`.

CI performs the checks, build, browser integration run, and a Linux Docker packaging smoke test on development pushes and PRs. The image test runs native SQLite migrations and starts the non-root API using temporary data, without credentials, network access, or published ports. **Only updates to `release` trigger automatic production deployment.** The release workflow backs up SQLite and files, applies unapplied migrations, checks the API version, then promotes the matching Vercel frontend. Normal database changes require no manual SQL. An unsuccessful migration stops the release; application rollback preserves data and does not automatically reverse SQL.

See [deployment and recovery instructions](docs/DEPLOYMENT.md) for secrets, HTTPS, backups, and rollback. The intended frontend project is `folio-group-project`; Azure hosts the API and persistent data. The initial inbound-port block was resolved on **17 October 2026**: public HTTP and trusted HTTPS are verified, deployment credentials are configured, and automatic certificate renewal is enabled. Check the release workflow and public frontend/API smoke results for the current application deployment status.

Visual decisions remain in [DESIGN.md](DESIGN.md). Existing prototype screenshots are in `docs/screenshots/`; new browser-check screenshots are generated in `test-results/screenshots/`.
