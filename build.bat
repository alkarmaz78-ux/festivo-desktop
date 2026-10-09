@echo off
chcp 65001 >nul
title FESTIVO — сборка Windows-приложения
echo ===========================================
echo   FESTIVO: установка зависимостей и сборка
echo ===========================================
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo ОШИБКА: не найден Node.js.
  echo Установи LTS-версию с https://nodejs.org/ и запусти build.bat снова.
  pause
  exit /b 1
)
call npm install
if errorlevel 1 (
  echo.
  echo Не удалось установить зависимости. Проверь интернет и повтори.
  pause
  exit /b 1
)
call npm run dist
if errorlevel 1 (
  echo.
  echo Сборка завершилась с ошибкой.
  pause
  exit /b 1
)
echo.
echo ГОТОВО! Установщик ищи в папке release.
pause
