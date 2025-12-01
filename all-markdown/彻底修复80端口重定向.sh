#!/bin/bash
# 彻底修复 80 端口重定向问题 - 禁用所有默认配置

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
DEFAULT_CONFIG="/etc/nginx/conf.d/default.conf"
NGINX_MAIN_CONFIG="/etc/nginx/nginx.conf"

echo "=========================================="
echo "彻底修复 80 端口重定向问题"
echo "=========================================="
echo

# 【1】查找所有监听 80 端口的配置
echo -e "${BLUE}【1】查找所有监听 80 端口的配置${NC}"
echo "搜索所有配置文件..."
ALL_80_CONFIGS=$(grep -r "listen 80" /etc/nginx/ 2>/dev/null | grep -v ".backup" | grep -v ".disabled" | grep -v "#" | cut -d: -f1 | sort -u)

if [ -z "$ALL_80_CONFIGS" ]; then
    echo -e "${YELLOW}⚠ 未找到监听 80 端口的配置${NC}"
else
    echo "找到以下文件包含 'listen 80':"
    for file in $ALL_80_CONFIGS; do
        echo "  - $file"
        echo "    配置内容:"
        grep -A 5 "listen 80" "$file" | head -8 | sed 's/^/      /'
        echo
    done
fi
echo

# 【2】禁用所有默认配置文件
echo -e "${BLUE}【2】禁用所有默认配置文件${NC}"

# 禁用 /etc/nginx/conf.d/default.conf
if [ -f "$DEFAULT_CONFIG" ]; then
    echo "发现默认配置: $DEFAULT_CONFIG"
    if [ ! -f "${DEFAULT_CONFIG}.disabled" ]; then
        mv "$DEFAULT_CONFIG" "${DEFAULT_CONFIG}.disabled"
        echo -e "${GREEN}✓ 已禁用: $DEFAULT_CONFIG${NC}"
    else
        echo -e "${GREEN}✓ 已禁用（之前已处理）${NC}"
    fi
fi

