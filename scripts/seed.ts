/**
 * `npm run db:seed`: loads clearly fake demo data (docs/seed.md, Phase 7 §3.7).
 *
 *   npm run db:seed                                   your local D1 (.wrangler/state)
 *   npm run db:seed -- --persist-to <dir>             another local D1 state directory
 *   npm run db:seed -- --reset --i-know               back up, clear and re-seed the local D1
 *   bash scripts/reset-demo.sh --i-know               the same on the deployment (--remote)
 *
 * Complete Setup first (the settings row must exist). The catalog (rooms,
 * certifications, machines) always loads, skipping names that already exist.
 * Demo members, grants, service history, checkups, faults and the
 * out-of-service machine load only while the makerspace name starts with the word
 * "Demo" (rename it in Settings, e.g. "Demo Makerspace"): fake history never
 * lands in a real makerspace. Running it twice adds nothing.
 *
 * Locally every demo member gets an email + password account (hashed here with
 * Better Auth's `hashPassword`, no Worker CPU); the password is in
 * docs/seed.md. On the deployment demo members get no account: they only
 * populate history and can't sign in (P7-71).
 *
 * `--reset` refuses unless `--i-know` is passed AND the makerspace name starts
 * with the word "Demo". It backs up first (default ~/cleared-backups, never inside the
 * repository), then clears the business tables and the demo members and
 * re-seeds, all in one file that wrangler runs as one transaction.
 *
 * Nothing personal is printed: no names, emails or passwords.
 */
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { homedir, tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { hashPassword } from "better-auth/crypto";
import {
  MEMBERS,
  SEED_USAGE,
  SUMMARY_SQL,
  backupDirRefusal,
  backupStamp,
  buildResetSql,
  buildSeedSql,
  isDemoName,
  parseSeedArgs,
  remoteSeedRefusal,
  resetRefusal,
  resultRows,
} from "./lib/seed.mjs";

/** The local demo password (docs/seed.md). Only ever used against a local D1. */
const LOCAL_DEMO_PASSWORD = "cleared-demo-pass";

const require = createRequire(import.meta.url);
const repoRoot = resolve(dirname(require.resolve("../package.json")));

// Wrangler's JS entry, run with this Node binary (no npx.cmd on Windows), as in cf-typegen.mjs.
function wranglerBin(): string {
  const pkg = require.resolve("wrangler/package.json");
  return join(dirname(pkg), JSON.parse(readFileSync(pkg, "utf8")).bin.wrangler);
}

function fail(message: string, code = 1): never {
  console.error(`db:seed: ${message}`);
  process.exit(code);
}

async function main() {
  const args = parseSeedArgs(process.argv.slice(2));
  if ("error" in args) {
    console.error(`db:seed: ${args.error}`);
    console.error(SEED_USAGE);
    process.exit(2);
  }
  if (args.reset && !args.iKnow) fail(`refusing to reset: ${resetRefusal({ iKnow: false, settingsName: null })}`, 2);

  const where = args.remote ? "on the deployment" : "in the local database";
  const target = args.remote
    ? ["--remote", "--config", "wrangler.deploy.jsonc"]
    : ["--local", ...(args.persistTo ? ["--persist-to", args.persistTo] : [])];

  const wrangler = (wargs: string[], capture: boolean) => {
    const r = spawnSync(process.execPath, [wranglerBin(), ...wargs], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", capture ? "pipe" : "ignore", "inherit"],
    });
    return { status: r.status ?? 1, stdout: r.stdout ?? "" };
  };
  const query = (sql: string) => {
    const r = wrangler(["d1", "execute", "DB", ...target, "--json", "--command", sql], true);
    if (r.status !== 0) fail(`wrangler d1 execute failed (see above).${args.remote ? "" : " Run `npm run db:migrate` first."}`);
    return resultRows(r.stdout);
  };

  if (args.remote) {
    const render = spawnSync(process.execPath, ["scripts/render-wrangler.mjs"], { cwd: repoRoot, stdio: "inherit" });
    if (render.status !== 0) process.exit(render.status ?? 1);
  }

  const settingsRow = query("SELECT name FROM settings WHERE id = 'singleton'")[0] as { name: string } | undefined;
  const settingsName = settingsRow?.name ?? null;
  if (settingsName === null) fail("this database has no makerspace yet. Complete Setup in the app first, then run the seed.");
  const demo = isDemoName(settingsName);

  if (args.reset) {
    const refusal = resetRefusal({ iKnow: args.iKnow, settingsName });
    if (refusal) fail(`refusing to reset: ${refusal}`, 2);
  }
  if (args.remote) {
    const refusal = remoteSeedRefusal({ settingsName });
    if (refusal) fail(`refusing: ${refusal}`, 2);
  }

  // Back up before deleting anything.
  if (args.reset) {
    const dir = resolve(args.backupDir ?? join(homedir(), "cleared-backups"));
    const refusal = backupDirRefusal(dir, repoRoot);
    if (refusal) fail(`refusing to reset: ${refusal}`, 2);
    mkdirSync(dir, { recursive: true });
    const now = Date.now();
    if (args.remote) {
      const file = join(dir, `cleared-${backupStamp(now)}-before-reset.sql`);
      const r = wrangler(["d1", "export", "DB", "--remote", "--config", "wrangler.deploy.jsonc", `--output=${file}`], false);
      if (r.status !== 0 || !existsSync(file) || statSync(file).size === 0) {
        fail("the backup export failed (see above). Nothing was deleted.");
      }
      console.log(`db:seed: backed up the deployment's database to ${file}`);
    } else {
      // `wrangler d1 export --local` can't read a --persist-to directory, so copy the
      // local D1 files instead (restore: copy the folder back while nothing is running).
      const source = join(resolve(repoRoot, args.persistTo ?? ".wrangler/state"), "v3", "d1");
      if (!existsSync(source)) fail("no local database found to back up. Run `npm run db:migrate` first.");
      const copy = join(dir, `cleared-local-${backupStamp(now)}-before-reset`);
      cpSync(source, copy, { recursive: true, errorOnExist: true });
      console.log(`db:seed: backed up the local database files to ${copy}`);
    }
  }

  let hashes: Map<string, string> | null = null;
  if (!args.remote && demo) {
    hashes = new Map();
    for (const m of MEMBERS) hashes.set(m.email, await hashPassword(LOCAL_DEMO_PASSWORD));
  }

  const sql = [
    ...(args.reset ? [buildResetSql()] : []),
    buildSeedSql(Date.now(), { demo, remote: args.remote, hashes }),
  ].join("\n");

  const tmp = mkdtempSync(join(tmpdir(), "cleared-seed-"));
  try {
    const file = join(tmp, "seed.sql");
    writeFileSync(file, sql, { mode: 0o600 });
    // One file = one transaction (locally a D1 batch; remotely an import that rolls back on failure).
    const r = wrangler(["d1", "execute", "DB", ...target, "--yes", "--file", file], false);
    if (r.status !== 0) {
      fail(`wrangler d1 execute failed (see above). Nothing was changed${args.reset ? " (the backup is still there)" : ""}.`);
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }

  const summary = query(SUMMARY_SQL)[0] as Record<string, number>;
  if (summary.triggers !== 2) {
    fail(
      "the service history's append-only triggers are missing. Run the seed again (it re-creates them) " +
        "or re-apply them from drizzle/0005_faults_service.sql.",
    );
  }
  console.log(
    `db:seed: ${args.reset ? "reset and re-seeded" : "seeded"} ${where}: ` +
      `${summary.rooms} rooms, ${summary.certifications} certifications, ${summary.machines} machines ` +
      `(${summary.out_of_service} out of service), ${summary.demo_members} demo members ` +
      `(${summary.demo_sign_ins} can sign in, ${summary.suspended} suspended), ${summary.grants} grants, ` +
      `${summary.sessions} machine sessions (${summary.open_sessions} in use now), ${summary.service_records} service records, ` +
      `${summary.checkups} checkups, ${summary.open_faults} open faults. Existing names were skipped.`,
  );
  if (!demo) {
    console.log(
      'db:seed: note: the makerspace name doesn\'t start with the word "Demo", so only the catalog was loaded. ' +
        'To load demo members and history, rename it (e.g. "Demo Makerspace") in Settings and run the seed again.',
    );
  } else if (!args.remote) {
    console.log("db:seed: demo members sign in with the password in docs/seed.md (local only).");
  }
}

main().catch((err: unknown) => {
  console.error("db:seed: failed:", err instanceof Error ? `${err.name}: ${err.message}` : "error");
  process.exit(1);
});
