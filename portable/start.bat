@echo off
setlocal EnableExtensions
cd /d "%~dp0"
set "ROOT=%~dp0"
call "%ROOT%config.bat"
set "NODE=%ROOT%node\node.exe"
set "PGBIN=%ROOT%pgsql\bin"
set "PGDATA=%ROOT%data\pg"
if not exist "%ROOT%logs" mkdir "%ROOT%logs"

echo === Whiteboard portable ===

rem --- 1. PostgreSQL ---------------------------------------------------------
if not exist "%PGDATA%\PG_VERSION" (
  echo [1/3] Khoi tao database lan dau...
  "%PGBIN%\initdb.exe" -D "%PGDATA%" -U postgres -A trust -E UTF8 --locale=C > "%ROOT%logs\initdb.log" 2>&1
  if errorlevel 1 ( echo LOI initdb - xem logs\initdb.log & goto :fail )
)
"%PGBIN%\pg_ctl.exe" -D "%PGDATA%" status > nul 2>&1
if errorlevel 1 (
  echo [1/3] Chay PostgreSQL port %PG_PORT%...
  "%PGBIN%\pg_ctl.exe" -D "%PGDATA%" -o "-p %PG_PORT% -c listen_addresses=localhost" -l "%ROOT%logs\postgres.log" -w -t 60 start > nul
  if errorlevel 1 ( echo LOI PostgreSQL - xem logs\postgres.log & goto :fail )
) else (
  echo [1/3] PostgreSQL dang chay san.
)
rem Tao user + database neu chua co (chay moi lan, khong hai gi).
"%PGBIN%\psql.exe" -h localhost -p %PG_PORT% -U postgres -v ON_ERROR_STOP=1 -q -f "%ROOT%db-setup.sql" > "%ROOT%logs\db-setup.log" 2>&1
if errorlevel 1 ( echo LOI tao user DB - xem logs\db-setup.log & goto :fail )
"%PGBIN%\psql.exe" -h localhost -p %PG_PORT% -U postgres -tAc "SELECT 1 FROM pg_database WHERE datname='whiteboard'" | findstr 1 > nul
if errorlevel 1 (
  "%PGBIN%\createdb.exe" -h localhost -p %PG_PORT% -U postgres -O whiteboard whiteboard >> "%ROOT%logs\db-setup.log" 2>&1
  if errorlevel 1 ( echo LOI tao database - xem logs\db-setup.log & goto :fail )
)

rem --- 2. Server ------------------------------------------------------------
echo [2/3] Chay server port %WB_SERVER_PORT%...
set "PORT=%WB_SERVER_PORT%"
set "DATABASE_URL=postgresql://whiteboard:whiteboard@localhost:%PG_PORT%/whiteboard"
start "whiteboard-server" /D "%ROOT%app\server" "%NODE%" src/index.js

rem --- 3. Client ------------------------------------------------------------
echo [3/3] Chay client port %WB_CLIENT_PORT%...
start "whiteboard-client" /D "%ROOT%app" "%NODE%" static-server.mjs

echo.
echo Da chay. Mo tren iPad / trinh duyet (tat Wi-Fi, cam day LAN):
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do (
  for /f "tokens=* delims= " %%b in ("%%a") do echo    http://%%b:%WB_CLIENT_PORT%
)
echo Tren chinh may nay: http://localhost:%WB_CLIENT_PORT%
echo Kiem tra server:    http://localhost:%WB_SERVER_PORT%/health
echo.
echo Tat: chay stop.bat
exit /b 0

:fail
echo.
echo Khoi dong THAT BAI.
pause
exit /b 1
