@echo off
chcp 65001 >nul
title СплитЧек

set "DIR=%~dp0"
set "FILE=%DIR%СплитЧек.html"
set "PORT=8765"

:: Проверяем наличие файла
if not exist "%FILE%" (
    echo Файл СплитЧек.html не найден рядом со скриптом.
    pause
    exit /b
)

echo ╔══════════════════════════════╗
echo ║        💰 СплитЧек          ║
echo ╚══════════════════════════════╝
echo.

:: Пробуем Python 3
python --version >nul 2>&1
if %errorlevel% == 0 (
    echo Запускаю сервер...
    start "" "http://localhost:%PORT%/СплитЧек.html"
    timeout /t 1 /nobreak >nul
    cd /d "%DIR%"
    python -m http.server %PORT% --bind 127.0.0.1
    goto :end
)

python3 --version >nul 2>&1
if %errorlevel% == 0 (
    echo Запускаю сервер...
    start "" "http://localhost:%PORT%/СплитЧек.html"
    timeout /t 1 /nobreak >nul
    cd /d "%DIR%"
    python3 -m http.server %PORT% --bind 127.0.0.1
    goto :end
)

:: Python не найден — открываем напрямую (ограниченный режим)
echo Python не найден. Открываю в ограниченном режиме...
echo (Сканирование чеков будет недоступно)
echo.
start "" "%FILE%"

:end
