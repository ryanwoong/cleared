# Cleared — Runbook

What to do for deploys, rollbacks, restores, backups, lock-outs, password resets and quota incidents (Phase 7 §3.9). First-time setup is in [`setup-and-deploy.md`](./setup-and-deploy.md).

Replace `<your-subdomain>` with your own `workers.dev` subdomain. Commands that touch the remote D1 database go through `npm run remote -- …`, which renders the git-ignored `wrangler.deploy.jsonc` from your `cleared.config.json` (`setup-and-deploy.md` §7). There is one deployment (Worker and D1 database both named `cleared`) and no staging copy. Deploy scripts reject extra arguments.

**Never upgrade to a paid plan** to get out of an incident. The cost of a free limit is downtime until the daily reset, never a bill.

| Section | When |
|---|---|
| [Deploy](#deploy) | Every release |
| [Roll back code](#roll-back-code) | A deploy broke something |
| [Restore data](#restore-data-d1-time-travel-last-7-days) | Bad migration or bad data change |
| [Back up](#back-up-weekly-during-a-pilot) | Weekly during a pilot |
| [Check health and limits](#check-health-and-limits) | Weekly; daily during a pilot |
| [Quota incident](#quota-incident-error-1027-or-the-daily-limit-banner) | Error 1027 or the daily-limit banner |
| [CPU incident](#cpu-incident-error-1102) | Error 1102 |
| [Admin lock-out](#admin-lock-out) | No active admin can sign in |
| [Forgotten password](#forgotten-password) | A member can't sign in |
| [Rotate secrets](#rotate-secrets) | Suspected leak; once a year |
| [Join link leaked](#join-link-leaked) | The join link was posted somewhere public |
| [Label misused or lost](#label-misused-or-lost) | A QR label was copied, moved or lost |
| [Retention purge](#retention-purge-once-a-term) | Once a term |
| ["The pass was wrong"](#the-pass-was-wrong) | Someone reports a wrong Cleared / Not cleared |
| [Demo data](#demo-data) | Before a demo; before a pilot |
| [Incident log](#incident-log) | After any admin script or incident |

## Deploy

Deploys run from your machine: there's no CI server and no staging copy. Test locally, apply migrations first, then deploy.

```bash
npm run check                 # repo guards, lint, types, unit/service tests, Worker build, bundle scan
npm run test:e2e              # browser tests on a throwaway local database
npm run preview               # anything risky (OpenNext/Next/Better Auth upgrade, proxy.ts, auth): try it in real workerd on localhost:8787

npm run db:migrate:remote     # only if there's a new migration (additive only: drizzle/README.md)
npm run deploy                # rescans the build for secrets, ends with scripts/smoke-test.sh
```

The smoke test checks that `/api/health` reports the new commit SHA, `environment: production`, that `/help` answers 200 and `/` redirects to `/machines`.

- **Additive only:** once the deployment holds real data, migrations only add tables, nullable columns or indexes. Old code must keep working on the new schema, so a code rollback is always safe. Follow the checklist in [`drizzle/README.md`](../drizzle/README.md).
- **First-ever deploy:** `npm run deploy:first` (`scripts/deploy.sh --first`) also uploads `BETTER_AUTH_SECRET`; it refuses to overwrite an existing one.

## Roll back code

Workers keeps the last versions of the Worker.

```bash
npm run remote -- deployments list      # find the last good version
npm run remote -- rollback              # previous version (or: npm run remote -- rollback <version-id>)
curl https://cleared.<your-subdomain>.workers.dev/api/health   # version is the old SHA
```

**Never roll back a migration.** Migrations are additive, so older code keeps working against the newer schema; fix forward with a new migration. If a migration or bad code damaged data, restore it (next section).

## Restore data (D1 Time Travel, last 7 days)

The undo for a bad migration or a bad data change. A restore replaces the **whole** database with its state at that moment, so everything written since is lost: export first.

```bash
mkdir -p ~/cleared-backups
npm run remote -- d1 export cleared --remote --output="$HOME/cleared-backups/cleared-before-restore-$(date +%F-%H%M).sql"
npm run remote -- d1 time-travel info cleared
npm run remote -- d1 time-travel restore cleared --timestamp=<ISO-8601 time before the incident, e.g. 2026-11-23T18:00:00Z>
curl https://cleared.<your-subdomain>.workers.dev/api/health
```

If the restore went to a point before the latest migration, run `npm run db:migrate:remote` again. **Rehearse this once** while the deployment only holds demo data, and note the date in the [incident log](#incident-log).

## Back up (weekly during a pilot)

A dump contains personal data and password hashes. Write it **outside the repository** (which is public) and keep it private (an encrypted drive, not GitHub, not a shared folder):

```bash
mkdir -p ~/cleared-backups
npm run remote -- d1 export cleared --remote --output="$HOME/cleared-backups/cleared-$(date +%F).sql"
```

Delete backups older than the retention period (2 years for machine sessions; see [Retention purge](#retention-purge-once-a-term)) and all of them when a pilot ends without continuing.

## Check health and limits

| What | How |
|---|---|
| Is it up? | `curl https://cleared.<your-subdomain>.workers.dev/api/health` |
| Live logs | `npm run remote -- tail cleared` |
| Requests, CPU, errors (1102 = CPU limit, 1027 = daily requests) | Dashboard → Workers & Pages → `cleared` → Metrics |
| D1 rows read / written | Dashboard → Storage & Databases → D1 → `cleared` → Metrics |
| Per-request CPU time | Dashboard → Workers & Pages → `cleared` → Logs (`cpuTime` on each invocation) |

Free daily limits (`technologies.md` §4): 100,000 Worker requests (shared by every Worker on the account), 5 million D1 rows read, 100,000 rows written. They reset at **00:00 UTC (5 pm MST, 6 pm MDT)**. Nothing is billed.

## Quota incident (Error 1027 or the daily-limit banner)

**Symptoms:** pages fail with Cloudflare **Error 1027** (Worker requests used up), or the app shows "Cleared is over its free daily limit…" (D1 rows used up: `/api/health` answers `503` with `code: "DAILY_LIMIT"`).

1. Confirm in the dashboard which limit: Workers → Metrics (requests) or D1 → Metrics (rows read/written). Requests are shared with **any other Worker on the account**, so check those too.
2. Find what's using it: Workers Logs grouped by path. Typical causes: a kiosk/board tab left polling, a script, a crawler.
3. Mitigate: close kiosk tabs; ask staff to close spare console tabs (polling stops in hidden tabs, but not on a visible screen); if one route is hot, raise its poll interval in the next deploy.
4. Wait for the reset at 00:00 UTC. Tell staff the app is back after 5 pm (6 pm in summer). Paper sign-off sheets and the machine's physical lock-out tag cover the gap.
5. Write it in the [incident log](#incident-log). **Never upgrade to a paid plan.**

## CPU incident (Error 1102)

1. Workers Logs → filter `outcome = exceededCpu` (or the 1102 errors) → note the path.
2. **Sign-in or sign-up** (`/api/auth/*`): password hashing is the expensive part. The client already retries once on 503. If real users keep failing, follow `technologies.md` §6.4 (add Google sign-in as the fallback). Never lower the scrypt cost, never pay.
3. **A page:** reduce its server render (Phase 7 P7-25): smaller server component tree, stream behind `<Suspense>`, one data load instead of a waterfall, less client JS.
4. Re-measure `cpuTime` for that path after the fix.

## Admin lock-out

No active admin can sign in (the only admin left, was suspended by a mistake made directly in the database, or lost their account). Confirm who should be admin, in person, then on a laptop:

```bash
npx tsx scripts/make-admin.ts <email>            # the deployment
npx tsx scripts/make-admin.ts <email> --local    # your local D1
```

It makes the member with that email an active admin (they must have joined already) and bumps `data_version`. If they can't sign in either, follow [Forgotten password](#forgotten-password) next. Record date and reason in the [incident log](#incident-log).

## Forgotten password

Cleared sends no email, so there's no self-service reset (`technologies.md` §6.6):

1. Staff confirm the member's identity **in person** (no resets over chat or email).
2. An admin, on a laptop: `npx tsx scripts/set-password.ts <email> <temporary-password>` (`--local` for your local D1). It hashes the password locally (no Worker CPU) and signs the member out everywhere. Choose 8–128 characters; never reuse a temporary password.
3. Tell the member the temporary password in person. They sign in and change it on **Account**.
4. Record it in the [incident log](#incident-log) (date, member id from the console, who confirmed identity; never the password).

## Rotate secrets

| Secret | How | Effect |
|---|---|---|
| `BETTER_AUTH_SECRET` | `openssl rand -base64 32`, then `npm run remote -- secret put BETTER_AUTH_SECRET` and paste it | **Signs everyone out** (every session cookie becomes invalid). Do it outside open hours and tell staff |
| Cloudflare API token (only if you use one for headless deploys) | Dashboard → My Profile → API Tokens → Roll; export the new value in your shell only | None for users |
| Local `.dev.vars` | New random value | Local sessions end |

Never put secrets in `.env*` files (OpenNext can bundle `.env.local` into the Worker) or in the repository. `npm run check` and every deploy scan the build for the secret values in `.dev.vars` and the environment. Keep 2FA on the Cloudflare and GitHub accounts.

## Join link leaked

Console → **Settings** → **Regenerate join link**. The old link stops working immediately; members who already joined are unaffected. Reprint the door poster (Console → Door poster). If strangers joined, suspend them in Console → Members.

## Label misused or lost

- **Lost or damaged:** reprint it (Console → Labels). The QR token doesn't change, so the new label works like the old one.
- **Misused** (copied, moved to another machine, shared online): retire the machine (Console → Machines → Edit → Retire), add it again (it gets a new token), print and stick the new label, then remove the old one. History stays with the retired machine.

## Retention purge (once a term)

PRD 11.1 retention: machine sessions are kept 2 years; grants, faults, service records and checkups for the life of the makerspace (audit value); expired sign-in sessions are purged; accounts that signed up but never joined are removed after 7 days. There's no background job, so an admin runs it:

```bash
mkdir -p ~/cleared-backups
npm run remote -- d1 export cleared --remote --output="$HOME/cleared-backups/cleared-$(date +%F)-before-purge.sql"
npm run remote -- d1 execute cleared --remote --file scripts/sql/retention-purge.sql
```

[`scripts/sql/retention-purge.sql`](../scripts/sql/retention-purge.sql) is covered by `tests/services/retention-purge.spec.ts`. Record the date in the [incident log](#incident-log).

## "The pass was wrong"

The pass is computed on every scan from the records at that moment: the member's grants (certification, expiry, revocation), their membership status, the machine's requirements, supervised flag and status. So:

1. Console → Members → the member → **Certifications** history: was the grant there, expired or revoked at that time?
2. Console → Machines → the machine: which certifications it requires, supervised, out of service?
3. **Fix the records, not the pass:** sign off, revoke, change the machine's requirements. The next scan shows the corrected pass.
4. If the records were right and the pass was still wrong, that's a bug: note the member id, machine id and time (never names) and add a failing test to `tests/services/T02-pass.spec.ts`.

## Demo data

Seed data is clearly fake ("Demo …" names, `@example.com` addresses) and **never presented as pilot results**. Details and the local demo passwords are in [`seed.md`](./seed.md).

```bash
npm run db:seed                              # local: loads the demo catalog; demo members/history only if the name starts with "Demo"
npm run db:seed -- --reset --i-know          # local: copies the D1 files to ~/cleared-backups/, clears, re-seeds
npm run db:seed -- --fresh --i-know          # local: copies the D1 files to ~/cleared-backups/, wipes everything (accounts, settings), seeds a full demo
npm run db:seed -- --remote --fresh --i-know # deployment: exports a backup, wipes everything, seeds a full demo with the PUBLIC password in docs/demo-accounts.md
bash scripts/reset-demo.sh --i-know          # deployment: exports ~/cleared-backups/cleared-<stamp>-before-reset.sql, clears, re-seeds
```

Both resets refuse unless `--i-know` is passed **and** the makerspace name starts with the word "Demo", so they can never wipe a real pilot. They delete every business table and the seeded demo members (`@example.com`, "Demo …", never an admin); real accounts are kept but lose their grants and history. The clear and re-seed run as one transaction, and the append-only trigger on `service_records` is restored inside it. To undo a deployment reset within 7 days: `npm run remote -- d1 time-travel restore cleared --timestamp=<ISO time before the reset>`. Rehearse the deployment reset once while it holds only demo data.

Live-demo accounts on the deployment are real accounts you sign up (you as admin, a second account as staff, a phone account as a student); seeded "Demo …" members only fill in history and can't sign in there. Before a pilot: reset, then either keep the empty Demo makerspace for practice or set the deployment up fresh for the real space (Phase 7 Q2).

## Incident log

Keep this log **outside the repository** (it names real people): a private note with one line per event, e.g. `2026-11-23 · make-admin · member <id> · reason: only admin left the program · confirmed by <role>`. Log every admin script run, restore, secret rotation, quota or CPU incident, retention purge and restore rehearsal.
