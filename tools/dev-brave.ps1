# Launches a throwaway Brave instance with CouchTube side-loaded, parked on the
# second monitor. Only ever touches processes started from this dev profile, so
# your everyday Brave window is safe.
param(
  [string]$Url = 'https://www.youtube.com/',
  # Load a different copy of the extension, which is how the Netflix fixtures
  # get driven: tools/pack-test-ext.mjs prints the folder to pass here.
  [string]$Ext,
  [switch]$Devtools,
  [switch]$KillOnly,
  [switch]$Fresh
)

$ext = if ($Ext) { $Ext } else { Split-Path -Parent $PSScriptRoot }
$profileDir = Join-Path $env:TEMP 'couchtube-dev-profile'
$brave = 'C:\Program Files\BraveSoftware\Brave-Browser\Application\brave.exe'

# Close any previous dev instance, matched on the profile path so nothing else dies.
$stale = Get-CimInstance Win32_Process -Filter "Name='brave.exe'" |
  Where-Object { $_.CommandLine -like "*$profileDir*" }
foreach ($p in $stale) { Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue }
if ($stale) { Start-Sleep -Milliseconds 1200 }
if ($KillOnly) { return }

if ($Fresh -and (Test-Path $profileDir)) {
  Remove-Item -Recurse -Force $profileDir -ErrorAction SilentlyContinue
}
New-Item -ItemType Directory -Force $profileDir | Out-Null

# Park it on the secondary display if there is one.
Add-Type -AssemblyName System.Windows.Forms
$screen = [System.Windows.Forms.Screen]::AllScreens | Where-Object { -not $_.Primary } | Select-Object -First 1
if (-not $screen) { $screen = [System.Windows.Forms.Screen]::PrimaryScreen }
$b = $screen.Bounds

$argList = @(
  "--user-data-dir=$profileDir"
  "--load-extension=$ext"
  "--disable-extensions-except=$ext"
  "--window-position=$($b.X),$($b.Y)"
  "--window-size=$($b.Width),$($b.Height - 40)"
  '--no-first-run'
  '--no-default-browser-check'
  '--remote-debugging-port=9222'
  '--remote-allow-origins=*'
  # We kill this instance between runs, so skip the "Brave didn't shut down
  # correctly" bubble that otherwise eats the first click every launch.
  '--disable-session-crashed-bubble'
  '--hide-crash-restore-bubble'
  '--disable-features=InfiniteSessionRestore'
)
if ($Devtools) { $argList += '--auto-open-devtools-for-tabs' }
$argList += $Url

Start-Process $brave -ArgumentList $argList
Write-Host "CouchTube dev Brave -> $Url  (profile: $profileDir)"
