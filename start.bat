@echo off
REM Windows: 이 파일을 더블클릭하면 서버가 자동으로 켜지고 브라우저가 열립니다.
cd /d "%~dp0server"

if not exist node_modules (
  echo 최초 실행 — 패키지를 설치합니다 (인터넷 필요, 1회만)...
  call npm install
)

start "" cmd /c "timeout /t 2 >nul && start http://localhost:3000"
node index.js
pause
