#!/bin/bash
DIR="$(cd "$(dirname "$0")" && pwd)"
FILE="$DIR/СплитЧек.html"
PORT=8765

if [ ! -f "$FILE" ]; then
    osascript -e 'display alert "Файл СплитЧек.html не найден рядом со скриптом."'
    exit 1
fi

# Ищем свободный порт
while lsof -i:$PORT &>/dev/null 2>&1; do PORT=$((PORT+1)); done

echo "💰 СплитЧек запускается на порту $PORT..."
(sleep 1.2 && open "http://localhost:$PORT/СплитЧек.html") &

cd "$DIR"
python3 -m http.server $PORT --bind 127.0.0.1
