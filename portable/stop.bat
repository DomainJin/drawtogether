@echo off
setlocal
cd /d "%~dp0"
echo Tat server + client...
taskkill /fi "WINDOWTITLE eq whiteboard-server*" /t /f > nul 2>&1
taskkill /fi "WINDOWTITLE eq whiteboard-client*" /t /f > nul 2>&1
echo Tat PostgreSQL...
"%~dp0pgsql\bin\pg_ctl.exe" -D "%~dp0data\pg" -m fast -w stop > nul 2>&1
echo Xong.
