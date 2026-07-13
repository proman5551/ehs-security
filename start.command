#!/bin/bash
# macOS: Finder에서 이 파일을 더블클릭하면 서버가 자동으로 켜지고 브라우저가 열립니다.
cd "$(dirname "$0")/server" || exit 1

if [ ! -d node_modules ]; then
  echo "최초 실행 — 패키지를 설치합니다 (인터넷 필요, 1회만)..."
  npm install
fi

( sleep 2; open "http://localhost:3000" ) &
node index.js
