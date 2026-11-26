// Pure helpers for scripts/seed.ts (tested by tests/scripts/seed.test.mjs):
// argument parsing, the refusal guards, the demo data and the SQL built from it.
// Nothing here touches the database, the clock or the file system.

import { randomBytes, randomUUID } from "node:crypto";
import { isAbsolute, relative, resolve } from "node:path";
import { sqlString as q } from "./set-password.mjs";

export const DAY_MS = 24 * 60 * 60 * 1000;
/** Matches EXPIRING_SOON_DAYS in src/server/domain/grants.ts. */
export const EXPIRING_SOON_DAYS = 30;

/* ------------------------------------------------------------- arguments */

const USAGE =
  "Usage: npm run db:seed [-- --persist-to <dir>] [-- --reset --i-know] [-- --backup-dir <dir>]\n" +
  "       (the deployment: bash scripts/reset-demo.sh --i-know)";
export const SEED_USAGE = USAGE;

/**
 * Parse the seed's flags. Returns `{ remote, persistTo, reset, iKnow, backupDir }`
 * or `{ error }`. Unknown arguments are rejected, so a typo can't change what runs.
 */
export function parseSeedArgs(argv) {
  const out = { remote: false, persistTo: null, reset: false, iKnow: false, backupDir: null };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--remote") out.remote = true;
    else if (arg === "--local") out.remote = false;
    else if (arg === "--reset") out.reset = true;
    else if (arg === "--i-know") out.iKnow = true;
    else if (arg === "--persist-to" || arg === "--backup-dir") {
      const value = argv[i + 1];
      if (!value || value.startsWith("--")) return { error: `${arg} needs a directory` };
      if (arg === "--persist-to") out.persistTo = value;
      else out.backupDir = value;
      i++;
    } else return { error: `Unexpected argument '${arg}'` };
  }
  if (argv.includes("--remote") && argv.includes("--local")) return { error: "Use --local or --remote, not both" };
  if (out.remote && out.persistTo) return { error: "--persist-to is for the local database only" };
  if (out.iKnow && !out.reset) return { error: "--i-know only goes with --reset" };
  return out;
}

/**
 * Seeded data is "demo" only while the makerspace name starts with the word
 * "Demo" (P7-72): case-sensitive and a whole word, so "Demolition Lab" is a
 * real makerspace. Same rule as isDemoName() in src/lib/demo.ts (the banner).
 */
export function isDemoName(name) {
  return typeof name === "string" && /^Demo\b/.test(name);
}

/** Why a `--reset` must not run, or null. Both guards are required (P7-73). */
export function resetRefusal({ iKnow, settingsName }) {
  if (!iKnow) return "--reset deletes data: pass --i-know as well.";
  if (settingsName === null || settingsName === undefined) return "this database has no makerspace yet. Complete Setup first.";
  if (!isDemoName(settingsName)) {
    return 'the makerspace name doesn\'t start with the word "Demo", so this may be a real makerspace. Nothing was deleted.';
  }
  return null;
}

/** Why loading demo data into the deployment must not run, or null. */
export function remoteSeedRefusal({ settingsName }) {
  if (settingsName === null || settingsName === undefined) return "the deployment has no makerspace yet. Complete Setup first.";
  if (!isDemoName(settingsName)) {
    return 'the deployment\'s makerspace name doesn\'t start with the word "Demo". Demo data is never loaded into a real makerspace.';
  }
  return null;
}

/** Backups hold personal data and password hashes: never inside the (public) repository. */
export function backupDirRefusal(dir, repoRoot) {
  const rel = relative(resolve(repoRoot), resolve(dir));
  if (rel === "" || (!rel.startsWith("..") && !isAbsolute(rel))) {
    return "the backup directory is inside the repository. Use a directory outside it (default: ~/cleared-backups).";
  }
  return null;
}

/** `2026-11-23-193852` (UTC), for backup file names. */
export function backupStamp(now) {
  const iso = new Date(now).toISOString();
  return `${iso.slice(0, 10)}-${iso.slice(11, 19).replaceAll(":", "")}`;
}

/* ------------------------------------------------------------------ time */