# 禁用其他可能的默认配置
for file in /etc/nginx/conf.d/*.conf; do
    if [ -f "$file" ] && [ "$file" != "$NGINX_CONFIG" ]; then
        if grep -q "listen 80" "$file" && ! grep -q "8080\|8081" "$file"; then
            echo "发现其他监听 80 端口的配置: $file"
            if [ ! -f "${file}.disabled" ]; then
                mv "$file" "${file}.disabled"
                echo -e "${GREEN}✓ 已禁用: $file${NC}"
            fi
        fi
    fi
done
echo

# 【3】检查主配置文件
echo -e "${BLUE}【3】检查主配置文件${NC}"
if grep -A 20 "server {" "$NGINX_MAIN_CONFIG" | grep -q "listen 80"; then
    echo -e "${YELLOW}⚠ 主配置文件中可能有 server 块监听 80 端口${NC}"
    echo "请手动检查: $NGINX_MAIN_CONFIG"
    echo "相关配置:"
    grep -B 5 -A 15 "listen 80" "$NGINX_MAIN_CONFIG" | head -20
    echo
    read -p "是否继续? [Y/n]: " continue_choice
    continue_choice=${continue_choice:-Y}
    if [[ ! $continue_choice =~ ^[Yy]$ ]]; then
        exit 0
    fi
else
    echo -e "${GREEN}✓ 主配置文件中没有监听 80 端口的配置${NC}"
fi
echo

# 【4】确保我们的配置正确
echo -e "${BLUE}【4】确保我们的配置正确${NC}"
if [ ! -f "$NGINX_CONFIG" ]; then
    echo -e "${RED}✗ 配置文件不存在: $NGINX_CONFIG${NC}"
    echo "请先运行: sudo ./配置nginx.sh"
    exit 1
fi

# 检查是否有 80 端口配置
if ! grep -q "listen 80" "$NGINX_CONFIG"; then
    echo -e "${YELLOW}⚠ 未找到 80 端口配置，正在添加...${NC}"
    
    # 获取 8080 的 root 路径
    ROOT_8080=$(grep -A 20 "listen 8080" "$NGINX_CONFIG" | grep "root" | head -1 | awk '{print $2}' | sed 's/;//')
    
    # 添加 80 端口重定向配置
    cat >> "$NGINX_CONFIG" <<EOF

# 80 端口重定向到 8080（HTTP 301 永久重定向）
server {
    listen 80 default_server;
    server_name _;
    
    # 重定向所有请求到 8080 端口
    return 301 http://\$host:8080\$request_uri;
}
EOF
    echo -e "${GREEN}✓ 已添加 80 端口配置${NC}"
else
    echo -e "${GREEN}✓ 找到 80 端口配置${NC}"
    
    # 检查是否使用 default_server
    if ! grep -A 5 "listen 80" "$NGINX_CONFIG" | grep -q "default_server"; then
        echo -e "${YELLOW}⚠ 未使用 default_server，正在修改...${NC}"
        
        # 备份配置
        cp "$NGINX_CONFIG" "${NGINX_CONFIG}.backup.$(date +%Y%m%d_%H%M%S)"
        
        # 修改 listen 80 为 listen 80 default_server
        sed -i 's/listen 80;/listen 80 default_server;/g' "$NGINX_CONFIG"
        sed -i 's/listen 80[^0-9]/listen 80 default_server /g' "$NGINX_CONFIG"
        
        echo -e "${GREEN}✓ 已修改为 default_server${NC}"
    else
        echo -e "${GREEN}✓ 已使用 default_server${NC}"
    fi
fi

# 显示当前配置
echo
echo "当前 80 端口配置:"
grep -B 2 -A 10 "listen 80" "$NGINX_CONFIG" | head -15
echo

# 【5】测试配置
echo -e "${BLUE}【5】测试 Nginx 配置${NC}"
if nginx -t 2>&1 | grep -q "successful"; then
    echo -e "${GREEN}✓ 配置语法正确${NC}"
else
    echo -e "${RED}✗ 配置语法错误:${NC}"
    nginx -t
    exit 1
fi
echo

# 【6】完全重启 Nginx
echo -e "${BLUE}【6】完全重启 Nginx${NC}"
systemctl stop nginx
sleep 3

# 确保所有 Nginx 进程都停止
pkill -9 nginx 2>/dev/null
sleep 2

systemctl start nginx
sleep 3

if systemctl is-active --quiet nginx; then
    echo -e "${GREEN}✓ Nginx 已重启${NC}"
else
    echo -e "${RED}✗ Nginx 启动失败${NC}"
    systemctl status nginx --no-pager | head -15
    exit 1
fi
echo

# 【7】检查端口监听
echo -e "${BLUE}【7】检查端口监听${NC}"
echo "监听 80 端口的进程:"
ss -tulnp | grep ":80 " || echo "  未找到"
echo

# 【8】测试重定向
echo -e "${BLUE}【8】测试重定向${NC}"
echo "测试 HTTP 请求:"
HTTP_RESPONSE=$(curl -sI http://localhost/ 2>&1)
HTTP_CODE=$(echo "$HTTP_RESPONSE" | head -1 | awk '{print $2}')
LOCATION=$(echo "$HTTP_RESPONSE" | grep -i "location:" | awk '{print $2}' | tr -d '\r')

echo "完整响应:"
echo "$HTTP_RESPONSE" | head -10
echo

if [ "$HTTP_CODE" = "301" ] || [ "$HTTP_CODE" = "302" ]; then
    echo -e "${GREEN}✓✓✓ 重定向成功！${NC}"
    echo "HTTP 状态码: $HTTP_CODE"
    echo "重定向到: $LOCATION"
elif [ "$HTTP_CODE" = "200" ]; then
    echo -e "${RED}✗ 仍然返回 200${NC}"
    echo
    echo "进一步检查:"
    echo "  1. 查看所有配置文件:"
    echo "     sudo grep -r 'listen 80' /etc/nginx/"
    echo
    echo "  2. 查看 Nginx 实际加载的配置:"
    echo "     sudo nginx -T | grep -B 5 -A 15 'listen 80'"
    echo
    echo "  3. 检查是否有其他 Nginx 实例:"
    echo "     ps aux | grep nginx"
    echo "     sudo lsof -i:80"
else
    echo -e "${RED}✗ 返回错误状态码: $HTTP_CODE${NC}"
fi
echo

# 【9】显示所有相关配置
echo -e "${BLUE}【9】显示所有相关配置${NC}"
echo "所有监听 80 端口的配置（包括已禁用的）:"
grep -r "listen 80" /etc/nginx/ 2>/dev/null | grep -v ".backup" | head -20
echo

# 【10】显示 Nginx 实际加载的配置
echo -e "${BLUE}【10】Nginx 实际加载的配置${NC}"
echo "使用 nginx -T 查看实际配置（监听 80 的部分）:"
nginx -T 2>/dev/null | grep -B 5 -A 15 "listen 80" | head -30
echo

echo "=========================================="
echo "修复完成"
echo "=========================================="
echo
if [ "$HTTP_CODE" = "301" ] || [ "$HTTP_CODE" = "302" ]; then
    echo -e "${GREEN}✓ 重定向已成功配置！${NC}"
    echo
    echo "测试命令:"
    echo "  curl -I http://localhost/"
    echo "  curl -I http://your-server-ip/"
else
    echo -e "${YELLOW}⚠ 如果仍然返回 200，请检查:${NC}"
    echo "  1. 运行: sudo nginx -T | grep -B 5 -A 15 'listen 80'"
    echo "  2. 检查是否有多个 Nginx 实例"
    echo "  3. 检查主配置文件: $NGINX_MAIN_CONFIG"
fi
echo

