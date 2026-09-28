@echo off
rem Mo port cho iPad trong LAN. Can quyen Admin: chuot phai > Run as administrator.
call "%~dp0config.bat"
net session > nul 2>&1
if errorlevel 1 (
  echo Can chay bang quyen Administrator: chuot phai file nay ^> Run as administrator
  pause
  exit /b 1
)
netsh advfirewall firewall delete rule name="Whiteboard portable" > nul 2>&1
netsh advfirewall firewall add rule name="Whiteboard portable" dir=in action=allow protocol=TCP localport=%WB_SERVER_PORT%,%WB_CLIENT_PORT% profile=any
echo Da mo port %WB_SERVER_PORT% va %WB_CLIENT_PORT%.
pause
