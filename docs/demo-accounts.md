# Demo accounts

Every account that `npm run db:seed -- --fresh --i-know` creates, locally or on a demo deployment (`--remote --fresh --i-know`). How the seed works: [`seed.md`](seed.md).

**Everything here is fake.** The names start with "Demo", the emails are `@example.com` (nothing can be delivered to them), and every grant, session and service record is invented. Seed data is never presented as pilot results (PRD 14).

**This password is public.** Anyone who reads this repository can sign in to a seeded deployment as its admin. Seed a deployment with `--fresh` only while it is a throwaway demo, and set it up fresh before any real use.

## Password

Every account below uses the same password:

```text
cleared-demo-pass
```

## Makerspace

| | |
|---|---|
| Name | Demo Makerspace (shows the "Demo data" banner) |
| Timezone | America/Edmonton |

## Accounts

| Name | Email (sign-in) | Password | Role | What it shows |
|---|---|---|---|---|
| Demo Admin | `demo.admin@example.com` | `cleared-demo-pass` | admin | Everything: Settings, the join link, members and roles, the catalog and the console |
| Demo Staff 1 | `demo.staff1@example.com` | `cleared-demo-pass` | staff | Holds all four certifications. Signed off most students, suspended Demo Student 6, logged the vendor laser repair and the Table Saw checkup |
| Demo Staff 2 | `demo.staff2@example.com` | `cleared-demo-pass` | staff | Revoked Demo Student 3's Wood Shop sign-off, ended Demo Student 4's Drill Press session, logged the Wood Lathe inspection and its correction |
| Demo Technician | `demo.technician@example.com` | `cleared-demo-pass` | staff | Owns the three checkups, did the Laser Cutter A optics checkup and the Band Saw repair that keeps it out of service |
| Demo Student 1 | `demo.student1@example.com` | `cleared-demo-pass` | member | Laser, Wood Shop and 3D Printer all valid. **Using Laser Cutter A** |
| Demo Student 2 | `demo.student2@example.com` | `cleared-demo-pass` | member | Laser **expiring soon**, Wood Shop valid. Reported the Laser Cutter A fault (since fixed) |
| Demo Student 3 | `demo.student3@example.com` | `cleared-demo-pass` | member | Laser **expired**, Wood Shop **revoked**, 3D Printer valid. Reported the open fault on Laser Cutter B |
| Demo Student 4 | `demo.student4@example.com` | `cleared-demo-pass` | member | Wood Shop valid, Lathe **expiring soon**. **Using the Wood Lathe** (supervised) |
| Demo Student 5 | `demo.student5@example.com` | `cleared-demo-pass` | member | 3D Printer valid (never expires), Lathe **expired**. **Using Prusa MK4 #2** |
| Demo Student 6 | `demo.student6@example.com` | `cleared-demo-pass` | member | **Suspended** (can sign in but can't use machines). Holds a Laser sign-off |

"Using" means a session that starts when the seed runs: Laser Cutter A's ends about 18 minutes later, the Wood Lathe's about 65 and Prusa MK4 #2's about 70. Re-run the seed to get them back. Expiry states (expiring soon, expired) are also relative to when the seed runs.

## What else is seeded

- **Rooms:** Laser Room, Wood Shop, 3D Print Lab, Metal Shop.
- **Certifications:** Laser Cutter — Basic (12 months), Wood Shop — General (12), 3D Printer — Intro (never expires), Lathe — Basic (6).
- **Machines (10):** Laser Cutter A and B, Table Saw, Band Saw (**out of service** for maintenance, with a note and an expected-back date), Drill Press, Wood Lathe (supervised), Prusa MK4 #1 and #2, Metal Lathe (supervised), Bench Grinder.
- **Checkups:** Laser Cutter A optics (OK), Table Saw blade check (**overdue**), Prusa MK4 #1 nozzle check (due soon).
- **Faults:** one open (Laser Cutter B exhaust fan), one resolved by a vendor repair (Laser Cutter A).
- **Service history:** 6 records, including a vendor repair and a correction.
- **Machine sessions:** 10 (3 in use, 7 finished in the past nine days).
