@echo off
cd /d "%~dp0"
if not exist "storage" mkdir "storage"
node.exe server.js >> "storage\server.log" 2>&1
