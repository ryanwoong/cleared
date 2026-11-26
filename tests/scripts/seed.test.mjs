import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  CHECKUPS,
  DAY_MS,
  DEMO_GUARD,
  FRESH_ADMIN,
  GRANTS,
  MEMBERS,
  SERVICE_RECORDS,
  SESSIONS,
  MACHINES,
  SUMMARY_SQL,
  TRIGGER_NAMES,
  addMonthsUtc,
  backupDirRefusal,
  backupStamp,
  buildCatalogSql,
  buildDemoSql,
  buildFreshSql,
  buildResetSql,
  buildSeedSql,
  grantState,
  grantTimes,
  isDemoName,
  parseSeedArgs,
  remoteSeedRefusal,
  resetRefusal,
  resultRows,
} from "../../scripts/lib/seed.mjs";
import { repo } from "./helpers.mjs";

const NOW = Date.UTC(2026, 10, 23, 12, 0, 0);

test("parses the seed's flags and rejects anything else", () => {
  assert.deepEqual(parseSeedArgs([]), { remote: false, persistTo: null, reset: false, fresh: false, iKnow: false, backupDir: null });
  assert.deepEqual(parseSeedArgs(["--persist-to", "/x", "--reset", "--i-know", "--backup-dir", "/b"]), {
    remote: false,
    persistTo: "/x",
    reset: true,
    fresh: false,
    iKnow: true,
    backupDir: "/b",
  });
  assert.equal(parseSeedArgs(["--fresh", "--i-know"]).fresh, true);
  assert.equal(parseSeedArgs(["--fresh", "--remote", "--i-know"]).remote, true);
  assert.ok(parseSeedArgs(["--fresh", "--reset", "--i-know"]).error);
  assert.equal(parseSeedArgs(["--remote", "--reset", "--i-know"]).remote, true);
  assert.ok(parseSeedArgs(["--wipe"]).error);
  assert.ok(parseSeedArgs(["extra"]).error);
  assert.ok(parseSeedArgs(["--persist-to"]).error);
  assert.ok(parseSeedArgs(["--persist-to", "--reset"]).error);
  assert.ok(parseSeedArgs(["--remote", "--persist-to", "/x"]).error);
  assert.ok(parseSeedArgs(["--remote", "--local"]).error);
  assert.ok(parseSeedArgs(["--i-know"]).error, "--i-know alone is a mistake");
});

test("a reset needs --i-know AND a makerspace name starting with Demo", () => {
  assert.match(resetRefusal({ iKnow: false, settingsName: "Demo Makerspace" }), /--i-know/);
  assert.match(resetRefusal({ iKnow: true, settingsName: null }), /Setup/);
  assert.match(resetRefusal({ iKnow: true, settingsName: "Campus Makerspace" }), /real makerspace/);
  assert.ok(resetRefusal({ iKnow: true, settingsName: "demo makerspace" }), "case-sensitive, like the banner");
  assert.ok(resetRefusal({ iKnow: true, settingsName: "The Demo Space" }), "must start with Demo");
  assert.equal(resetRefusal({ iKnow: true, settingsName: "Demo Makerspace" }), null);
  assert.ok(remoteSeedRefusal({ settingsName: "Campus Makerspace" }));
  assert.ok(remoteSeedRefusal({ settingsName: null }));
  assert.equal(remoteSeedRefusal({ settingsName: "Demo Makerspace" }), null);
  assert.ok(resetRefusal({ iKnow: true, settingsName: "Demolition Lab" }), "a whole word, like the banner");
  assert.equal(isDemoName("Demo"), true);
  assert.equal(isDemoName("Demo-space"), true);
  assert.equal(isDemoName("Demolition Lab"), false);
  assert.equal(isDemoName(undefined), false);
});

test("backups never go inside the repository", () => {
  assert.ok(backupDirRefusal(repo, repo));
  assert.ok(backupDirRefusal(join(repo, "backups"), repo));
  assert.equal(backupDirRefusal(join(tmpdir(), "cleared-backups"), repo), null);
  assert.equal(backupDirRefusal(join(repo, "..", "cleared-backups"), repo), null);
  assert.equal(backupStamp(Date.UTC(2026, 0, 2, 3, 4, 5)), "2026-01-02-030405");
});

