# Turns on the one-tap demo login for local Expo Go demos.
#
# Reads .env.demo (gitignored; keys DEMO_KERKUES_EMAIL, DEMO_KERKUES_PASSWORD, DEMO_PUNEDHENES_*, DEMO_QENDER_*)
# and writes their EXPO_PUBLIC_DEMO_* copies plus EXPO_PUBLIC_QUICK_LOGIN=true into .env.local (gitignored),
# keeping every other line of .env.local. It never prints a value, only key names.
#
# EXPO_PUBLIC_* values go into the app bundle: use this only for demo accounts on a dev server
# (npx expo start). Do not run `eas update` or `npx expo export` while .env.local has these lines.
# To turn it off: .\scripts\demo-env.ps1 -Off   (removes the lines again)
#
# Run from the repo or a worktree:  powershell -ExecutionPolicy Bypass -File .\scripts\demo-env.ps1

param([switch]$Off)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$utf8 = New-Object System.Text.UTF8Encoding($false)

# The main checkout (worktrees keep .env and .env.demo only there).
$main = $null
try {
    $common = (& git -C $root rev-parse --path-format=absolute --git-common-dir 2>$null)
    if ($LASTEXITCODE -eq 0 -and $common) { $main = Split-Path -Parent $common.Trim() }
} catch { }

function Find-EnvFile([string]$name) {
    $here = Join-Path $root $name
    if (Test-Path -LiteralPath $here) { return $here }
    if ($main) {
        $there = Join-Path $main $name
        if (Test-Path -LiteralPath $there) { return $there }
    }
    return $null
}

$roles = @('KERKUES', 'PUNEDHENES', 'QENDER')
$managed = @('EXPO_PUBLIC_QUICK_LOGIN')
foreach ($r in $roles) { $managed += "EXPO_PUBLIC_DEMO_${r}_EMAIL"; $managed += "EXPO_PUBLIC_DEMO_${r}_PASSWORD" }

function Get-Key([string]$line) {
    if ($line -match '^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=') { return $Matches[1] }
    return $null
}

# Value as written in .env.demo: trimmed, one pair of matching outer quotes removed.
function Get-Value([string]$line) {
    $v = ($line -replace '^\s*(?:export\s+)?[A-Za-z_][A-Za-z0-9_]*\s*=', '').Trim()
    if ($v.Length -ge 2) {
        $q = $v[0]
        if (($q -eq '"' -or $q -eq "'" -or $q -eq '`') -and $v[$v.Length - 1] -eq $q) {
            return $v.Substring(1, $v.Length - 2)
        }
    }
    # Unquoted: drop an inline comment (" #...").
    return ($v -replace '\s+#.*$', '')
}

# Quoted so Expo reads it back literally: '$' escaped (Expo expands $VARS), quote char picked to fit the value.
function Format-Value([string]$v) {
    $v = $v.Replace('$', '\$')
    foreach ($q in @("'", '`', '"')) {
        if (-not $v.Contains($q)) { return "$q$v$q" }
    }
    throw 'A value in .env.demo contains all three quote characters; change that password.'
}

# Read the current .env.local, dropping the lines this script manages.
$localPath = Join-Path $root '.env.local'
$kept = New-Object System.Collections.Generic.List[string]
if (Test-Path -LiteralPath $localPath) {
    foreach ($line in [System.IO.File]::ReadAllLines($localPath)) {
        $k = Get-Key $line
        if ($k -and ($managed -contains $k)) { continue }
        if ($line -eq '# Demo login (scripts/demo-env.ps1). Do not commit or build with these.') { continue }
        $kept.Add($line)
    }
}
while ($kept.Count -gt 0 -and $kept[$kept.Count - 1].Trim() -eq '') { $kept.RemoveAt($kept.Count - 1) }

if ($Off) {
    [System.IO.File]::WriteAllLines($localPath, $kept.ToArray(), $utf8)
    Write-Host 'Demo login removed from .env.local. Restart Expo with: npx expo start --clear'
    exit 0
}

$demoPath = Find-EnvFile '.env.demo'
if (-not $demoPath) { throw ".env.demo not found in $root or the main checkout." }

$demo = @{}
foreach ($line in [System.IO.File]::ReadAllLines($demoPath)) {
    $k = Get-Key $line
    if ($k) { $demo[$k] = Get-Value $line }
}

$out = New-Object System.Collections.Generic.List[string]
$enabled = @(); $missing = @()
foreach ($r in $roles) {
    $e = $demo["DEMO_${r}_EMAIL"]; $p = $demo["DEMO_${r}_PASSWORD"]
    if ($e -and $p) {
        $out.Add("EXPO_PUBLIC_DEMO_${r}_EMAIL=$(Format-Value $e.Trim())")
        $out.Add("EXPO_PUBLIC_DEMO_${r}_PASSWORD=$(Format-Value $p)")
        $enabled += $r
    } else {
        if (-not $e) { $missing += "DEMO_${r}_EMAIL" }
        if (-not $p) { $missing += "DEMO_${r}_PASSWORD" }
    }
}
if ($enabled.Count -eq 0) { throw "No complete role in .env.demo. Missing: $($missing -join ', ')" }

if ($kept.Count -gt 0) { $kept.Add('') }
$kept.Add('# Demo login (scripts/demo-env.ps1). Do not commit or build with these.')
$kept.Add('EXPO_PUBLIC_QUICK_LOGIN=true')
$kept.AddRange($out)
[System.IO.File]::WriteAllLines($localPath, $kept.ToArray(), $utf8)

# A worktree has no .env (Supabase URL + publishable key): copy the main checkout's, if there is one.
$envHere = Join-Path $root '.env'
if (-not (Test-Path -LiteralPath $envHere) -and $main) {
    $envMain = Join-Path $main '.env'
    if (Test-Path -LiteralPath $envMain) {
        Copy-Item -LiteralPath $envMain -Destination $envHere
        Write-Host 'Copied .env (Supabase URL + publishable key) from the main checkout.'
    }
}

Write-Host "Demo login on in .env.local for: $($enabled -join ', ')"
if ($missing.Count -gt 0) { Write-Host "Skipped, missing in .env.demo: $($missing -join ', ')" }
Write-Host 'Restart Expo with --clear so the new values are bundled.'
