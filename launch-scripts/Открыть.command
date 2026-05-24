#!/bin/bash

# СплитЧек — локальный запуск
# Двойной клик чтобы открыть приложение в браузере

DIR="$(cd "$(dirname "$0")" && pwd)"

# Проверяем наличие Python (есть на каждом Mac)
if command -v python3 &>/dev/null; then
    echo "Запускаем СплитЧек..."
    
    # Находим свободный порт начиная с 8765
    PORT=8765
    while lsof -i:$PORT &>/dev/null 2>&1; do
        PORT=$((PORT + 1))
    done
    
    # Открываем браузер через 1 секунду
    (sleep 1 && open "http://localhost:$PORT") &
    
    echo "Открой браузер: http://localhost:$PORT"
    echo "Для остановки нажми Ctrl+C"
    
    # Запускаем сервер
    cd "$DIR"
    python3 -m http.server $PORT
else
    echo "Ошибка: Python3 не найден."
    echo "Установи Python с https://python.org"
    read -p "Нажми Enter..."
fi
