#!/bin/bash

# 安装项目依赖 (Linux版本)

echo "========================================"
echo "安装项目依赖"
echo "========================================"
echo

# 检查Node.js
if ! command -v npm &> /dev/null; then
    echo "错误: 未找到 npm，请先安装 Node.js"
    exit 1
fi

echo "[1/2] 安装前端网站后端依赖..."
cd shenyunmuye-backend
if [ ! -d "node_modules" ]; then
    npm install
    if [ $? -ne 0 ]; then
        echo "错误: 依赖安装失败"
        cd ..
        exit 1
    fi
    echo "✓ 安装完成"
else
    echo "✓ 依赖已存在"
fi
cd ..

echo
echo "[2/2] 安装管理后台后端依赖..."
cd shenyunmuye-admin-backend
if [ ! -d "node_modules" ]; then
    npm install
    if [ $? -ne 0 ]; then
        echo "错误: 依赖安装失败"
        cd ..
        exit 1
    fi
    echo "✓ 安装完成"
else
    echo "✓ 依赖已存在"
fi
cd ..

echo
echo "========================================"
echo "所有依赖安装完成！"
echo "========================================"

