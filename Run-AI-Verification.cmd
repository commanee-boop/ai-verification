@echo off
cd /d "%~dp0"
if not exist node_modules (
  echo Install dependencies first: npm.cmd install
  pause
  exit /b 1
)
node scripts\start-program.mjs
if errorlevel 1 pause