/** Same as addMonthsUtc in src/server/domain/time.ts (grant expiry: clamp to month end, UTC). */
export function addMonthsUtc(ms, months) {
  const d = new Date(ms);
  const total = d.getUTCMonth() + months;
  const year = d.getUTCFullYear() + Math.floor(total / 12);
  const month = ((total % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return Date.UTC(
    year,
    month,
    Math.min(d.getUTCDate(), lastDay),
    d.getUTCHours(),
    d.getUTCMinutes(),
    d.getUTCSeconds(),
    d.getUTCMilliseconds(),
  );
}

/* ------------------------------------------------------------- demo data */

export const ROOMS = ["Laser Room", "Wood Shop", "3D Print Lab", "Metal Shop"];

/** [name, validity months or null (never expires)] */
export const CERTS = [
  ["Laser Cutter — Basic", 12],
  ["Wood Shop — General", 12],
  ["3D Printer — Intro", null],
  ["Lathe — Basic", 6],
];
const LASER = "Laser Cutter — Basic";
const WOOD = "Wood Shop — General";
const PRINT = "3D Printer — Intro";
const LATHE = "Lathe — Basic";

export const MACHINES = [
  { name: "Laser Cutter A", room: "Laser Room", requires: [LASER], minutes: 30 },
  { name: "Laser Cutter B", room: "Laser Room", requires: [LASER], minutes: 30 },
  { name: "Table Saw", room: "Wood Shop", requires: [WOOD] },
  { name: "Band Saw", room: "Wood Shop", requires: [WOOD] },
  { name: "Drill Press", room: "Wood Shop", requires: [WOOD], minutes: 30 },
  { name: "Wood Lathe", room: "Wood Shop", requires: [WOOD, LATHE], supervised: true, minutes: 90 },
  { name: "Prusa MK4 #1", room: "3D Print Lab", requires: [PRINT], minutes: 120 },
  { name: "Prusa MK4 #2", room: "3D Print Lab", requires: [PRINT], minutes: 120 },
  { name: "Metal Lathe", room: "Metal Shop", requires: [LATHE], supervised: true, minutes: 90 },
  { name: "Bench Grinder", room: "Metal Shop", requires: [], minutes: 15 },
];

/** The machine taken out of service (by staff, with a public note). */
export const OUT_OF_SERVICE = {
  machine: "Band Saw",
  reason: "maintenance",
  note: "Blade guard replacement on order. Use the Table Saw for straight cuts meanwhile.",
  sinceDaysAgo: 2,
  expectedBackInDays: 5,
};

/** Every person's name starts with "Demo "; every email is @example.com (never deliverable). */
export const MEMBERS = [
  ...[1, 2, 3, 4, 5].map((n) => ({
    key: `student${n}`,
    name: `Demo Student ${n}`,
    email: `demo.student${n}@example.com`,
    role: "member",
    joinedDaysAgo: 390,
  })),
  { key: "staff1", name: "Demo Staff 1", email: "demo.staff1@example.com", role: "staff", joinedDaysAgo: 400 },
  { key: "staff2", name: "Demo Staff 2", email: "demo.staff2@example.com", role: "staff", joinedDaysAgo: 400 },
  { key: "tech", name: "Demo Technician", email: "demo.technician@example.com", role: "staff", joinedDaysAgo: 400 },
  {
    key: "student6",
    name: "Demo Student 6",
    email: "demo.student6@example.com",
    role: "member",
    joinedDaysAgo: 200,
    suspended: { daysAgo: 3, by: "staff1", reason: "Demo: left the laser running unattended. Talk to staff to be reinstated." },
  },
];

/**
 * Sign-offs. Expiry is computed like the app does (granted_at + the
 * certification's validity months), so `grantedDaysAgo` sets the state:
 * a 12-month grant from 351 days ago expires in about two weeks.
 */
export const GRANTS = [
  { member: "staff1", cert: LASER, by: "tech", grantedDaysAgo: 300 },
  { member: "staff1", cert: WOOD, by: "tech", grantedDaysAgo: 300 },
  { member: "staff1", cert: PRINT, by: "tech", grantedDaysAgo: 300 },
  { member: "staff1", cert: LATHE, by: "tech", grantedDaysAgo: 60 },
  { member: "staff2", cert: LASER, by: "staff1", grantedDaysAgo: 200 },
  { member: "staff2", cert: WOOD, by: "staff1", grantedDaysAgo: 200 },
  { member: "tech", cert: LASER, by: "staff1", grantedDaysAgo: 250 },
  { member: "tech", cert: WOOD, by: "staff1", grantedDaysAgo: 250 },
  { member: "tech", cert: LATHE, by: "staff1", grantedDaysAgo: 30 },
  { member: "student1", cert: LASER, by: "staff1", grantedDaysAgo: 60 },
  { member: "student1", cert: WOOD, by: "staff2", grantedDaysAgo: 30 },
  { member: "student1", cert: PRINT, by: "tech", grantedDaysAgo: 90 },
  { member: "student2", cert: LASER, by: "staff1", grantedDaysAgo: 351 }, // expiring soon
  { member: "student2", cert: WOOD, by: "staff2", grantedDaysAgo: 120 },
  { member: "student3", cert: LASER, by: "staff1", grantedDaysAgo: 385 }, // expired
  { member: "student3", cert: PRINT, by: "tech", grantedDaysAgo: 40 },
  {
    member: "student3",
    cert: WOOD,
    by: "staff2",
    grantedDaysAgo: 100,
    revoked: { daysAgo: 5, by: "staff2", reason: "Demo: skipped the push-stick rule. Retraining booked." },
  },
  { member: "student4", cert: WOOD, by: "staff2", grantedDaysAgo: 150 },
  { member: "student4", cert: LATHE, by: "staff1", grantedDaysAgo: 172 }, // expiring soon
  { member: "student5", cert: PRINT, by: "tech", grantedDaysAgo: 20 },
  { member: "student5", cert: LATHE, by: "staff1", grantedDaysAgo: 220 }, // expired
  { member: "student6", cert: LASER, by: "staff1", grantedDaysAgo: 150 }, // valid, but the member is suspended
];

/**
 * Machine sessions (Phase 4). Open ones (no `ended`) are in use right now;
 * every member holds a valid grant for the machine. `ended.reason` is one of
 * SESSION_END_REASONS; an `expired` session ends at its expected end.
 */
export const SESSIONS = [
  { key: "u1", machine: "Laser Cutter A", member: "student1", startedMinutesAgo: 12, minutes: 30 },
  { key: "u2", machine: "Prusa MK4 #2", member: "student5", startedMinutesAgo: 50, minutes: 120 },
  { key: "u3", machine: "Wood Lathe", member: "student4", startedMinutesAgo: 25, minutes: 90, supervised: true },
  { key: "u4", machine: "Table Saw", member: "student1", startedMinutesAgo: 2 * 1440, minutes: 60, ended: { afterMinutes: 45, reason: "user" } },
  { key: "u5", machine: "Laser Cutter B", member: "student2", startedMinutesAgo: 3 * 1440, minutes: 30, ended: { afterMinutes: 28, reason: "user" } },
  { key: "u6", machine: "Prusa MK4 #1", member: "student3", startedMinutesAgo: 1440, minutes: 120, ended: { afterMinutes: 120, reason: "expired" } },
  {
    key: "u7",
    machine: "Drill Press",
    member: "student4",
    startedMinutesAgo: 5 * 1440,
    minutes: 30,
    ended: { afterMinutes: 50, reason: "staff", by: "staff2" },
  },
  { key: "u8", machine: "Laser Cutter A", member: "staff2", startedMinutesAgo: 6 * 1440, minutes: 30, ended: { afterMinutes: 25, reason: "user" } },
  { key: "u9", machine: "Metal Lathe", member: "tech", startedMinutesAgo: 8 * 1440, minutes: 90, supervised: true, ended: { afterMinutes: 80, reason: "user" } },
  { key: "u10", machine: "Prusa MK4 #2", member: "student1", startedMinutesAgo: 9 * 1440, minutes: 120, ended: { afterMinutes: 95, reason: "user" } },
];

/** Checkups: next due = latest linked scheduled_checkup record (or created_at) + interval (Phase 6). */
export const CHECKUPS = [
  {
    key: "laser-optics",
    machine: "Laser Cutter A",
    name: "Lens and mirror clean",
    intervalDays: 30,
    createdDaysAgo: 120,
    instructions: "Clean the lens and the three mirrors with lens wipes, then check the beam alignment at the four corners.",
  }, // last done 10 days ago: due in 20 days
  {
    key: "saw-check",
    machine: "Table Saw",
    name: "Blade, fence and riving knife check",
    intervalDays: 90,
    createdDaysAgo: 200,
    instructions: null,
  }, // last done 100 days ago: overdue by 10 days
  {
    key: "printer-check",
    machine: "Prusa MK4 #1",
    name: "Nozzle and bed check",
    intervalDays: 14,
    createdDaysAgo: 10,
    instructions: "Check the nozzle for wear and clean the print sheet with isopropyl alcohol.",
  }, // never done: due in 4 days
];

/**
 * Six service records. Exactly one of `performer` (a member key) or `external`
 * (a vendor) is set. `corrects` points at an earlier original record on the
 * same machine; a correction resolves no faults and counts as no checkup.
 */
export const SERVICE_RECORDS = [
  {
    key: "s1",
    machine: "Laser Cutter A",
    performedDaysAgo: 10,
    performer: "tech",
    loggedBy: "tech",
    type: "scheduled_checkup",
    workDone: "Cleaned the lens and all three mirrors; beam alignment checked at the four corners.",
    minutes: 25,
    outcome: "passed",
    checkup: "laser-optics",
  },
  {
    key: "s2",
    machine: "Laser Cutter A",
    performedDaysAgo: 45,
    external: "Demo Laser Service (vendor)",
    loggedBy: "staff1",
    type: "repair",
    workDone: "Replaced the failed laser tube power supply and test-cut at full power.",
    parts: "Laser power supply (vendor stock)",
    minutes: 120,
    outcome: "returned_to_service",
  },
  {
    key: "s3",
    machine: "Table Saw",
    performedDaysAgo: 100,
    performer: "staff1",
    loggedBy: "staff1",
    type: "scheduled_checkup",
    workDone: "Checked blade sharpness, fence squareness and the riving knife; all within spec.",
    minutes: 30,
    outcome: "passed",
    checkup: "saw-check",
  },
  {
    key: "s4",
    machine: "Wood Lathe",
    performedDaysAgo: 30,
    performer: "staff2",
    loggedBy: "staff2",
    type: "inspection",
    workDone: "Inspected the tool rest and banjo; the banjo lock slips under load.",
    minutes: 15,
    outcome: "issues_found",
  },
  {
    key: "s5",
    machine: "Wood Lathe",
    performedDaysAgo: 30,
    loggedDaysAgo: 29,
    performer: "staff2",
    loggedBy: "staff2",
    type: "inspection",
    workDone: "Correction: it is the tailstock lock that slips under load, not the banjo lock.",
    minutes: 15,
    outcome: "issues_found",
    corrects: "s4",
  },
  {
    key: "s6",
    machine: "Band Saw",
    performedDaysAgo: 1,
    performer: "tech",
    loggedBy: "tech",
    type: "repair",
    workDone: "Blade guard is cracked: removed it and ordered a replacement. Stays out of service until it is fitted.",
    minutes: 40,
    outcome: "still_out_of_service",
  },
];

/** Reported problems: one resolved by the vendor repair, one still open in the queue. */
export const FAULTS = [
  {
    key: "f1",
    machine: "Laser Cutter A",
    reporter: "student2",
    reportedDaysAgo: 47,
    description: "The laser fires but doesn't cut, and the power supply makes a clicking sound.",
    tookOutOfService: true,
    resolvedBy: "s2",
  },
  {
    key: "f2",
    machine: "Laser Cutter B",
    reporter: "student3",
    reportedDaysAgo: 1,
    description: "The exhaust fan is louder than usual and rattles at startup.",
    tookOutOfService: false,
  },
];

/* ------------------------------------------------------------------- SQL */

/** isDemoName() in SQL (re-checked inside every demo and reset statement): "Demo" then a non-word character or the end. */
export const DEMO_GUARD = `EXISTS (SELECT 1 FROM settings WHERE id = 'singleton' AND substr(name, 1, 4) = 'Demo' AND substr(name, 5, 1) NOT GLOB '[A-Za-z0-9_]')`;

/** Exactly the statements in drizzle/0005_faults_service.sql (IF NOT EXISTS is not stored in sqlite_master). */
export const TRIGGER_NAMES = ["service_records_no_update", "service_records_no_delete"];
export const TRIGGER_SQL = {
  service_records_no_update:
    "CREATE TRIGGER IF NOT EXISTS `service_records_no_update` BEFORE UPDATE ON `service_records`\nBEGIN SELECT RAISE(ABORT, 'service_records are append-only'); END;",
  service_records_no_delete:
    "CREATE TRIGGER IF NOT EXISTS `service_records_no_delete` BEFORE DELETE ON `service_records`\nBEGIN SELECT RAISE(ABORT, 'service_records are append-only'); END;",
};

const memberId = (key) => {
  const m = MEMBERS.find((x) => x.key === key);
  if (!m) throw new Error(`Unknown demo member ${key}`);
  return `(SELECT id FROM members WHERE email = ${q(m.email)})`;
};
const machineId = (name) => `(SELECT id FROM machines WHERE name = ${q(name)} COLLATE NOCASE AND status <> 'retired')`;
const certId = (name) => `(SELECT id FROM certifications WHERE name = ${q(name)} COLLATE NOCASE)`;
const recordId = (key) => `(SELECT id FROM service_records WHERE client_request_id = ${q(`demo-seed-${key}`)})`;
const checkupId = (key) => {
  const c = CHECKUPS.find((x) => x.key === key);
  if (!c) throw new Error(`Unknown demo checkup ${key}`);
  return `(SELECT id FROM checkups WHERE machine_id = ${machineId(c.machine)} AND name = ${q(c.name)})`;
};
const num = (n) => (n === null || n === undefined ? "NULL" : String(n));
const str = (s) => (s === null || s === undefined ? "NULL" : q(s));

function defaultIds() {
  return { uuid: () => randomUUID(), token: () => randomBytes(16).toString("base64url") };
}

/** The demo grants' times, as the app computes them. */
export function grantTimes(now, grant) {
  const months = CERTS.find(([name]) => name === grant.cert)?.[1];
  if (months === undefined) throw new Error(`Unknown demo certification ${grant.cert}`);
  const grantedAt = now - grant.grantedDaysAgo * DAY_MS;
  return { grantedAt, expiresAt: months === null ? null : addMonthsUtc(grantedAt, months) };
}

/** "valid" | "expiring" | "expired" | "revoked", like certState() in src/server/domain/grants.ts. */
export function grantState(now, grant) {
  if (grant.revoked) return "revoked";
  const { expiresAt } = grantTimes(now, grant);
  if (expiresAt !== null && expiresAt <= now) return "expired";
  if (expiresAt !== null && expiresAt - now <= EXPIRING_SOON_DAYS * DAY_MS) return "expiring";
  return "valid";
}

/**
 * The catalog (rooms, certifications, machines and their requirements).
 * Skips names that already exist. `guard`: an extra SQL condition on every
 * insert (the remote seed passes DEMO_GUARD).
 */
export function buildCatalogSql(now, { guard = "1", ids = defaultIds() } = {}) {
  const created = now - 400 * DAY_MS;
  const lines = [];
  ROOMS.forEach((name, i) => {
    lines.push(
      `INSERT INTO rooms (id, name, sort_order, created_at, updated_at) SELECT ${q(ids.uuid())}, ${q(name)}, ${i}, ${created}, ${created} WHERE NOT EXISTS (SELECT 1 FROM rooms WHERE name = ${q(name)} COLLATE NOCASE) AND ${guard};`,
    );
  });
  for (const [name, months] of CERTS) {
    lines.push(
      `INSERT INTO certifications (id, name, training_url, validity_months, active, created_at, updated_at) SELECT ${q(ids.uuid())}, ${q(name)}, NULL, ${num(months)}, 1, ${created}, ${created} WHERE NOT EXISTS (SELECT 1 FROM certifications WHERE name = ${q(name)} COLLATE NOCASE) AND ${guard};`,
    );
  }
  for (const m of MACHINES) {
    const id = ids.uuid();
    lines.push(
      `INSERT INTO machines (id, room_id, name, supervised, status, status_changed_at, qr_token, typical_session_minutes, write_token, created_at, updated_at) SELECT ${q(id)}, r.id, ${q(m.name)}, ${m.supervised ? 1 : 0}, 'available', ${created}, ${q(ids.token())}, ${m.minutes ?? 60}, ${q(ids.token())}, ${created}, ${created} FROM rooms r WHERE r.name = ${q(m.room)} COLLATE NOCASE AND NOT EXISTS (SELECT 1 FROM machines WHERE name = ${q(m.name)} COLLATE NOCASE AND status <> 'retired') AND ${guard};`,
    );
    // Only for a machine this run created (its new id), so an existing machine's requirements never change.
    for (const cert of m.requires) {
      lines.push(
        `INSERT INTO machine_requirements (machine_id, certification_id, created_at) SELECT ${q(id)}, c.id, ${created} FROM certifications c WHERE c.name = ${q(cert)} COLLATE NOCASE AND EXISTS (SELECT 1 FROM machines WHERE id = ${q(id)});`,
      );
    }
  }
  return lines;
}

/**
 * Demo members, grants, faults, service history, checkups and the
 * out-of-service machine. Every statement re-checks DEMO_GUARD and skips rows
 * that already exist (members by email, checkups by machine + name, the rest
 * by a fixed `client_request_id`), so running it twice adds nothing.
 *
 * `hashes`: email → password hash for local runs (a credential `account` row
 * each); null on the deployment, where demo members can't sign in (P7-71).
 */
/** @param {number} now @param {{ hashes?: Map<string, string> | null, ids?: { uuid: () => string, token: () => string } }} [options] */
export function buildDemoSql(now, { hashes = null, ids = defaultIds() } = {}) {
  const G = DEMO_GUARD;
  const ago = (days) => now - days * DAY_MS;
  const lines = [];

  // Suspended members last: their suspension points at a staff member inserted before them.
  for (const m of [...MEMBERS.filter((x) => !x.suspended), ...MEMBERS.filter((x) => x.suspended)]) {
    const t = ago(m.joinedDaysAgo);
    const s = m.suspended;
    lines.push(
      `INSERT INTO "user" (id, name, email, email_verified, image, created_at, updated_at) SELECT ${q(ids.uuid())}, ${q(m.name)}, ${q(m.email)}, 0, NULL, ${t}, ${t} WHERE NOT EXISTS (SELECT 1 FROM "user" WHERE email = ${q(m.email)}) AND ${G};`,
      `INSERT INTO members (id, auth_user_id, email, display_name, role, status, status_changed_at, status_changed_by_member_id, suspension_reason, created_at, updated_at) SELECT ${q(ids.uuid())}, u.id, ${q(m.email)}, ${q(m.name)}, ${q(m.role)}, ${s ? "'suspended'" : "'active'"}, ${s ? ago(s.daysAgo) : "NULL"}, ${s ? memberId(s.by) : "NULL"}, ${s ? q(s.reason) : "NULL"}, ${t}, ${s ? ago(s.daysAgo) : t} FROM "user" u WHERE u.email = ${q(m.email)} AND NOT EXISTS (SELECT 1 FROM members WHERE auth_user_id = u.id OR email = ${q(m.email)}) AND ${G};`,
    );
    if (hashes) {
      const hash = hashes.get(m.email);
      if (!hash || !/^[0-9a-f]+:[0-9a-f]+$/.test(hash)) throw new Error("Missing or malformed demo password hash");
      lines.push(
        `INSERT INTO account (id, account_id, provider_id, user_id, password, created_at, updated_at) SELECT ${q(ids.uuid())}, u.id, 'credential', u.id, ${q(hash)}, ${t}, ${t} FROM "user" u WHERE u.email = ${q(m.email)} AND NOT EXISTS (SELECT 1 FROM account a WHERE a.user_id = u.id AND a.provider_id = 'credential') AND ${G};`,
      );
    }
  }

  GRANTS.forEach((g, i) => {
    const { grantedAt, expiresAt } = grantTimes(now, g);
    const crid = q(`demo-seed-grant-${i + 1}`);
    const r = g.revoked;
    lines.push(
      `INSERT INTO grants (id, member_id, certification_id, granted_by_member_id, granted_at, expires_at, client_request_id, revoked_at, revoked_by_member_id, revoke_reason, created_at) SELECT ${q(ids.uuid())}, ${memberId(g.member)}, ${certId(g.cert)}, ${memberId(g.by)}, ${grantedAt}, ${num(expiresAt)}, ${crid}, ${r ? ago(r.daysAgo) : "NULL"}, ${r ? memberId(r.by) : "NULL"}, ${r ? q(r.reason) : "NULL"}, ${grantedAt} WHERE ${memberId(g.member)} IS NOT NULL AND ${memberId(g.by)} IS NOT NULL AND ${certId(g.cert)} IS NOT NULL AND NOT EXISTS (SELECT 1 FROM grants WHERE client_request_id = ${crid}) AND ${G};`,
    );
  });

  const MIN = 60 * 1000;
  for (const u of SESSIONS) {
    const startedAt = now - u.startedMinutesAgo * MIN;
    const expectedEndAt = startedAt + u.minutes * MIN;
    const e = u.ended;
    const endedAt = e ? (e.reason === "expired" ? expectedEndAt : startedAt + e.afterMinutes * MIN) : null;
    const crid = q(`demo-seed-${u.key}`);
    // An open session only on an available machine nobody else is using (the one-open-session index).
    const openGuard = e
      ? ""
      : ` AND NOT EXISTS (SELECT 1 FROM machine_sessions WHERE machine_id = ${machineId(u.machine)} AND ended_at IS NULL) AND EXISTS (SELECT 1 FROM machines WHERE id = ${machineId(u.machine)} AND status = 'available')`;
    lines.push(
      `INSERT INTO machine_sessions (id, machine_id, member_id, started_at, expected_end_at, ended_at, end_reason, ended_by_member_id, supervision_acknowledged, client_request_id, created_at) SELECT ${q(ids.uuid())}, ${machineId(u.machine)}, ${memberId(u.member)}, ${startedAt}, ${expectedEndAt}, ${num(endedAt)}, ${e ? q(e.reason) : "NULL"}, ${e?.by ? memberId(e.by) : "NULL"}, ${u.supervised ? 1 : 0}, ${crid}, ${startedAt} WHERE ${machineId(u.machine)} IS NOT NULL AND ${memberId(u.member)} IS NOT NULL${e?.by ? ` AND ${memberId(e.by)} IS NOT NULL` : ""}${openGuard} AND NOT EXISTS (SELECT 1 FROM machine_sessions WHERE client_request_id = ${crid}) AND ${G};`,
    );
  }

  for (const c of CHECKUPS) {
    const t = ago(c.createdDaysAgo);
    lines.push(
      `INSERT INTO checkups (id, machine_id, name, interval_days, instructions, active, created_by_member_id, created_at, updated_at) SELECT ${q(ids.uuid())}, ${machineId(c.machine)}, ${q(c.name)}, ${c.intervalDays}, ${str(c.instructions)}, 1, ${memberId("tech")}, ${t}, ${t} WHERE ${machineId(c.machine)} IS NOT NULL AND ${memberId("tech")} IS NOT NULL AND NOT EXISTS (SELECT 1 FROM checkups WHERE machine_id = ${machineId(c.machine)} AND name = ${q(c.name)}) AND ${G};`,
    );
  }

  // The out-of-service machine: only when this run adds its "still out of service" record,
  // so a re-run never takes a machine you returned to service back out.
  const oosRecord = SERVICE_RECORDS.find((s) => s.machine === OUT_OF_SERVICE.machine);
  const oosRecordId = q(ids.uuid());

  for (const s of SERVICE_RECORDS) {
    const performedAt = ago(s.performedDaysAgo);
    const createdAt = s.loggedDaysAgo !== undefined ? ago(s.loggedDaysAgo) : performedAt + 60 * 60 * 1000;
    const crid = q(`demo-seed-${s.key}`);
    const id = s === oosRecord ? oosRecordId : q(ids.uuid());
    const performer = s.performer ? memberId(s.performer) : "NULL";
    lines.push(
      `INSERT INTO service_records (id, machine_id, performed_at, performed_by_member_id, external_technician, logged_by_member_id, type, work_done, parts_used, minutes_spent, outcome, checkup_id, corrects_record_id, client_request_id, created_at) SELECT ${id}, ${machineId(s.machine)}, ${performedAt}, ${performer}, ${str(s.external)}, ${memberId(s.loggedBy)}, ${q(s.type)}, ${q(s.workDone)}, ${str(s.parts)}, ${num(s.minutes)}, ${q(s.outcome)}, ${s.checkup ? checkupId(s.checkup) : "NULL"}, ${s.corrects ? recordId(s.corrects) : "NULL"}, ${crid}, ${createdAt} WHERE ${machineId(s.machine)} IS NOT NULL AND ${memberId(s.loggedBy)} IS NOT NULL${s.performer ? ` AND ${performer} IS NOT NULL` : ""}${s.checkup ? ` AND ${checkupId(s.checkup)} IS NOT NULL` : ""}${s.corrects ? ` AND ${recordId(s.corrects)} IS NOT NULL` : ""} AND NOT EXISTS (SELECT 1 FROM service_records WHERE client_request_id = ${crid}) AND ${G};`,
    );
  }

  for (const f of FAULTS) {
    const t = ago(f.reportedDaysAgo);
    const crid = q(`demo-seed-${f.key}`);
    const resolved = f.resolvedBy ? SERVICE_RECORDS.find((s) => s.key === f.resolvedBy) : null;
    lines.push(
      `INSERT INTO faults (id, machine_id, reported_by_member_id, description, took_out_of_service, status, resolved_by_service_record_id, resolved_at, client_request_id, created_at) SELECT ${q(ids.uuid())}, ${machineId(f.machine)}, ${memberId(f.reporter)}, ${q(f.description)}, ${f.tookOutOfService ? 1 : 0}, ${resolved ? "'resolved'" : "'open'"}, ${resolved ? recordId(resolved.key) : "NULL"}, ${resolved ? ago(resolved.performedDaysAgo) : "NULL"}, ${crid}, ${t} WHERE ${machineId(f.machine)} IS NOT NULL AND ${memberId(f.reporter)} IS NOT NULL${resolved ? ` AND ${recordId(resolved.key)} IS NOT NULL` : ""} AND NOT EXISTS (SELECT 1 FROM faults WHERE client_request_id = ${crid}) AND ${G};`,
    );
  }

  const o = OUT_OF_SERVICE;
  lines.push(
    `UPDATE machines SET status = 'out_of_service', out_of_service_reason = ${q(o.reason)}, status_note = ${q(o.note)}, expected_back_at = ${now + o.expectedBackInDays * DAY_MS}, status_changed_at = ${ago(o.sinceDaysAgo)}, write_token = ${q(ids.token())}, updated_at = ${now} WHERE name = ${q(o.machine)} COLLATE NOCASE AND status = 'available' AND EXISTS (SELECT 1 FROM service_records WHERE id = ${oosRecordId}) AND ${G};`,
  );
  return lines;
}

/**
 * The seed file: re-creates the append-only triggers if a failed reset ever
 * dropped them, the catalog, (when the name starts with "Demo") the demo
 * people and history, and a data_version bump so open pages refresh.
 */
/** @param {number} now @param {{ demo: boolean, remote?: boolean, hashes?: Map<string, string> | null, ids?: { uuid: () => string, token: () => string } }} options */
export function buildSeedSql(now, { demo, remote = false, hashes = null, ids = defaultIds() }) {
  return [
    ...TRIGGER_NAMES.map((n) => TRIGGER_SQL[n]),
    ...buildCatalogSql(now, { guard: remote ? DEMO_GUARD : "1", ids }),
    ...(demo ? buildDemoSql(now, { hashes: remote ? null : hashes, ids }) : []),
    `UPDATE settings SET data_version = data_version + 1 WHERE id = 'singleton';`,
  ].join("\n");
}

/**
 * The seeded demo members: an @example.com sign-in email AND a display name
 * starting with "Demo ", and never an admin. Real accounts never match.
 */
export const DEMO_MEMBER_IDS = `(SELECT m.id FROM members m JOIN "user" u ON u.id = m.auth_user_id WHERE lower(u.email) LIKE '%@example.com' AND lower(m.email) LIKE '%@example.com' AND substr(m.display_name, 1, 5) = 'Demo ' AND m.role <> 'admin')`;
export const DEMO_USER_IDS = `(SELECT m.auth_user_id FROM members m JOIN "user" u ON u.id = m.auth_user_id WHERE lower(u.email) LIKE '%@example.com' AND lower(m.email) LIKE '%@example.com' AND substr(m.display_name, 1, 5) = 'Demo ' AND m.role <> 'admin')`;

/**
 * Clear the business tables in foreign-key order, then the demo members and
 * their auth rows. Every statement re-checks DEMO_GUARD. The service history
 * is append-only (a BEFORE DELETE trigger), so the trigger is dropped right
 * before its DELETE and re-created right after, inside the same file: wrangler
 * runs a file as one transaction (locally a D1 batch; remotely an import that
 * rolls back on failure), so a failure can't leave the trigger dropped.
 */
export function buildResetSql() {
  const G = DEMO_GUARD;
  return [
    `DELETE FROM faults WHERE ${G};`,
    "DROP TRIGGER IF EXISTS `service_records_no_delete`;",
    // Corrections first: SQLite checks the self-referencing foreign key row by row.
    // Corrections are one level deep (Phase 5 D5), so two statements clear the table.
    `DELETE FROM service_records WHERE corrects_record_id IS NOT NULL AND ${G};`,
    `DELETE FROM service_records WHERE ${G};`,
    TRIGGER_SQL.service_records_no_delete,
    `DELETE FROM checkups WHERE ${G};`,
    `DELETE FROM machine_sessions WHERE ${G};`,
    `DELETE FROM grants WHERE ${G};`,
    `DELETE FROM machine_requirements WHERE ${G};`,
    `DELETE FROM machines WHERE ${G};`,
    `DELETE FROM certifications WHERE ${G};`,
    `DELETE FROM rooms WHERE ${G};`,
    // A member suspended or reactivated by a demo staff member keeps the change, not the link
    // (demo members too: RESTRICT is checked row by row, so the DELETE below can't rely on order).
    `UPDATE members SET status_changed_by_member_id = NULL WHERE status_changed_by_member_id IN ${DEMO_MEMBER_IDS} AND ${G};`,
    `DELETE FROM session WHERE user_id IN ${DEMO_USER_IDS} AND ${G};`,
    `DELETE FROM account WHERE user_id IN ${DEMO_USER_IDS} AND ${G};`,
    `DELETE FROM members WHERE id IN ${DEMO_MEMBER_IDS} AND ${G};`,
    // The demo users are now without a membership (session/account rows cascade).
    `DELETE FROM "user" WHERE lower(email) LIKE '%@example.com' AND substr(name, 1, 5) = 'Demo ' AND id NOT IN (SELECT auth_user_id FROM members) AND ${G};`,
  ].join("\n");
}

/** One statement that reports what the database holds (for the summary line and the checks). */
export const SUMMARY_SQL = `SELECT
  (SELECT count(*) FROM rooms) AS rooms,
  (SELECT count(*) FROM certifications) AS certifications,
  (SELECT count(*) FROM machines WHERE status <> 'retired') AS machines,
  (SELECT count(*) FROM machines WHERE status = 'out_of_service') AS out_of_service,
  (SELECT count(*) FROM members WHERE id IN ${DEMO_MEMBER_IDS}) AS demo_members,
  (SELECT count(*) FROM account WHERE provider_id = 'credential' AND user_id IN ${DEMO_USER_IDS}) AS demo_sign_ins,
  (SELECT count(*) FROM members WHERE status = 'suspended') AS suspended,
  (SELECT count(*) FROM grants) AS grants,
  (SELECT count(*) FROM machine_sessions) AS sessions,
  (SELECT count(*) FROM machine_sessions WHERE ended_at IS NULL) AS open_sessions,
  (SELECT count(*) FROM service_records) AS service_records,
  (SELECT count(*) FROM checkups) AS checkups,
  (SELECT count(*) FROM faults WHERE status = 'open') AS open_faults,
  (SELECT count(*) FROM sqlite_master WHERE type = 'trigger' AND name IN ('service_records_no_update', 'service_records_no_delete')) AS triggers`;

/** The rows of statement `index` in `wrangler d1 execute --json` output. */
export function resultRows(jsonText, index = 0) {
  const start = jsonText.indexOf("[");
  if (start === -1) throw new Error("No JSON in wrangler's output");
  const results = JSON.parse(jsonText.slice(start));
  const rows = Array.isArray(results) ? results[index]?.results : undefined;
  if (!Array.isArray(rows)) throw new Error("Unexpected wrangler output");
  return rows;
}
