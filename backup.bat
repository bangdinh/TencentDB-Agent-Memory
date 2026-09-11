@echo off
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0custom\scripts\backup.ps1" %*
