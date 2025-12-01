@echo off
chcp 65001 >nul
echo ========================================
echo 安装项目依赖
echo ========================================
echo.

echo [1/2] 安装前端网站后端依赖...
cd shenyunmuye-backend
if not exist node_modules (
    call npm install
    if %errorlevel% neq 0 (
        echo 错误: 依赖安装失败
        cd ..
        pause
        exit /b 1
    )
    echo ✓ 安装完成
) else (
    echo ✓ 依赖已存在
)
cd ..

echo.
echo [2/2] 安装管理后台后端依赖...
cd shenyunmuye-admin-backend
if not exist node_modules (
    call npm install
    if %errorlevel% neq 0 (
        echo 错误: 依赖安装失败
        cd ..
        pause
        exit /b 1
    )
    echo ✓ 安装完成
) else (
    echo ✓ 依赖已存在
)
cd ..

echo.
echo ========================================
echo 所有依赖安装完成！
echo ========================================
pause

