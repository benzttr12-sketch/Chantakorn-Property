import { spawnSync } from 'node:child_process';

function git(...args) {
  const result = spawnSync('git', args, { encoding: 'utf8' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error('Unable to identify the Worker source revision.');
  return result.stdout.trim();
}

// A clean checkout makes the public revision identify the exact deployed source.
if (git('status', '--porcelain')) {
  throw new Error('Commit or stash local changes before deploying the Worker.');
}
const revision = git('rev-parse', 'HEAD');
const result = spawnSync(process.execPath, [
  'node_modules/wrangler/bin/wrangler.js', 'deploy',
  '--config', 'wrangler.jsonc', '--keep-vars',
  '--var', `APP_BUILD_SHA:${revision}`,
  ...process.argv.slice(2),
], { stdio: 'inherit' });
if (result.error) throw result.error;
process.exit(result.status ?? 1);
