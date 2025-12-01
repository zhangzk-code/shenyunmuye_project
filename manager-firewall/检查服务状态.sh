#!/bin/bash
# 检查防火墙管理系统服务状态

echo "=========================================="
echo "检查防火墙管理系统服务状态"
echo "=========================================="
echo

# 1. 检查后端服务（端口 3002）
echo "[1] 检查后端服务 (端口 3002)..."
if lsof -Pi :3002 -sTCP:LISTEN -t >/dev/null 2>&1; then
    PID=$(lsof -Pi :3002 -sTCP:LISTEN -t | head -1)
    CMD=$(ps -p $PID -o cmd= 2>/dev/null)
    echo "  ✓ 后端服务正在运行"
    echo "    PID: $PID"
    echo "    进程: $CMD"
    
    # 测试后端 API
    echo "  测试后端 API..."
    if curl -s http://localhost:3002/api/health >/dev/null 2>&1; then
        echo "    ✓ 后端 API 响应正常"
    else
        echo "    ✗ 后端 API 无响应"
    fi
else
    echo "  ✗ 后端服务未运行"
    echo "    请启动: cd manager-firewall/backend && npm start"
fi
echo

# 2. 检查 Nginx 配置
echo "[2] 检查 Nginx 配置..."
NGINX_CONFIG="/etc/nginx/conf.d/manager-firewall.conf"
if [ -f "$NGINX_CONFIG" ]; then
    echo "  ✓ 配置文件存在: $NGINX_CONFIG"
    
    # 检查是否包含 API 代理配置
    if grep -q "location /api" "$NGINX_CONFIG"; then
        echo "    ✓ API 代理配置存在"
    else
        echo "    ✗ API 代理配置不存在"
    fi
    
    # 检查代理目标
    PROXY_PASS=$(grep "proxy_pass" "$NGINX_CONFIG" | grep -o "http://[^;]*" | head -1)
    if [ -n "$PROXY_PASS" ]; then
        echo "    代理目标: $PROXY_PASS"
    fi
else
    echo "  ✗ 配置文件不存在"
    echo "    请运行: sudo ./manager-firewall/配置nginx.sh"
fi
echo

# 3. 检查 Nginx 服务
echo "[3] 检查 Nginx 服务..."
if systemctl is-active --quiet nginx 2>/dev/null; then
    echo "  ✓ Nginx 服务正在运行"
    
    # 检查端口 8082
    if lsof -Pi :8082 -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo "    ✓ 端口 8082 正在监听"
    else
        echo "    ✗ 端口 8082 未监听"
    fi
else
    echo "  ✗ Nginx 服务未运行"
    echo "    请启动: sudo systemctl start nginx"
fi
echo

# 4. 测试前端访问
echo "[4] 测试前端访问..."
if curl -s http://localhost:8082 >/dev/null 2>&1; then
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8082)
    if [ "$HTTP_CODE" = "200" ]; then
        echo "  ✓ 前端访问正常 (HTTP $HTTP_CODE)"
    else
        echo "  ✗ 前端访问异常 (HTTP $HTTP_CODE)"
    fi
else
    echo "  ✗ 前端无法访问"
fi
echo

# 5. 测试 API 代理
echo "[5] 测试 API 代理..."
if curl -s http://localhost:8082/api/health >/dev/null 2>&1; then
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8082/api/health)
    if [ "$HTTP_CODE" = "200" ]; then
        echo "  ✓ API 代理正常 (HTTP $HTTP_CODE)"
        RESPONSE=$(curl -s http://localhost:8082/api/health)
        echo "    响应: $RESPONSE"
    else
        echo "  ✗ API 代理异常 (HTTP $HTTP_CODE)"
    fi
else
    echo "  ✗ API 代理无法访问"
fi
echo

echo "=========================================="
echo "检查完成"
echo "=========================================="

