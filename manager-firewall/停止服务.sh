#!/bin/bash
# 停止防火墙管理系统服务

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

echo "=========================================="
echo "停止防火墙管理系统"
echo "=========================================="

# 停止后端服务
if [ -f "pids/backend.pid" ]; then
    PID=$(cat pids/backend.pid)
    if kill -0 $PID 2>/dev/null; then
        kill $PID
        echo "✓ 后端服务已停止 (PID: $PID)"
        rm -f pids/backend.pid
    else
        echo "后端服务未运行"
        rm -f pids/backend.pid
    fi
else
    echo "未找到 PID 文件，尝试通过端口查找..."
    PID=$(lsof -ti tcp:3002 2>/dev/null | head -1)
    if [ -n "$PID" ]; then
        kill $PID
        echo "✓ 后端服务已停止 (PID: $PID)"
    else
        echo "未找到运行中的后端服务"
    fi
fi

echo ""
echo "=========================================="
echo "服务已停止"
echo "=========================================="

