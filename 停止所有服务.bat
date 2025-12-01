@echo off
chcp 65001 >nul
echo ========================================
echo 申允木业项目 - 停止所有服务 (Windows)
echo ========================================
echo.

echo 正在停止所有服务...
echo.

:: 停止Node.js进程
taskkill /FI "WINDOWTITLE eq 前端网站后端*" /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq 管理后台后端*" /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq 前端网站*" /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq 管理后台前端*" /F >nul 2>&1

:: 停止Node.js进程（通过进程名）
taskkill /IM node.exe /F >nul 2>&1

:: 停止Python HTTP服务器
for /f "tokens=2" %%a in ('netstat -ano ^| findstr ":8080" ^| findstr "LISTENING"') do (
    taskkill /PID %%a /F >nul 2>&1
)
for /f "tokens=2" %%a in ('netstat -ano ^| findstr ":8081" ^| findstr "LISTENING"') do (
    taskkill /PID %%a /F >nul 2>&1
)

timeout /t 2 /nobreak >nul

echo ========================================
echo 所有服务已停止
echo ========================================
echo.
pause

