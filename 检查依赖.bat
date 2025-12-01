@echo off
chcp 65001 >nul
echo ========================================
echo 检查项目依赖
echo ========================================
echo.

echo [1/4] 检查前端网站后端依赖...
cd shenyunmuye-backend
if not exist node_modules (
    echo 缺少依赖，正在安装...
    call npm install
    if %errorlevel% neq 0 (
        echo 错误: 依赖安装失败
        cd ..
        pause
        exit /b 1
    )
) else (
    echo ✓ 依赖已安装
)
cd ..

echo [2/4] 检查管理后台后端依赖...
cd shenyunmuye-admin-backend
if not exist node_modules (
    echo 缺少依赖，正在安装...
    call npm install
    if %errorlevel% neq 0 (
        echo 错误: 依赖安装失败
        cd ..
        pause
        exit /b 1
    )
) else (
    echo ✓ 依赖已安装
)
cd ..

echo [3/4] 检查Node.js版本...
node --version
if %errorlevel% neq 0 (
    echo 错误: 未找到 Node.js
    pause
    exit /b 1
)

echo [4/4] 检查Python版本...
python --version
if %errorlevel% neq 0 (
    echo 错误: 未找到 Python
    pause
    exit /b 1
)

echo.
echo ========================================
echo 依赖检查完成！
echo ========================================
pause

