@echo off
rem Start Issue Meter on the LAN alongside the TC review service on port 9999.
call "%~dp0run.cmd" --bind 172.20.13.185 --port 9998 --base-path /issue-meter/ %*
exit /b %ERRORLEVEL%
