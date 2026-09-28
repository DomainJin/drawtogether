# Đóng gói whiteboard thành một thư mục tự chạy trên laptop Windows x64 khác:
# node.exe + PostgreSQL portable + server + client đã build + start/stop.bat.
# Máy đích không cần cài gì.
#
#   powershell -ExecutionPolicy Bypass -File portable\build-portable.ps1
#
# Build lại đè lên gói cũ vẫn GIỮ data\ (database) và logs\ nếu có.
param(
  [string]$OutDir = (Join-Path (Split-Path $PSScriptRoot -Parent) 'release\whiteboard-portable'),
  [string]$PgRoot = 'C:\Program Files\PostgreSQL\18',
  [string]$NodeExe = (Get-Command node).Source,
  # Secret bridge phải khớp app Waterfall Designer; mặc định lấy từ server\.env.
  [string]$BridgeSecret = ''
)
$ErrorActionPreference = 'Stop'
$Repo = Split-Path $PSScriptRoot -Parent

function Step($msg) { Write-Host "==> $msg" -ForegroundColor Cyan }
function Need($path, $what) { if (-not (Test-Path $path)) { throw "Không thấy $what`: $path" } }

Need "$PgRoot\bin\initdb.exe" 'PostgreSQL (tham số -PgRoot)'
Need $NodeExe 'node.exe'

if (-not $BridgeSecret) {
  $envFile = Join-Path $Repo 'server\.env'
  if (Test-Path $envFile) {
    $line = Get-Content $envFile | Where-Object { $_ -match '^WATERFALL_BRIDGE_SECRET=' } | Select-Object -First 1
    if ($line) { $BridgeSecret = $line.Substring('WATERFALL_BRIDGE_SECRET='.Length).Trim() }
  }
}
if (-not $BridgeSecret) { throw 'Thiếu WATERFALL_BRIDGE_SECRET (server\.env hoặc -BridgeSecret)' }

# ── 1. Build client ─────────────────────────────────────────────────────────
Step 'Build client'
# Không đặt VITE_SERVER_URL: client tự suy server từ địa chỉ trang đang mở
# (src/whiteboard/serverUrl.js), nên gói chạy được ở mọi IP.
Remove-Item Env:VITE_SERVER_URL -ErrorAction SilentlyContinue
Push-Location (Join-Path $Repo 'client')
try {
  if (Test-Path .env) { throw 'client\.env đang tồn tại — xoá đi để build không gắn cứng địa chỉ server' }
  npm run build
  if ($LASTEXITCODE) { throw 'npm run build (client) lỗi' }
} finally { Pop-Location }

# ── 2. Dọn thư mục đích, giữ data/logs ──────────────────────────────────────
Step "Chuẩn bị $OutDir"
if (Test-Path $OutDir) {
  if (-not (Test-Path "$OutDir\start.bat")) { throw "$OutDir đã có và không phải gói cũ — chọn -OutDir khác" }
  Get-ChildItem $OutDir | Where-Object { $_.Name -notin @('data', 'logs') } | Remove-Item -Recurse -Force
} else {
  New-Item -ItemType Directory -Force $OutDir | Out-Null
}

# ── 3. Runtime: node + PostgreSQL + VC++ ────────────────────────────────────
Step 'Chép node.exe'
New-Item -ItemType Directory -Force "$OutDir\node" | Out-Null
Copy-Item $NodeExe "$OutDir\node\node.exe"

Step 'Chép PostgreSQL (bin, lib, share)'
foreach ($d in 'bin', 'lib', 'share') {
  Copy-Item "$PgRoot\$d" "$OutDir\pgsql\$d" -Recurse
}
# Bản cài EDB dựa vào VC++ runtime cài riêng; máy đích có thể chưa có.
# Đặt DLL cạnh exe (app-local) để không phải chạy vcredist.
foreach ($dll in 'vcruntime140.dll', 'vcruntime140_1.dll', 'msvcp140.dll') {
  $src = Join-Path $env:WINDIR "System32\$dll"
  Need $src "VC++ runtime $dll"
  Copy-Item $src "$OutDir\pgsql\bin\$dll" -Force
}

# ── 4. Server + dependencies production ─────────────────────────────────────
Step 'Chép server + npm ci --omit=dev'
$srv = "$OutDir\app\server"
New-Item -ItemType Directory -Force $srv | Out-Null
Copy-Item (Join-Path $Repo 'server\src') "$srv\src" -Recurse
Copy-Item (Join-Path $Repo 'server\package.json'), (Join-Path $Repo 'server\package-lock.json') $srv
Push-Location $srv
try {
  npm ci --omit=dev --no-audit --no-fund
  if ($LASTEXITCODE) { throw 'npm ci (server) lỗi' }
} finally { Pop-Location }

$jwt = [Convert]::ToBase64String((1..48 | ForEach-Object { Get-Random -Maximum 256 }) -as [byte[]])
# PORT/DATABASE_URL do start.bat đặt theo config.bat — dotenv không ghi đè biến
# đã có, nên ở đây chỉ để những thứ không đổi theo máy.
@"
JWT_SECRET=$jwt
WATERFALL_BRIDGE_SECRET=$BridgeSecret
DATABASE_SSL=false
"@ | Set-Content -Encoding ascii "$srv\.env"

# ── 5. Client + script ──────────────────────────────────────────────────────
Step 'Chép client + script'
Copy-Item (Join-Path $Repo 'client\dist') "$OutDir\app\client" -Recurse
Copy-Item "$PSScriptRoot\static-server.mjs" "$OutDir\app\static-server.mjs"
Copy-Item "$PSScriptRoot\db-setup.sql" "$OutDir\db-setup.sql"
Copy-Item "$PSScriptRoot\HUONG-DAN.txt" "$OutDir\HUONG-DAN.txt"
# cmd.exe đọc .bat theo dòng CRLF; file LF có thể chạy sai nhãn goto.
foreach ($bat in 'start.bat', 'stop.bat', 'config.bat', 'setup-firewall.bat') {
  $text = (Get-Content -Raw "$PSScriptRoot\$bat") -replace "`r?`n", "`r`n"
  [IO.File]::WriteAllText("$OutDir\$bat", $text, [Text.Encoding]::ASCII)
}

$size = (Get-ChildItem $OutDir -Recurse -File | Measure-Object Length -Sum).Sum / 1MB
Step ("Xong: {0}  ({1:N0} MB)" -f $OutDir, $size)
