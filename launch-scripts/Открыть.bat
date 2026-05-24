@echo off
chcp 65001 >nul
title СплитЧек

echo Запускаем СплитЧек...

set PORT=8765
set DIR=%~dp0

:: Проверяем Python
python --version >nul 2>&1
if %errorlevel% == 0 (
    echo Открываем браузер...
    start "" "http://localhost:%PORT%"
    timeout /t 1 /nobreak >nul
    cd /d "%DIR%"
    python -m http.server %PORT%
    goto end
)

:: Пробуем python3
python3 --version >nul 2>&1
if %errorlevel% == 0 (
    echo Открываем браузер...
    start "" "http://localhost:%PORT%"
    timeout /t 1 /nobreak >nul
    cd /d "%DIR%"
    python3 -m http.server %PORT%
    goto end
)

:: Python не найден
echo.
echo Ошибка: Python не установлен.
echo Скачай Python с сайта https://python.org
echo При установке отметь галку "Add Python to PATH"
echo.
pause

:end
