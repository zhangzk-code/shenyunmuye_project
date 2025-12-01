#!/bin/bash
# 启动防火墙管理系统服务

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

echo "=========================================="
echo "启动防火墙管理系统"
echo "=========================================="

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo "错误: 未找到 Node.js，请先安装 Node.js"
    exit 1
fi

# 检查后端依赖
if [ ! -d "backend/node_modules" ]; then
    echo "正在安装后端依赖..."
    cd backend
    npm install
    cd ..
fi

# 启动后端服务
echo "启动后端服务 (端口 3002)..."
cd backend
nohup npm start > ../logs/backend.log 2>&1 &
BACKEND_PID=$!
echo $BACKEND_PID > ../pids/backend.pid
cd ..

sleep 2

# 检查后端是否启动成功
if kill -0 $BACKEND_PID 2>/dev/null; then
    echo "✓ 后端服务启动成功 (PID: $BACKEND_PID)"
else
    echo "✗ 后端服务启动失败，请查看日志: logs/backend.log"
    exit 1
fi

echo ""
echo "=========================================="
echo "服务启动完成"
echo "=========================================="
echo ""
echo "访问地址："
echo "  管理界面: http://localhost:8082"
echo "  后端 API: http://localhost:3002"
echo ""
echo "默认账户："
echo "  用户名: admin"
echo "  密码: admin123"
echo ""
echo "日志文件: logs/backend.log"
echo "PID文件: pids/backend.pid"
echo ""

