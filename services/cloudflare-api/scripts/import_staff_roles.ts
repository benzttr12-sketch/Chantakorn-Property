/**
 * Operator CLI: plan a verified D1 staff-role bootstrap from local exports.
 *
 *   node --experimental-strip-types scripts/import_staff_roles.ts \
 *     --auth /secure/users.json \
 *     --profiles /secure/profiles.ndjson \
 *     --approved /secure/approved-uids.txt
 *
 * Add `--write --sql-out /outside/repo/staff-import.sql --manifest-out /outside/repo/staff-import.manifest.json`
 * to write files. The SQL only inserts missing rows; existing D1 profiles are
 * never modified. This tool performs no network or database access.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildStaffImport } from '../src/staff-import.ts';

const USAGE = 'node --experimental-strip-types scripts/import_staff_roles.ts --auth FILE --profiles FILE --approved FILE [--write --sql-out FILE --manifest-out FILE]';
const repoRoot = resolve(fileURLToPath(new URL('../../../', import.meta.url)));

type Options = {
  auth?: string; profiles?: string; approved?: string;
  sqlOut?: string; manifestOut?: string; write: boolean;
};

function parseArgs(argv: string[]): Options {
  const options: Options = { write: false };
  const valueFlags: Record<string, keyof Options> = {
    '--auth': 'auth', '--profiles': 'profiles', '--approved': 'approved',
    '--sql-out': 'sqlOut', '--manifest-out': 'manifestOut',
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === '--write') { options.write = true; continue; }
    if (arg === '--help' || arg === '-h') { console.log(USAGE); process.exitCode = 0; throw new Error('__help__'); }
    const key = valueFlags[arg];
    if (!key) throw new Error(`Unknown argument: ${arg}\n${USAGE}`);
    const value = argv[++i];
    if (!value || value.startsWith('--')) throw new Error(`Missing value for ${arg}\n${USAGE}`);
    (options as Record<string, unknown>)[key] = value;
  }
  return options;
}

function outsideRepository(value: string, label: string): string {
  const absolute = resolve(value);
  if (absolute === repoRoot || absolute.startsWith(repoRoot + sep))
    throw new Error(`${label} must be outside the Git repository; exported staff data must never be committed`);
  if (existsSync(absolute)) throw new Error(`${label} already exists; refusing to overwrite`);
  return absolute;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (!options.auth || !options.profiles || !options.approved) throw new Error(`Missing required export paths\n${USAGE}`);
  const result = await buildStaffImport({
    authText: readFileSync(options.auth, 'utf8'),
    profilesText: readFileSync(options.profiles, 'utf8'),
    approvedText: readFileSync(options.approved, 'utf8'),
  });
  if (!result.ok) {
    console.error(JSON.stringify({ ok: false, errors: result.errors }, null, 2));
    process.exitCode = 1;
    return;
  }
  const inputs = result.manifest.inputs as Record<string, string>;
  const summary = {
    ok: true,
    entries: result.plan.inserts.length,
    by_role: result.plan.byRole,
    skipped_user: result.plan.skippedUser,
    profiles_seen: result.plan.profilesSeen,
    auth_sha256: inputs.auth_sha256,
    profiles_sha256: inputs.profiles_sha256,
    approved_sha256: inputs.approved_sha256,
  };
  if (!options.write) {
    console.log(JSON.stringify({ ...summary, sql_written: false,
      next: 'Review the summary, then re-run with --write --sql-out FILE --manifest-out FILE (paths outside the repository)' }, null, 2));
    return;
  }
  if (!options.sqlOut || !options.manifestOut)
    throw new Error('--write requires both --sql-out and --manifest-out paths outside the repository');
  const sqlPath = outsideRepository(options.sqlOut, '--sql-out');
  const manifestPath = outsideRepository(options.manifestOut, '--manifest-out');
  writeFileSync(sqlPath, result.sql, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
  writeFileSync(manifestPath, JSON.stringify(result.manifest, null, 2) + '\n', { encoding: 'utf8', mode: 0o600, flag: 'wx' });
  console.log(JSON.stringify({ ...summary, sql_written: true, manifest_written: true }, null, 2));
}

main().catch(error => {
  if (error instanceof Error && error.message === '__help__') return;
  console.error(JSON.stringify({ ok: false, errors: [error instanceof Error ? error.message : 'Unexpected failure'] }, null, 2));
  process.exitCode = 2;
});
