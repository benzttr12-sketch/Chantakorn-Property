#requires -Version 7.0
[CmdletBinding()]
param(
    [ValidateSet('Prepare', 'Backup', 'Verify', 'Reconcile')][string]$Action = 'Prepare',
    [string]$ArchiveRoot = (Join-Path $env:USERPROFILE 'Chantakorn-Backups'),
    [string]$KeyRoot = (Join-Path $env:LOCALAPPDATA 'Chantakorn\BackupKeys'),
    [string]$SnapshotId,
    [ValidateSet('Firestore', 'Auth', 'R2')][string[]]$Sources = @('Firestore', 'Auth', 'R2'),
    [switch]$AllowProductionReads
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$backupRepository = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..')).TrimEnd('\')
$vaultPhase = 'preflight'

function Assert-VaultPath([string]$Candidate) {
    if ($Candidate -notmatch '^[A-Za-z]:[\\/]') { throw 'Backup vault requires an absolute local drive path.' }
    $resolved = [IO.Path]::GetFullPath($Candidate).TrimEnd('\')
    if ($resolved.Equals($backupRepository, [StringComparison]::OrdinalIgnoreCase) -or
        $resolved.StartsWith($backupRepository + '\', [StringComparison]::OrdinalIgnoreCase)) {
        throw 'Backup vault must be outside the repository.'
    }
    $ancestor = $resolved
    while ($ancestor) {
        if (Test-Path -LiteralPath $ancestor) {
            $entry = Get-Item -LiteralPath $ancestor -Force
            if (($entry.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
                throw 'Backup vault cannot traverse links or junctions.'
            }
            if ($entry.PSIsContainer -and (Test-Path -LiteralPath (Join-Path $ancestor '.git'))) {
                throw 'Backup vault cannot be inside another Git checkout.'
            }
        }
        $nextAncestor = [IO.Path]::GetDirectoryName($ancestor)
        if ($nextAncestor -eq $ancestor) { break }
        $ancestor = $nextAncestor
    }
    return $resolved
}

function Set-PrivateDirectory([string]$Directory, [Security.Principal.SecurityIdentifier]$OwnerSid) {
    $directoryCreated = -not (Test-Path -LiteralPath $Directory)
    if ($directoryCreated) { [void][IO.Directory]::CreateDirectory($Directory) }
    $beforeAcl = Get-Acl -LiteralPath $Directory
    $vaultAcl = [Security.AccessControl.DirectorySecurity]::new()
    if ($beforeAcl.GetOwner([Security.Principal.SecurityIdentifier]).Value -ne $OwnerSid.Value) {
        if (-not $directoryCreated) { throw 'Existing backup directory belongs to another account.' }
        $vaultAcl.SetOwner($OwnerSid)
    }
    $vaultAcl.SetAccessRuleProtection($true, $false)
    $rule = [Security.AccessControl.FileSystemAccessRule]::new(
        $OwnerSid, [Security.AccessControl.FileSystemRights]::FullControl,
        [Security.AccessControl.InheritanceFlags]'ContainerInherit,ObjectInherit',
        [Security.AccessControl.PropagationFlags]::None, [Security.AccessControl.AccessControlType]::Allow)
    [void]$vaultAcl.AddAccessRule($rule)
    [IO.FileSystemAclExtensions]::SetAccessControl([IO.DirectoryInfo]::new($Directory), $vaultAcl)
    $verifiedAcl = Get-Acl -LiteralPath $Directory
    if (-not $verifiedAcl.AreAccessRulesProtected -or
        $verifiedAcl.GetOwner([Security.Principal.SecurityIdentifier]).Value -ne $OwnerSid.Value) {
        throw 'Backup directory ownership or ACL could not be verified.'
    }
    foreach ($ace in $verifiedAcl.GetAccessRules($true, $true, [Security.Principal.SecurityIdentifier])) {
        if ($ace.AccessControlType -eq 'Allow' -and $ace.IdentityReference.Value -ne $OwnerSid.Value) {
            throw 'Backup directory grants access to another account.'
        }
    }
}

function Open-VaultRoot([string]$Directory, [Security.Principal.SecurityIdentifier]$OwnerSid) {
    $marker = Join-Path $Directory '.chantakorn-admin-vault'
    if ((Test-Path -LiteralPath $Directory) -and -not (Test-Path -LiteralPath $marker -PathType Leaf)) {
        throw 'Existing directory is not an initialized Chantakorn admin vault.'
    }
    Set-PrivateDirectory $Directory $OwnerSid
    if (-not (Test-Path -LiteralPath $marker)) {
        [IO.File]::WriteAllText($marker, 'Windows current-user private backup vault v1')
    }
}

function Write-NewTextFile([string]$FilePath, [string]$Contents) {
    $vaultStream = [IO.File]::Open($FilePath, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::None)
    try {
        $vaultBytes = [Text.Encoding]::UTF8.GetBytes($Contents)
        $vaultStream.Write($vaultBytes, 0, $vaultBytes.Length)
    } finally { $vaultStream.Dispose() }
}

try {
    if ($env:OS -ne 'Windows_NT') { throw 'This vault requires Windows DPAPI and NTFS access control.' }
    if ($Sources.Count -eq 0 -or @($Sources | Select-Object -Unique).Count -ne $Sources.Count) { throw 'Choose at least one distinct backup source.' }
    if ($Action -eq 'Backup' -and -not $AllowProductionReads) { throw 'Backup requires explicit -AllowProductionReads.' }
    $vaultIdentity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $archiveDirectory = Assert-VaultPath $ArchiveRoot
    $keyDirectory = Assert-VaultPath $KeyRoot
    if ($archiveDirectory.Equals($keyDirectory, [StringComparison]::OrdinalIgnoreCase) -or
        $archiveDirectory.StartsWith($keyDirectory + '\', [StringComparison]::OrdinalIgnoreCase) -or
        $keyDirectory.StartsWith($archiveDirectory + '\', [StringComparison]::OrdinalIgnoreCase)) {
        throw 'Archive and key directories must be separate.'
    }
    if ($Action -in @('Verify', 'Reconcile') -and -not $SnapshotId) { throw 'Verification requires a snapshot identifier.' }
    if ($SnapshotId -and $SnapshotId -notmatch '^\d{8}T\d{6}Z-[a-f0-9]{12}$') { throw 'Invalid snapshot identifier.' }
    $vaultPhase = 'directory-access'
    Open-VaultRoot $archiveDirectory $vaultIdentity.User
    Open-VaultRoot $keyDirectory $vaultIdentity.User

    $vaultPhase = 'snapshot-access'
    if (-not $SnapshotId) {
        $SnapshotId = [DateTime]::UtcNow.ToString('yyyyMMddTHHmmssZ') + '-' + [Guid]::NewGuid().ToString('N').Substring(0, 12)
        $snapshotDirectory = Join-Path $archiveDirectory $SnapshotId
        Set-PrivateDirectory $snapshotDirectory $vaultIdentity.User
        $entropy = New-Object byte[] 48
        $generator = [Security.Cryptography.RandomNumberGenerator]::Create()
        try { $generator.GetBytes($entropy) } finally { $generator.Dispose() }
        $securePassphrase = ConvertTo-SecureString ([Convert]::ToBase64String($entropy)) -AsPlainText -Force
        [Array]::Clear($entropy, 0, $entropy.Length)
        try { Write-NewTextFile (Join-Path $keyDirectory ($SnapshotId + '.dpapi')) (ConvertFrom-SecureString $securePassphrase) }
        finally { $securePassphrase.Dispose() }
        Write-NewTextFile (Join-Path $snapshotDirectory 'snapshot.json') (@{
            version = 1; createdAt = [DateTime]::UtcNow.ToString('o'); snapshotId = $SnapshotId;
            keyProtection = 'WindowsCurrentUserDPAPI'; sourceWritesPaused = $false; cutoverReady = $false;
            note = 'Read-only live scan, not an atomic snapshot. Recovery key requires this Windows user profile.'
        } | ConvertTo-Json)
    } else {
        $snapshotDirectory = Assert-VaultPath (Join-Path $archiveDirectory $SnapshotId)
        if (-not (Test-Path -LiteralPath (Join-Path $snapshotDirectory 'snapshot.json') -PathType Leaf)) { throw 'Snapshot not found.' }
        Set-PrivateDirectory $snapshotDirectory $vaultIdentity.User
    }
    $vaultPhase = 'key-access'
    $keyFile = Assert-VaultPath (Join-Path $keyDirectory ($SnapshotId + '.dpapi'))
    if (-not (Test-Path -LiteralPath $keyFile -PathType Leaf)) { throw 'Snapshot key not found.' }
    if ($Action -eq 'Prepare') {
        @{ ok = $true; action = 'Prepare'; snapshotId = $SnapshotId; archiveDirectory = $snapshotDirectory;
            access = 'Current Windows account only'; keyProtection = 'WindowsCurrentUserDPAPI'; exported = $false } | ConvertTo-Json -Compress
        exit 0
    }

    $requiredScripts = @{
        Firestore = 'firestore-safe-backup.mjs'; Auth = 'firebase-auth-safe-backup.mjs'; R2 = 'r2-safe-backup.mjs'
    }
    $archiveNames = @{ Firestore = 'firestore.enc'; Auth = 'firebase-auth.enc'; R2 = 'r2.enc' }
    $vaultPhase = 'source-configuration'
    $configuredFirebase = Get-Content -LiteralPath (Join-Path $backupRepository 'firebase-applet-config.json') -Raw | ConvertFrom-Json
    $configuredDatabase = Get-Content -LiteralPath (Join-Path $backupRepository 'firebase.json') -Raw | ConvertFrom-Json
    $backupEnvironment = @{
        FIREBASE_PROJECT_ID = $configuredFirebase.projectId; FIRESTORE_DATABASE_ID = $configuredDatabase.firestore.database;
        ALLOW_FIRESTORE_EXPORT_READS = 'I_UNDERSTAND'; ALLOW_FIREBASE_AUTH_EXPORT_READS = 'I_UNDERSTAND'; ALLOW_R2_EXPORT_READS = 'I_UNDERSTAND';
        CLOUDFLARE_ACCOUNT_ID = '711ed9021355751ec61335d3096f5a99';
        R2_BACKUP_BUCKETS = 'chantakorn-property-media-prod,chantakorn-inquiry-private-prod';
        MAX_BACKUP_RECORDS = '1000'; MAX_BACKUP_DOCUMENT_LOCATIONS = '2000'; MAX_BACKUP_DISCOVERY_REQUESTS = '5000'; MAX_BACKUP_COLLECTIONS = '1000';
        MAX_AUTH_BACKUP_USERS = '1000'; MAX_R2_BACKUP_OBJECTS = '1000'; MAX_R2_BACKUP_BYTES = '268435456'; MAX_R2_BACKUP_OBJECT_BYTES = '67108864';
        WRANGLER_WRITE_LOGS = 'false'; WRANGLER_SEND_METRICS = 'false'
    }
    $savedBackupEnvironment = @{}
    foreach ($name in $backupEnvironment.Keys) {
        $savedBackupEnvironment[$name] = [Environment]::GetEnvironmentVariable($name, 'Process')
        [Environment]::SetEnvironmentVariable($name, $backupEnvironment[$name], 'Process')
    }
    $previousPassphrase = [Environment]::GetEnvironmentVariable('CHANTAKORN_BACKUP_PASSPHRASE', 'Process')
    $loadedSecret = $null
    try {
        $vaultPhase = 'key-unlock'
        $loadedSecret = ConvertTo-SecureString ([IO.File]::ReadAllText($keyFile))
        $secretPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($loadedSecret)
        try { $env:CHANTAKORN_BACKUP_PASSPHRASE = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($secretPointer) }
        finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($secretPointer) }
        foreach ($source in $Sources) {
            $vaultPhase = 'source-' + $source.ToLowerInvariant()
            $backupScript = Join-Path $PSScriptRoot $requiredScripts[$source]
            if (-not (Test-Path -LiteralPath $backupScript -PathType Leaf)) { throw 'Required backup script is not available.' }
            $archiveFile = Join-Path $snapshotDirectory $archiveNames[$source]
            if ($Action -eq 'Backup') {
                & node $backupScript backup $archiveFile
                if ($LASTEXITCODE -ne 0) { throw 'Backup source failed; no completed snapshot is claimed.' }
            }
            & node $backupScript verify $archiveFile
            if ($LASTEXITCODE -ne 0) { throw 'Backup verification failed.' }
        }
        if ($Action -eq 'Reconcile') {
            $vaultPhase = 'offline-reconciliation'
            & node (Join-Path $PSScriptRoot 'backup-reconciliation.mjs') $snapshotDirectory
            if ($LASTEXITCODE -ne 0) { throw 'Offline reconciliation failed.' }
        }
        @{ ok = $true; action = $Action; snapshotId = $SnapshotId; sources = $Sources;
            sourceWritesPaused = $false; cutoverReady = $false } | ConvertTo-Json -Compress
    } finally {
        [Environment]::SetEnvironmentVariable('CHANTAKORN_BACKUP_PASSPHRASE', $previousPassphrase, 'Process')
        foreach ($name in $savedBackupEnvironment.Keys) { [Environment]::SetEnvironmentVariable($name, $savedBackupEnvironment[$name], 'Process') }
        if ($null -ne $loadedSecret) { $loadedSecret.Dispose() }
    }
} catch {
    # Do not print provider errors, filesystem contents or secrets.
    Write-Error ('Admin backup vault failed at ' + $vaultPhase + ' (' + $_.Exception.GetType().Name + '). Check local access and source tools.') -ErrorAction Continue
    exit 1
}
