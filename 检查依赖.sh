#!/bin/bash

# 检查项目依赖 (Linux版本)

echo "========================================"
echo "检查项目依赖"
echo "========================================"
echo

# 检查Node.js
if ! command -v npm &> /dev/null; then
    echo "错误: 未找到 npm，请先安装 Node.js"
    exit 1
fi
echo "✓ Node.js: $(node --version)"
echo "✓ npm: $(npm --version)"

# 检查Python
if ! command -v python3 &> /dev/null; then
    echo "错误: 未找到 python3，请先安装 Python3"
    exit 1
fi
echo "✓ Python: $(python3 --version)"

echo
echo "[1/2] 检查前端网站后端依赖..."
cd shenyunmuye-backend
if [ ! -d "node_modules" ]; then
    echo "缺少依赖，正在安装..."
    npm install
    if [ $? -ne 0 ]; then
        echo "错误: 依赖安装失败"
        cd ..
        exit 1
    fi
else
    echo "✓ 依赖已安装"
fi
cd ..

echo
echo "[2/2] 检查管理后台后端依赖..."
cd shenyunmuye-admin-backend
if [ ! -d "node_modules" ]; then
    echo "缺少依赖，正在安装..."
    npm install
    if [ $? -ne 0 ]; then
        echo "错误: 依赖安装失败"
        cd ..
        exit 1
    fi
else
    echo "✓ 依赖已安装"
fi
cd ..

echo
echo "========================================"
echo "依赖检查完成！"
echo "========================================"

