#!/bin/bash
# Nginx 诊断脚本 - 整合所有诊断功能

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 检查root权限
if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}错误: 需要root权限${NC}"
    echo "请使用: sudo $0"
    exit 1
fi

NGINX_CONFIG="/etc/nginx/conf.d/shenyunmuye.conf"

echo "=========================================="
echo "Nginx 诊断工具"
echo "=========================================="
echo

# 【1】检查配置文件
echo -e "${BLUE}【1】检查配置文件${NC}"
if [ -f "$NGINX_CONFIG" ]; then
    echo -e "${GREEN}✓ 配置文件存在: $NGINX_CONFIG${NC}"
    echo
    echo "端口 8080 配置:"
    sed -n '/listen 8080/,/^}/p' "$NGINX_CONFIG" | head -20
    echo
    echo "端口 8081 配置:"
    sed -n '/listen 8081/,/^}/p' "$NGINX_CONFIG" | head -20
else
    echo -e "${RED}✗ 配置文件不存在: $NGINX_CONFIG${NC}"
    echo "请先运行: sudo ./配置nginx.sh"
    exit 1
fi

echo
echo -e "${BLUE}【2】检查文件路径和权限${NC}"

# 检查端口 8080
if grep -A 20 "listen 8080" "$NGINX_CONFIG" | grep -q "root"; then
    ROOT_8080=$(grep -A 20 "listen 8080" "$NGINX_CONFIG" | grep "root" | head -1 | awk '{print $2}' | sed 's/;//')
    echo "端口 8080 Root 路径: $ROOT_8080"
    
    if [ -d "$ROOT_8080" ]; then
        echo -e "${GREEN}  ✓ 目录存在${NC}"
        
        if [ -f "$ROOT_8080/index.html" ]; then
            echo -e "${GREEN}  ✓ index.html 存在${NC}"
            ls -lh "$ROOT_8080/index.html" | awk '{print "    大小:", $5, "权限:", $1}'
        else
            echo -e "${RED}  ✗ index.html 不存在${NC}"
        fi
        
        if [ -r "$ROOT_8080" ]; then
            echo -e "${GREEN}  ✓ 目录可读${NC}"
        else
            echo -e "${RED}  ✗ 目录不可读${NC}"
        fi
    else
        echo -e "${RED}  ✗ 目录不存在${NC}"
    fi
fi

echo

# 检查端口 8081
if grep -A 20 "listen 8081" "$NGINX_CONFIG" | grep -q "root"; then
    ROOT_8081=$(grep -A 20 "listen 8081" "$NGINX_CONFIG" | grep "root" | head -1 | awk '{print $2}' | sed 's/;//')
    echo "端口 8081 Root 路径: $ROOT_8081"
    
    if [ -d "$ROOT_8081" ]; then
        echo -e "${GREEN}  ✓ 目录存在${NC}"
        
        if [ -f "$ROOT_8081/login.html" ] || [ -f "$ROOT_8081/admin.html" ]; then
            echo -e "${GREEN}  ✓ HTML 文件存在${NC}"
        else
            echo -e "${RED}  ✗ HTML 文件不存在${NC}"
        fi
        
        if [ -r "$ROOT_8081" ]; then
            echo -e "${GREEN}  ✓ 目录可读${NC}"
        else
            echo -e "${RED}  ✗ 目录不可读${NC}"
        fi
    else
        echo -e "${RED}  ✗ 目录不存在${NC}"
    fi
fi

echo
echo -e "${BLUE}【3】检查 Nginx 进程和用户${NC}"
NGINX_USER=$(ps aux | grep "nginx: master" | grep -v grep | awk '{print $1}')
if [ -n "$NGINX_USER" ]; then
    echo "Nginx 运行用户: $NGINX_USER"
    echo "Nginx 进程:"
    ps aux | grep nginx | grep -v grep
else
    echo -e "${RED}✗ Nginx 未运行${NC}"
fi

echo
echo -e "${BLUE}【4】测试 Nginx 用户权限${NC}"
if [ -n "$NGINX_USER" ]; then
    if [ -f "/root/shenyunmuye-website/index.html" ]; then
        if sudo -u "$NGINX_USER" test -r /root/shenyunmuye-website/index.html 2>/dev/null; then
            echo -e "${GREEN}  ✓ Nginx 用户可以读取网站文件${NC}"
        else
            echo -e "${RED}  ✗ Nginx 用户无法读取网站文件${NC}"
            echo "    建议: 修改 Nginx 用户为 root"
        fi
    fi
fi

echo
echo -e "${BLUE}【5】检查端口监听${NC}"
if netstat -tulnp 2>/dev/null | grep -q ":8080"; then
    echo -e "${GREEN}  ✓ 端口 8080 正在监听${NC}"
    netstat -tulnp 2>/dev/null | grep ":8080"
