#!/bin/bash

# 申允木业项目 - 停止所有服务 (Linux版本)

echo "========================================"
echo "申允木业项目 - 停止所有服务"
echo "========================================"
echo

# 获取脚本所在目录
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PID_DIR="$SCRIPT_DIR/pids"

# 目标端口列表
PORTS=(3000 3001 3002 8080 8081 8082)

if [ ! -d "$PID_DIR" ]; then
    echo "PID目录不存在，可能没有运行的服务"
fi

# 停止服务的函数
stop_service() {
    local name=$1
    local pid_file="$PID_DIR/${name}.pid"
    
    # 对于 Nginx 前端服务，使用 systemd 停止
    if [ "$name" = "website-frontend" ] || [ "$name" = "admin-frontend" ] || [ "$name" = "firewall-frontend" ]; then
        # Nginx 是系统服务，通过 systemd 管理
        if systemctl is-active --quiet nginx 2>/dev/null; then
            echo "停止 Nginx 服务..."
            systemctl stop nginx 2>/dev/null || sudo systemctl stop nginx 2>/dev/null
            echo "✓ Nginx 已停止"
        else
            echo "Nginx 服务未运行"
        fi
        # 清理 PID 文件
        rm -f "$pid_file"
        return 0
    fi
    
    # 对于其他服务，使用 PID 文件
    if [ ! -f "$pid_file" ]; then
        echo "服务 $name 未运行"
        return 0
    fi
    
    local pid=$(cat "$pid_file")
    
    if kill -0 "$pid" 2>/dev/null; then
        echo "正在停止 $name (PID: $pid)..."
        kill "$pid" 2>/dev/null
        sleep 2
        
        # 如果还在运行，强制杀死
        if kill -0 "$pid" 2>/dev/null; then
            kill -9 "$pid" 2>/dev/null
            echo "✓ $name 已强制停止"
        else
            echo "✓ $name 已停止"
        fi
        rm -f "$pid_file"
    else
        echo "服务 $name 未运行 (PID文件存在但进程不存在)"
        rm -f "$pid_file"
    fi
}

# 停止所有服务
stop_service "website-backend"
stop_service "admin-backend"
stop_service "firewall-backend"
stop_service "website-frontend"
stop_service "admin-frontend"
stop_service "firewall-frontend"

# 根据端口强制清理残留进程（同时兼容 IPv4 / IPv6）
kill_by_port() {
    local port=$1
    echo "检查端口 $port ..."

    # lsof 支持 IPv4 与 IPv6
    local pids=$(lsof -ti tcp:$port 2>/dev/null)

    # 如果 lsof 不可用或没有结果，使用 netstat 作为后备
    if [ -z "$pids" ]; then
        pids=$(netstat -tunlp 2>/dev/null | awk -v p=":$port" '$4 ~ p {split($7,a,"/"); if(a[1]!="-" && a[1]!="") print a[1]}' | sort -u)
    fi

    if [ -z "$pids" ]; then
        echo "端口 $port 上没有检测到运行中的进程"
        return
    fi

    for pid in $pids; do
        if kill -0 "$pid" 2>/dev/null; then
            echo " - 停止 PID $pid (端口 $port)"
            kill "$pid" 2>/dev/null
            sleep 1
            if kill -0 "$pid" 2>/dev/null; then
                kill -9 "$pid" 2>/dev/null
                echo "   PID $pid 已强制停止"
            fi
        fi
    done
}

# 清理可能残留的进程
echo
echo "清理残留进程..."
pkill -f "node.*shenyunmuye-backend/server.js" 2>/dev/null
pkill -f "node.*shenyunmuye-admin-backend/server.js" 2>/dev/null
pkill -f "node.*manager-firewall/backend/server.js" 2>/dev/null
pkill -f "python3.*http.server.*8080" 2>/dev/null
pkill -f "python3.*http.server.*8081" 2>/dev/null
pkill -f "http-server.*8080" 2>/dev/null
pkill -f "http-server.*8081" 2>/dev/null

# 注意: Nginx 是系统服务，不会在这里停止
# 如需停止 Nginx，请使用: sudo systemctl stop nginx

# 通过端口再检查一次
for port in "${PORTS[@]}"; do
    kill_by_port "$port"
done

echo
echo "========================================"
echo "所有服务已停止"
echo "========================================"

