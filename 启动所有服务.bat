@echo off
chcp 65001 >nul
echo ========================================
echo 申允木业项目 - 启动所有服务 (Windows)
echo ========================================
echo.

set ENV=development
if "%1"=="prod" set ENV=production
if "%1"=="production" set ENV=production

echo 当前环境: %ENV%
echo.

:: 检查Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo 错误: 未找到 Node.js，请先安装 Node.js
    pause
    exit /b 1
)

:: 检查Python
where python >nul 2>&1
if %errorlevel% neq 0 (
    echo 错误: 未找到 Python，请先安装 Python
    pause
    exit /b 1
)

if "%ENV%"=="production" (
    call :start_production
) else (
    call :start_development
)

echo.
echo ========================================
echo 所有服务已启动！
echo ========================================
echo.

if "%ENV%"=="production" goto show_production_info
goto show_development_info

:show_production_info
echo 访问地址：
echo   前端网站: http://121.41.108.29:8080 (或通过反向代理 http://121.41.108.29)
echo   管理后台: http://121.41.108.29:8081/login.html
echo.
echo 默认管理账户：
echo   用户名: admin
echo   密码: admin123
echo.
echo 注意: 在生产环境中, 建议使用反向代理 (如Nginx) 将80端口映射到8080/8081端口
goto end_info

:show_development_info
echo 访问地址: 
echo   前端网站: http://localhost:8080
echo   管理后台: http://localhost:8081/login.html
echo.
echo 默认管理账户: 
echo   用户名: admin
echo   密码: admin123

:end_info
echo.
echo 服务运行在独立的窗口中，关闭窗口即可停止对应服务
echo 按任意键退出...
pause >nul
exit /b

:start_production
echo [1/4] 启动前端网站后端服务 (端口 3000)...
cd /d shenyunmuye-backend
if not exist node_modules (
    echo 正在安装依赖...
    call npm install
)
start "前端网站后端" cmd /k "cd /d %CD% && set NODE_ENV=production && set WEBSITE_BACKEND_PORT=3000 && set WEBSITE_BACKEND_HOST=121.41.108.29 && npm start"
cd /d ..
timeout /t 3 /nobreak >nul

echo [2/4] 启动管理后台后端服务 (端口 3001)...
cd /d shenyunmuye-admin-backend
if not exist node_modules (
    echo 正在安装依赖...
    call npm install
)
start "管理后台后端" cmd /k "cd /d %CD% && set NODE_ENV=production && set ADMIN_BACKEND_PORT=3001 && set ADMIN_BACKEND_HOST=121.41.108.29 && set ADMIN_FRONTEND_URL=http://121.41.108.29:8081 && set WEBSITE_BACKEND_HOST=121.41.108.29 && set WEBSITE_BACKEND_PORT=3000 && set PUBLIC_UPLOAD_BASE=http://121.41.108.29:3000 && npm start"
cd /d ..
timeout /t 3 /nobreak >nul

echo [3/4] 启动前端网站 (端口 8080)...
cd /d shenyunmuye-website
start "前端网站" cmd /k "cd /d %CD% && python -m http.server 8080"
cd /d ..
timeout /t 2 /nobreak >nul

echo [4/4] 启动管理后台前端 (端口 8081)...
cd /d shenyunmuye-admin-frontend
start "管理后台前端" cmd /k "cd /d %CD% && python -m http.server 8081"
cd /d ..
exit /b

:start_development
echo [1/4] 启动前端网站后端服务 (端口 3000)...
cd /d shenyunmuye-backend
if not exist node_modules (
    echo 正在安装依赖...
    call npm install
)
start "前端网站后端" cmd /k "cd /d %CD% && set NODE_ENV=development && set WEBSITE_BACKEND_PORT=3000 && set WEBSITE_BACKEND_HOST=localhost && npm start"
cd /d ..
timeout /t 3 /nobreak >nul

echo [2/4] 启动管理后台后端服务 (端口 3001)...
cd /d shenyunmuye-admin-backend
if not exist node_modules (
    echo 正在安装依赖...
    call npm install
)
start "管理后台后端" cmd /k "cd /d %CD% && set NODE_ENV=development && set ADMIN_BACKEND_PORT=3001 && set ADMIN_BACKEND_HOST=localhost && set ADMIN_FRONTEND_URL=http://localhost:8081 && npm start"
cd /d ..
timeout /t 3 /nobreak >nul

echo [3/4] 启动前端网站 (端口 8080)...
cd /d shenyunmuye-website
start "前端网站" cmd /k "cd /d %CD% && python -m http.server 8080"
cd /d ..
timeout /t 2 /nobreak >nul

echo [4/4] 启动管理后台前端 (端口 8081)...
cd /d shenyunmuye-admin-frontend
start "管理后台前端" cmd /k "cd /d %CD% && python -m http.server 8081"
cd /d ..
exit /b
