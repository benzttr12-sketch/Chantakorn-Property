const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const repository = path.resolve(__dirname, '..');
const script = path.join(repository, 'scripts/admin-backup-vault.ps1');
const windows = process.platform === 'win32';
const powershell = 'pwsh.exe';

function fixture(t) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'chantakorn-vault-test-'));
  t.after(() => {
    const real = fs.realpathSync(base);
    const relative = path.relative(fs.realpathSync(os.tmpdir()), real);
    assert.ok(relative && !relative.startsWith('..') && !path.isAbsolute(relative));
    assert.ok(path.basename(real).startsWith('chantakorn-vault-test-'));
    fs.rmSync(base, { recursive: true, force: true });
  });
  return { base, archives: path.join(base, 'archives'), keys: path.join(base, 'keys') };
}
function run(args, env = {}) {
  const result = spawnSync(powershell, ['-NoProfile', '-NonInteractive', '-File', script, ...args], {
    encoding: 'utf8', timeout: 30000, env: { ...process.env, ...env },
  });
  if (result.error) throw result.error;
  return result;
}

test('admin vault keeps ciphertext archives and DPAPI custody outside source control', () => {
  const source = fs.readFileSync(script, 'utf8');
  assert.match(source, /WindowsCurrentUserDPAPI/);
  assert.match(source, /SetAccessRuleProtection\(\$true, \$false\)/);
  assert.match(source, /FileMode\]::CreateNew/);
  assert.match(source, /ZeroFreeBSTR/);
  assert.match(source, /cutoverReady = \$false/);
  assert.doesNotMatch(source, /Write-(?:Host|Output).*Passphrase/i);
});

test('vault preparation generates a recoverable user-DPAPI key and private directory ACLs without exports', { skip: !windows }, t => {
  const f = fixture(t);
  const result = run(['-Action', 'Prepare', '-ArchiveRoot', f.archives, '-KeyRoot', f.keys]);
  assert.equal(result.status, 0, result.stderr);
  const prepared = JSON.parse(result.stdout);
  assert.equal(prepared.exported, false);
  assert.equal(prepared.keyProtection, 'WindowsCurrentUserDPAPI');
  const keyFile = path.join(f.keys, `${prepared.snapshotId}.dpapi`);
  assert.ok(fs.existsSync(keyFile));
  const validation = spawnSync(powershell, ['-NoProfile', '-NonInteractive', '-Command', `
    $ErrorActionPreference = 'Stop'
    $owner = [Security.Principal.WindowsIdentity]::GetCurrent().User
    $private = $true
    foreach ($dir in @($env:TEST_VAULT_ARCHIVES, $env:TEST_VAULT_KEYS)) {
      $acl = Get-Acl -LiteralPath $dir
      if (-not $acl.AreAccessRulesProtected) { $private = $false }
      foreach ($ace in $acl.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier])) {
        if ($ace.AccessControlType -eq 'Allow' -and $ace.IdentityReference.Value -ne $owner.Value) { $private = $false }
      }
    }
    $secret = ConvertTo-SecureString ([IO.File]::ReadAllText($env:TEST_VAULT_KEY))
    try { @{ private = $private; keyLength = $secret.Length } | ConvertTo-Json -Compress }
    finally { $secret.Dispose() }
  `], { encoding: 'utf8', timeout: 30000, env: { ...process.env, TEST_VAULT_ARCHIVES: f.archives, TEST_VAULT_KEYS: f.keys, TEST_VAULT_KEY: keyFile } });
  assert.equal(validation.status, 0, validation.stderr);
  assert.deepEqual(JSON.parse(validation.stdout), { private: true, keyLength: 64 });
  assert.equal(fs.readdirSync(prepared.archiveDirectory).some(name => name.endsWith('.enc')), false);
  const state = JSON.parse(fs.readFileSync(path.join(prepared.archiveDirectory, 'snapshot.json'), 'utf8'));
  assert.equal(state.sourceWritesPaused, false);
  assert.equal(state.cutoverReady, false);
  const reopened = run(['-Action', 'Prepare', '-SnapshotId', prepared.snapshotId, '-ArchiveRoot', f.archives, '-KeyRoot', f.keys]);
  assert.equal(reopened.status, 0, reopened.stderr);
  assert.equal(JSON.parse(reopened.stdout).snapshotId, prepared.snapshotId);
  assert.equal(fs.readdirSync(f.keys).filter(name => name.endsWith('.dpapi')).length, 1);
});

test('vault rejects source-tree destinations, nested key custody and unowned existing directories', { skip: !windows }, t => {
  const f = fixture(t);
  const forbidden = path.join(repository, `.vault-must-not-exist-${path.basename(f.base)}`);
  assert.equal(run(['-ArchiveRoot', forbidden, '-KeyRoot', f.keys]).status, 1);
  assert.equal(fs.existsSync(forbidden), false);
  assert.equal(run(['-ArchiveRoot', f.archives, '-KeyRoot', path.join(f.archives, 'keys')]).status, 1);
  assert.equal(fs.existsSync(f.archives), false);
  fs.mkdirSync(f.archives);
  fs.writeFileSync(path.join(f.archives, 'unrelated.txt'), 'preserve fixture');
  assert.equal(run(['-ArchiveRoot', f.archives, '-KeyRoot', f.keys]).status, 1);
  assert.equal(fs.readFileSync(path.join(f.archives, 'unrelated.txt'), 'utf8'), 'preserve fixture');
});

test('vault rejects junction traversal and unapproved backup reads before creating snapshots', { skip: !windows }, t => {
  const f = fixture(t);
  const target = path.join(f.base, 'target');
  fs.mkdirSync(target);
  const junction = path.join(f.base, 'junction');
  fs.symlinkSync(target, junction, 'junction');
  assert.equal(run(['-ArchiveRoot', junction, '-KeyRoot', f.keys]).status, 1);
  assert.deepEqual(fs.readdirSync(target), []);
  assert.equal(run(['-Action', 'Backup', '-ArchiveRoot', f.archives, '-KeyRoot', f.keys]).status, 1);
  assert.equal(fs.existsSync(f.archives), false);
  assert.equal(run(['-Action', 'Verify', '-SnapshotId', '..', '-ArchiveRoot', f.archives, '-KeyRoot', f.keys]).status, 1);
});
