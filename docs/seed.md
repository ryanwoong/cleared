# Demo data (`npm run db:seed`)

Clearly fake data for trying Cleared out and for the live demo (Phase 7 §3.7, P7-70 to P7-75).

**Seed data is never presented as pilot results.** Every number, grant and service record it creates is invented; pilot findings come only from real use by real members (PRD 14).

## What it loads

The seed needs a finished **Setup** (the settings row). What it loads depends on the makerspace name:

| Makerspace name | Loaded |
|---|---|
| Starts with the word **"Demo"** (e.g. *Demo Makerspace*; case-sensitive, so *Demolition Lab* doesn't count) | The catalog **and** the demo people and history below |
| Anything else | Only the catalog, and a note saying how to get the rest. Fake members and history never land in a real makerspace |

Rename the makerspace in **Settings** (or pick *Demo Makerspace* at Setup) to get everything. The same rule shows the "Demo data. Not real makerspace records" banner.

- **Catalog:** rooms *Laser Room*, *Wood Shop*, *3D Print Lab*, *Metal Shop*; certifications *Laser Cutter — Basic* (12 months), *Wood Shop — General* (12), *3D Printer — Intro* (never expires), *Lathe — Basic* (6); 10 machines, including two supervised lathes.
- **Demo members** (all `@example.com`, so nothing is ever deliverable):

  | Name | Email | Role |
  |---|---|---|
  | Demo Student 1–5 | `demo.student1@example.com` … `demo.student5@example.com` | member |
  | Demo Student 6 (**suspended** by Demo Staff 1) | `demo.student6@example.com` | member |
  | Demo Staff 1, Demo Staff 2 | `demo.staff1@example.com`, `demo.staff2@example.com` | staff |
  | Demo Technician | `demo.technician@example.com` | staff |

- **Grants:** 22 sign-offs with expiry computed like the app does (granted date + the certification's validity months): mostly valid, two expiring within 30 days (Demo Student 2's laser, Demo Student 4's lathe), two expired (Demo Student 3's laser, Demo Student 5's lathe) and one revoked (Demo Student 3's wood shop).
- **Machine sessions:** 10. Three are **in use right now** (Laser Cutter A, Prusa MK4 #2 and the supervised Wood Lathe), and seven ended over the past nine days (by the member, by staff, or expired).
- **Service history:** 6 records on 4 machines: two scheduled checkups, a **vendor repair** on Laser Cutter A (by "Demo Laser Service (vendor)", which resolved a reported fault), an inspection on the Wood Lathe and a **correction** of it, and a repair on the Band Saw.
- **Checkups:** 3 (*Lens and mirror clean* on Laser Cutter A: OK; *Blade, fence and riving knife check* on the Table Saw: **overdue**; *Nozzle and bed check* on Prusa MK4 #1: due soon).
- **Machine status:** the **Band Saw is out of service** (maintenance) with a public note and an expected-back date; one open fault (not out of service) on Laser Cutter B.

All times are relative to when you run it, so the states above hold on any day. Running it again adds nothing: existing rooms, certifications and machines (by name), members (by email), checkups (by machine and name) and the rest (by fixed request ids) are skipped, and a machine you returned to service stays in service.

## Local passwords

Locally, every demo member gets an email + password account, hashed on your computer with Better Auth's `hashPassword` (no Worker CPU). They all use:

```text
cleared-demo-pass
```

This password is public (it's in this repository): **it's only ever used on a local database.** On the deployment, demo members get **no** account and can't sign in; they only populate history. Live-demo accounts on the deployment are real accounts you sign up yourself (P7-74).

## Commands

```bash
npm run db:seed                               # your local D1 (.wrangler/state)
npm run db:seed -- --persist-to <dir>         # another local D1 state directory
npm run db:seed -- --reset --i-know           # back up, clear and re-seed the local D1
bash scripts/reset-demo.sh --i-know           # the same on the deployment
npm run db:seed -- --remote                   # add missing demo data on the deployment (no reset; "Demo" name only)
```

## Resetting

A reset **refuses to run** unless you pass `--i-know` **and** the makerspace name starts with the word "Demo", so it can never wipe a real pilot. Then it:

1. **Backs up** to `~/cleared-backups/` (never inside the repository; add `--backup-dir <dir>` locally to choose another folder outside it):
   - deployment: `wrangler d1 export` to `cleared-<date>-<time>-before-reset.sql`;
   - local: a copy of the local D1 files in `cleared-local-<date>-<time>-before-reset/` (restore by copying the folder back to `.wrangler/state/v3/d1` while nothing is running).
2. **Clears** faults, service records, checkups, machine sessions, grants, machine requirements, machines, certifications and rooms (in that order, for the foreign keys), then the seeded demo members with their sessions, accounts and users.
3. **Re-seeds**, then checks that the service history's append-only triggers are in place.

Steps 2 and 3 are one SQL file, which wrangler runs as one transaction (a local D1 batch; a remote import that rolls back on failure): if anything fails, nothing changes.

What it deletes, exactly:

- **Every row** in the business tables above, including any you added yourself.
- **Only demo members:** a member whose sign-in email ends in `@example.com` **and** whose name starts with "Demo ", and who isn't an admin. Their sessions and accounts go too. Real accounts (yours, a phone account you signed up for the live demo) are kept, along with their membership and role, but lose their grants and history.
- The makerspace settings (name, join link) are kept.

**The service history is append-only** (`BEFORE UPDATE` / `BEFORE DELETE` triggers from `drizzle/0005_faults_service.sql`). The reset drops the delete trigger immediately before deleting the records and re-creates it, with the migration's exact SQL, immediately after, in the same transaction. Every seed run also re-creates both triggers if they are missing, and the seed fails loudly if they aren't there afterwards.