test("every seeded person is a Demo @example.com member", () => {
  assert.equal(MEMBERS.length, 9);
  assert.deepEqual(MEMBERS.filter((m) => m.suspended).map((m) => m.key), ["student6"]);
  for (const m of [...MEMBERS, FRESH_ADMIN]) {
    assert.match(m.name, /^Demo /);
    assert.match(m.email, /^[a-z0-9.]+@example\.com$/);
  }
  assert.deepEqual(MEMBERS.filter((m) => m.role === "staff").map((m) => m.name), ["Demo Staff 1", "Demo Staff 2", "Demo Technician"]);
  for (const s of SERVICE_RECORDS) if (s.external) assert.match(s.external, /^Demo /);
});

test("grants: a mix of valid, expiring soon and expired, with the certifications' validity", () => {
  // Month ends and a leap day too, since expiry is calendar months.
  for (const now of [NOW, Date.UTC(2027, 2, 31, 23, 0), Date.UTC(2028, 1, 29, 1, 0), Date.UTC(2026, 0, 1)]) {
    const states = GRANTS.map((g) => grantState(now, g));
    for (const s of ["valid", "expiring", "expired", "revoked"]) assert.ok(states.includes(s), `${s} at ${new Date(now).toISOString()}`);
    for (const g of GRANTS) {
      assert.notEqual(g.member, g.by, "nobody signs themselves off");
      const { grantedAt, expiresAt } = grantTimes(now, g);
      if (g.cert === "3D Printer — Intro") assert.equal(expiresAt, null);
      else assert.equal(expiresAt, addMonthsUtc(grantedAt, g.cert === "Lathe — Basic" ? 6 : 12));
      const member = MEMBERS.find((m) => m.key === g.member);
      assert.ok(grantedAt >= now - member.joinedDaysAgo * DAY_MS, "granted after joining");
    }
  }
  assert.equal(addMonthsUtc(Date.UTC(2026, 0, 31), 1), Date.UTC(2026, 1, 28));
  assert.equal(addMonthsUtc(Date.UTC(2026, 2, 31), -1), Date.UTC(2026, 1, 28));
});

test("sessions: every user holds a valid grant; open ones are in use now", () => {
  for (const u of SESSIONS) {
    const machine = MACHINES.find((m) => m.name === u.machine);
    assert.ok(machine, u.machine);
    assert.ok(u.minutes <= 240);
    assert.equal(Boolean(u.supervised), Boolean(machine.supervised), `${u.key} acknowledges supervision only on supervised machines`);
    for (const cert of machine.requires) {
      const g = GRANTS.find((x) => x.member === u.member && x.cert === cert);
      assert.ok(g, `${u.key}: ${u.member} holds ${cert}`);
      assert.ok(["valid", "expiring"].includes(grantState(NOW - u.startedMinutesAgo * 60000, g)), `${u.key}: grant valid then`);
    }
    if (!u.ended) assert.ok(u.startedMinutesAgo < u.minutes, `${u.key} hasn't run past its expected end`);
    if (!u.ended) assert.notEqual(u.machine, "Band Saw", "not on the out-of-service machine");
  }
  assert.equal(new Set(SESSIONS.filter((u) => !u.ended).map((u) => u.machine)).size, SESSIONS.filter((u) => !u.ended).length);
});

test("history: 6 records with a vendor repair and a correction, 3 checkups", () => {
  assert.equal(SERVICE_RECORDS.length, 6);
  assert.equal(new Set(SERVICE_RECORDS.map((s) => s.machine)).size >= 3, true);
  for (const s of SERVICE_RECORDS) {
    assert.ok(Boolean(s.performer) !== Boolean(s.external), "exactly one performer");
    assert.ok(s.workDone.length >= 10 && s.workDone.length <= 2000);
  }
  assert.equal(SERVICE_RECORDS.filter((s) => s.external).length, 1);
  const corrections = SERVICE_RECORDS.filter((s) => s.corrects);
  assert.equal(corrections.length, 1);
  const original = SERVICE_RECORDS.find((s) => s.key === corrections[0].corrects);
  assert.equal(original.machine, corrections[0].machine);
  assert.equal(original.corrects, undefined);
  assert.equal(corrections[0].checkup, undefined);
  assert.equal(CHECKUPS.length, 3);
});