else
    echo -e "${RED}  ✗ 端口 8080 未监听${NC}"
fi

echo

if netstat -tulnp 2>/dev/null | grep -q ":8081"; then
    echo -e "${GREEN}  ✓ 端口 8081 正在监听${NC}"
    netstat -tulnp 2>/dev/null | grep ":8081"
else
    echo -e "${RED}  ✗ 端口 8081 未监听${NC}"
fi

echo
echo -e "${BLUE}【6】检查 Nginx 配置语法${NC}"
if nginx -t 2>&1; then
    echo -e "${GREEN}  ✓ 配置语法正确${NC}"
else
    echo -e "${RED}  ✗ 配置语法错误${NC}"
fi

echo
echo -e "${BLUE}【7】检查 Nginx 错误日志${NC}"
if [ -f "/var/log/nginx/error.log" ]; then
    ERROR_COUNT=$(grep -i "error\|warn" /var/log/nginx/error.log 2>/dev/null | wc -l)
    if [ $ERROR_COUNT -gt 0 ]; then
        echo -e "${YELLOW}  ⚠ 发现 $ERROR_COUNT 个错误/警告${NC}"
        echo "  最近的错误:"
        tail -10 /var/log/nginx/error.log | grep -i "error\|warn" | tail -5
    else
        echo -e "${GREEN}  ✓ 无错误${NC}"
    fi
else
    echo -e "${YELLOW}  ⚠ 错误日志文件不存在${NC}"
fi

echo
echo -e "${BLUE}【8】检查访问日志${NC}"
if [ -f "/var/log/nginx/access.log" ]; then
    echo "  最近的访问记录（端口 8080）:"
    grep ":8080 " /var/log/nginx/access.log 2>/dev/null | tail -5 || echo "    无访问记录"
    echo
    echo "  最近的访问记录（端口 8081）:"
    grep ":8081 " /var/log/nginx/access.log 2>/dev/null | tail -5 || echo "    无访问记录"
else
    echo -e "${YELLOW}  ⚠ 访问日志文件不存在${NC}"
fi

echo
echo -e "${BLUE}【9】测试访问${NC}"
echo "测试端口 8080:"
HTTP_CODE_8080=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/ 2>/dev/null)
if [ "$HTTP_CODE_8080" = "200" ]; then
    echo -e "${GREEN}  ✓ HTTP 200 - 正常${NC}"
elif [ "$HTTP_CODE_8080" = "404" ]; then
    echo -e "${RED}  ✗ HTTP 404 - 文件未找到${NC}"
else
    echo -e "${YELLOW}  ⚠ HTTP $HTTP_CODE_8080${NC}"
fi

echo "测试端口 8081:"
HTTP_CODE_8081=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8081/ 2>/dev/null)
if [ "$HTTP_CODE_8081" = "200" ]; then
    echo -e "${GREEN}  ✓ HTTP 200 - 正常${NC}"
elif [ "$HTTP_CODE_8081" = "404" ]; then
    echo -e "${RED}  ✗ HTTP 404 - 文件未找到${NC}"
else
    echo -e "${YELLOW}  ⚠ HTTP $HTTP_CODE_8081${NC}"
fi

echo
echo -e "${BLUE}【10】检查 SYN_RECV 连接${NC}"
SYN_RECV_COUNT=$(netstat -an | grep SYN_RECV | wc -l)
if [ $SYN_RECV_COUNT -gt 0 ]; then
    echo -e "${YELLOW}  ⚠ 发现 $SYN_RECV_COUNT 个 SYN_RECV 连接${NC}"
    echo "  这可能是 SYN Flood 攻击或连接队列满"
    echo "  详细信息:"
    netstat -an | grep SYN_RECV | head -5
    echo
    echo "  建议运行修复脚本: sudo ./修复SYN_RECV连接问题.sh"
else
    echo -e "${GREEN}  ✓ 无 SYN_RECV 连接${NC}"
fi

echo
echo "=========================================="
echo "诊断完成"
echo "=========================================="
echo

# 提供建议
if [ "$HTTP_CODE_8080" = "404" ] || [ "$HTTP_CODE_8081" = "404" ]; then
    echo -e "${YELLOW}建议:${NC}"
    echo "1. 检查文件路径是否正确"
    echo "2. 检查 Nginx 用户是否有权限访问文件"
    echo "3. 运行修复脚本: sudo ./配置nginx.sh"
fi

if [ $SYN_RECV_COUNT -gt 10 ]; then
    echo -e "${RED}警告: SYN_RECV 连接数过多，可能遭受攻击${NC}"
    echo "  立即运行: sudo ./修复SYN_RECV连接问题.sh"
fi

