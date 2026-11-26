# Cleared

Cleared puts machine-access answers where they're needed in an education makerspace. Students scan a QR label on a machine and see an accurate **pass** (cleared, cleared with supervision, or not cleared, with what's missing), check which machines are free before walking over, and record a session in seconds. Staff sign off training, track certification expiry, work through fault reports, keep a service log and run recurring checkups. Cleared is a decision-support and record-keeping tool: it checks certification records; it doesn't lock machines or replace a supervisor.

It's one Next.js 16 app deployed to **Cloudflare Workers Free** with **D1** and **Better Auth** (email + password), designed to run for **$0**: no paid plans, no domain, no credit card.

Cleared is a project for **ENTI 333, Fall 2026**.

> **Status:** early development. Built so far: the foundation (Phase 0), sign-in, setup, join links and roles (Phase 1), the catalog: rooms, certifications, machines and printable QR labels (Phase 2), and certifications with the machine pass: sign-off, revocation, expiry, the pass page and My certifications (Phase 3). Features arrive phase by phase (see [`docs/phases/`](docs/phases/README.md)).

## Quick start (local)

Requires Node.js 22+ and npm.

```bash
npm ci
cp .dev.vars.example .dev.vars      # then set BETTER_AUTH_SECRET (openssl rand -base64 32)
npm run db:migrate                  # apply migrations to the local D1 (no Cloudflare account needed)
npm run dev                         # http://localhost:3000
```

Checks:

```bash
npm run check                       # repo guards, lint, types, tests, Worker build, bundle scan
npx playwright install chromium     # once
npm run test:e2e                    # Playwright on a throwaway local database
```

## Deploy your own copy

Everything runs on free plans with no credit card. The full walkthrough, with every dashboard click and a troubleshooting table, is **[`docs/setup-and-deploy.md`](docs/setup-and-deploy.md)**. The short version:

**Where things live.** The repository is generic and never holds your values:

| What | Where |
|---|---|
| Your `workers.dev` subdomain and D1 database ID (not secret, but yours) | `cleared.config.json`, git-ignored (copy of `cleared.config.example.json`) |
| Secret: `BETTER_AUTH_SECRET` | Cloudflare Worker secrets (deployed), `.dev.vars` (local, git-ignored) |
| Cloudflare login | `npx wrangler login` (stored by Wrangler outside the repo) |

`wrangler.jsonc` keeps `<placeholders>`; deploy scripts render your values into a git-ignored `wrangler.deploy.jsonc`. Don't create `.env` files: OpenNext can embed them into the deployed bundle.

**Steps** (each links to the full instructions in the guide):

1. **Create a free [Cloudflare account](docs/setup-and-deploy.md#3-create-your-cloudflare-account-and-workersdev-subdomain)** and pick your `workers.dev` subdomain (it's printed on QR labels).
2. **[Create the database](docs/setup-and-deploy.md#6-create-the-d1-database).** If Wrangler offers to update your config, answer **no**.
   ```bash
   npx wrangler login
   npx wrangler d1 create cleared --location=wnam
   ```
3. **[Add your values](docs/setup-and-deploy.md#7-add-your-deployment-values-clearedconfigjson).**
   ```bash
   cp cleared.config.example.json cleared.config.json
   ```
   In `cleared.config.json`, set:
   - `workersSubdomain`: your subdomain, e.g. `my-makerspace` (dashboard → **Workers & Pages** → **Account details**)
   - `d1DatabaseId`: the `database_id` printed in step 2

   Then check it with `npm run config:render`.
4. **[Deploy](docs/setup-and-deploy.md#9-first-deploy).** This also creates the Worker and its secret.
   ```bash
   npm run db:migrate:remote
   npm run deploy:first
   ```
5. **[Set up the app](docs/setup-and-deploy.md#11-first-run-setup-in-the-app):** open `https://cleared.<your-subdomain>.workers.dev`, sign up and complete **Setup**.

**[Everyday deploys](docs/setup-and-deploy.md#12-everyday-deploys):**

```bash
npm run check                                   # must pass first
npm run db:migrate:remote && npm run deploy
```

Logs, rollback and backups: [`docs/runbook.md`](docs/runbook.md). **Database backups contain personal data: always save them outside this folder** (the repository is public).

## Documentation

| Document | What it covers |
|---|---|
| [`docs/PRD.md`](docs/PRD.md) | Product requirements: what to build and why |
| [`docs/technologies.md`](docs/technologies.md) | Stack, free-tier limits, platform rules and quirks |
| [`docs/phases/`](docs/phases/README.md) | Build order, one document per phase |
| [`docs/setup-and-deploy.md`](docs/setup-and-deploy.md) | Running locally and deploying |
| [`docs/runbook.md`](docs/runbook.md) | Operating a deployment: deploys, rollback, restore |
| [`docs/seed.md`](docs/seed.md) | Loading demo data (`npm run db:seed`) |
| [`docs/demo-accounts.md`](docs/demo-accounts.md) | The seeded demo accounts, their password and what each one shows |
| [`drizzle/README.md`](drizzle/README.md) | Migration workflow and review checklist |
| [`AGENTS.md`](AGENTS.md) | Project rules for contributors and coding agents |

## Licence

[MIT](LICENSE)