test("names are quoted as SQL strings", () => {
  const sql = buildCatalogSql(NOW).join("\n");
  assert.match(sql, /'Prusa MK4 #1'/);
  assert.match(sql, /'Laser Cutter — Basic'/);
  const demo = buildDemoSql(NOW, { hashes: new Map(MEMBERS.map((m) => [m.email, "ab:cd"])) }).join("\n");
  assert.match(demo, /'Correction: it is the tailstock lock/);
  assert.match(demo, /doesn''t cut/, "apostrophes are doubled");
  assert.throws(() => buildDemoSql(NOW, { hashes: new Map() }), /hash/);
  assert.throws(() => buildDemoSql(NOW, { hashes: new Map(MEMBERS.map((m) => [m.email, "x'; DROP TABLE user;--"])) }));
});

test("every demo statement and every reset DELETE re-checks the Demo name", () => {
  for (const line of buildDemoSql(NOW)) assert.ok(line.includes(DEMO_GUARD), line.slice(0, 60));
  for (const line of buildCatalogSql(NOW, { guard: DEMO_GUARD })) {
    if (line.startsWith("INSERT INTO machine_requirements")) continue; // only for a machine this run inserted
    assert.ok(line.includes(DEMO_GUARD), line.slice(0, 60));
  }
  const reset = buildResetSql().split("\n");
  for (const line of reset.filter((l) => /^(DELETE|UPDATE)/.test(l))) assert.ok(line.includes(DEMO_GUARD), line.slice(0, 60));
});

test("the reset only removes @example.com members named Demo (never admins)", () => {
  const reset = buildResetSql();
  for (const table of ["session", "account", "members", '"user"']) {
    const line = reset.split("\n").find((l) => l.startsWith(`DELETE FROM ${table} `));
    assert.ok(line, table);
    assert.match(line, /LIKE '%@example\.com'/);
    assert.match(line, /substr\((m\.display_name|name), 1, 5\) = 'Demo '/);
    if (table !== '"user"') assert.match(line, /m\.role <> 'admin'/);
    else assert.match(line, /id NOT IN \(SELECT auth_user_id FROM members\)/);
  }
  // FK-safe order, and the append-only trigger is dropped only around its DELETE.
  const order = ["faults", "service_records", "checkups", "machine_sessions", "grants", "machine_requirements", "machines", "certifications", "rooms", "session", "account", "members", '"user"'];
  const positions = order.map((t) => reset.indexOf(`DELETE FROM ${t} `));
  assert.deepEqual([...positions].sort((a, b) => a - b), positions);
  const lines = reset.split("\n");
  const drop = lines.findIndex((l) => l.startsWith("DROP TRIGGER"));
  assert.match(lines[drop + 1], /^DELETE FROM service_records WHERE corrects_record_id IS NOT NULL/);
  assert.match(lines[drop + 2], /^DELETE FROM service_records /);
  assert.match(lines[drop + 3], /^CREATE TRIGGER IF NOT EXISTS `service_records_no_delete`/);
});

test("the re-created triggers match the migration exactly", () => {
  const migration = readFileSync(join(repo, "drizzle", "0005_faults_service.sql"), "utf8");
  const seed = buildSeedSql(NOW, { demo: false });
  for (const name of TRIGGER_NAMES) {
    const re = new RegExp("CREATE TRIGGER `" + name + "`[^;]*;[^;]*;");
    const fromMigration = migration.match(re)[0];
    assert.ok(seed.includes(fromMigration.replace("CREATE TRIGGER ", "CREATE TRIGGER IF NOT EXISTS ")), name);
  }
});

test("reads rows from wrangler's JSON", () => {
  assert.deepEqual(resultRows('banner\n[{"results":[{"name":"Demo Makerspace"}],"success":true}]'), [{ name: "Demo Makerspace" }]);
  assert.throws(() => resultRows("no json"));
});

/* ------------------------------------------------- against a real SQLite */

let sqlite = null;
try {
  sqlite = await import("node:sqlite");
} catch {
  // Node < 22.13 without --experimental-sqlite: the SQL tests below are skipped.
}

function freshDb() {
  const db = new sqlite.DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON");
  const dir = join(repo, "drizzle");
  for (const f of readdirSync(dir).filter((f) => /^\d{4}_.*\.sql$/.test(f)).sort()) db.exec(readFileSync(join(dir, f), "utf8"));
  db.exec(`INSERT INTO "user" (id, name, email, email_verified, created_at, updated_at) VALUES ('u-admin', 'Admin', 'admin@school.test', 0, 1, 1);
    INSERT INTO settings (id, name, timezone, member_join_token, join_token_rotated_at, data_version, created_at, updated_at)
      VALUES ('singleton', 'Campus Makerspace', 'America/Edmonton', 'tok', 1, 1, 1, 1);
    INSERT INTO members (id, auth_user_id, email, display_name, role, status, created_at, updated_at)
      VALUES ('m-admin', 'u-admin', 'admin@school.test', 'Admin', 'admin', 'active', 1, 1);`);
  return db;
}
const count = (db, sql) => Object.values(db.prepare(sql).get())[0];
const summary = (db) => ({ ...db.prepare(SUMMARY_SQL).get() });
const hashes = new Map(MEMBERS.map((m) => [m.email, "ab12:cd34"]));

test("SQLite: a non-Demo makerspace gets only the catalog; reset deletes nothing", { skip: !sqlite }, () => {
  const db = freshDb();
  db.exec(buildSeedSql(NOW, { demo: true, hashes })); // even if asked, the SQL guard holds
  const s = summary(db);
  assert.equal(s.machines, 10);
  assert.equal(s.demo_members, 0);
  assert.equal(s.grants, 0);
  db.exec(buildResetSql());
  assert.equal(count(db, "SELECT count(*) FROM machines"), 10);
  assert.equal(s.triggers, 2);
  assert.equal(count(db, "SELECT count(*) FROM sqlite_master WHERE type = 'trigger'"), 2);
});

test("SQLite: the SQL guard agrees with isDemoName()", { skip: !sqlite }, () => {
  const db = freshDb();
  for (const name of ["Demo", "Demo Makerspace", "Demo-space", "Demolition Lab", "demo makerspace", "Campus Demo", "Demo_x", "Demo2"]) {
    db.prepare("UPDATE settings SET name = ?").run(name.length < 2 ? name + "?" : name);
    const stored = db.prepare("SELECT name FROM settings").get().name;
    assert.equal(count(db, `SELECT ${DEMO_GUARD}`) === 1, isDemoName(stored), stored);
  }
});

test("SQLite: seed, seed again, reset and re-seed; real accounts survive", { skip: !sqlite }, () => {
  const db = freshDb();
  db.exec("UPDATE settings SET name = 'Demo Makerspace'");
  const triggersBefore = db.prepare("SELECT name, sql FROM sqlite_master WHERE type = 'trigger' ORDER BY name").all();
  db.exec(buildSeedSql(NOW, { demo: true, hashes }));
  const first = summary(db);
  assert.deepEqual(
    { ...first },
    {
      rooms: 4,
      certifications: 4,
      machines: 10,
      out_of_service: 1,
      demo_members: 9,
      demo_sign_ins: 9,
      suspended: 1,
      grants: 22,
      sessions: 10,
      open_sessions: 3,
      service_records: 6,
      checkups: 3,
      open_faults: 1,
      triggers: 2,
    },
  );
  const oos = db.prepare("SELECT name, out_of_service_reason, status_note FROM machines WHERE status = 'out_of_service'").get();
  assert.equal(oos.name, "Band Saw");
  assert.ok(oos.status_note);

  db.exec(buildSeedSql(NOW + 1000, { demo: true, hashes }));
  assert.deepEqual(summary(db), first, "idempotent");
  assert.equal(count(db, "SELECT data_version FROM settings"), 3);

  // A real account on an @example.com address, a real "Demo …" name elsewhere, and their rows.
  db.exec(`INSERT INTO "user" (id, name, email, email_verified, created_at, updated_at) VALUES
      ('u-real', 'Real Person', 'real@example.com', 0, 1, 1), ('u-look', 'Demo Lookalike', 'demo@school.test', 0, 1, 1);
    INSERT INTO members (id, auth_user_id, email, display_name, role, status, created_at, updated_at, status_changed_at, status_changed_by_member_id)
      VALUES ('m-real', 'u-real', 'real@example.com', 'Real Person', 'member', 'active', 1, 1, 2,
        (SELECT id FROM members WHERE email = 'demo.staff1@example.com')),
      ('m-look', 'u-look', 'demo@school.test', 'Demo Lookalike', 'member', 'active', 1, 1, NULL, NULL);
    INSERT INTO account (id, account_id, provider_id, user_id, password, created_at, updated_at) VALUES ('a-real', 'u-real', 'credential', 'u-real', 'x:y', 1, 1);
    INSERT INTO session (id, expires_at, token, created_at, updated_at, user_id) VALUES
      ('s-real', 9, 't1', 1, 1, 'u-real'),
      ('s-demo', 9, 't2', 1, 1, (SELECT id FROM "user" WHERE email = 'demo.student1@example.com'));`);
  assert.throws(() => db.exec("DELETE FROM service_records"), /append-only/);

  db.exec("BEGIN");
  db.exec(buildResetSql());
  db.exec(buildSeedSql(NOW, { demo: true, hashes }));
  db.exec("COMMIT");
  assert.deepEqual(summary(db), first);
  assert.deepEqual(db.prepare("SELECT name, sql FROM sqlite_master WHERE type = 'trigger' ORDER BY name").all(), triggersBefore);
  assert.deepEqual(
    db.prepare("SELECT id FROM members WHERE id IN ('m-admin', 'm-real', 'm-look') ORDER BY id").all().map((r) => r.id),
    ["m-admin", "m-look", "m-real"],
  );
  assert.equal(count(db, "SELECT status_changed_by_member_id FROM members WHERE id = 'm-real'"), null);
  assert.equal(count(db, "SELECT count(*) FROM account WHERE id = 'a-real'"), 1);
  assert.deepEqual(db.prepare("SELECT id FROM session").all().map((r) => r.id), ["s-real"]);
  assert.equal(count(db, `SELECT count(*) FROM "user" WHERE email LIKE 'demo.%@example.com'`), 9);
  assert.throws(() => db.exec("DELETE FROM service_records"), /append-only/);
});

test("SQLite: --fresh wipes everything, accounts and settings included, then seeds a complete demo", { skip: !sqlite }, () => {
  const db = freshDb(); // a real "Campus Makerspace" with its admin
  db.exec(`INSERT INTO session (id, expires_at, token, created_at, updated_at, user_id) VALUES ('s-admin', 9, 't1', 1, 1, 'u-admin');
    INSERT INTO verification (id, identifier, value, expires_at) VALUES ('v1', 'x', 'y', 9);
    INSERT INTO rate_limit (id, key, count, last_request) VALUES ('r1', 'k', 1, 1);`);
  db.exec(buildSeedSql(NOW, { demo: false })); // some catalog rows to wipe
  const freshHashes = new Map([...hashes, [FRESH_ADMIN.email, "ab12:cd34"]]);
  assert.throws(() => buildFreshSql(NOW, { hashes }), /admin password hash/);

  db.exec("BEGIN");
  db.exec(buildFreshSql(NOW, { hashes: freshHashes }));
  db.exec("COMMIT");
  assert.equal(count(db, "SELECT name FROM settings"), "Demo Makerspace");
  assert.equal(count(db, `SELECT count(*) FROM "user" WHERE id = 'u-admin'`), 0, "the old accounts are gone");
  assert.equal(count(db, "SELECT count(*) FROM session"), 0);
  assert.equal(count(db, "SELECT count(*) FROM verification"), 0);
  assert.equal(count(db, "SELECT count(*) FROM rate_limit"), 0);
  assert.equal(count(db, `SELECT count(*) FROM members m JOIN account a ON a.user_id = m.auth_user_id WHERE m.role = 'admin' AND m.email = '${FRESH_ADMIN.email}'`), 1);
  assert.equal(count(db, "SELECT count(*) FROM members"), 10);
  const s = summary(db);
  assert.equal(s.machines, 10);
  assert.equal(s.demo_sign_ins, 9);
  assert.equal(s.grants, 22);
  assert.equal(s.open_sessions, 3);
  assert.equal(s.triggers, 2);

  // Again on top of itself, and a --reset afterwards keeps the admin.
  db.exec("BEGIN");
  db.exec(buildFreshSql(NOW + 1000, { hashes: freshHashes }));
  db.exec("COMMIT");
  assert.deepEqual(summary(db), s);
  db.exec("BEGIN");
  db.exec(buildResetSql());
  db.exec(buildSeedSql(NOW, { demo: true, hashes }));
  db.exec("COMMIT");
  assert.deepEqual(summary(db), s);
  assert.equal(count(db, "SELECT count(*) FROM members WHERE role = 'admin'"), 1);
  assert.throws(() => db.exec("DELETE FROM service_records"), /append-only/);
});

/* -------------------------------------------------- scripts/reset-demo.sh */

test("reset-demo.sh rejects unexpected arguments and needs --i-know", () => {
  const run = (args) => spawnSync("bash", [join(repo, "scripts", "reset-demo.sh"), ...args], { encoding: "utf8" });
  const bad = run(["--i-know", "--force"]);
  assert.equal(bad.status, 2);
  assert.match(bad.stderr, /unexpected argument '--force'/);
  const none = run([]);
  assert.equal(none.status, 2);
  assert.match(none.stderr, /--i-know/);
});
