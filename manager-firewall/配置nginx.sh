#!/bin/bash
# 配置 Nginx 以提供防火墙管理系统前端服务

echo "=========================================="
echo "配置防火墙管理系统 Nginx"
echo "=========================================="

# 检查 root 权限
if [ "$EUID" -ne 0 ]; then 
    echo "错误: 需要 root 权限"
    echo "请使用: sudo $0"
    exit 1
fi

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
NGINX_CONFIG="/etc/nginx/conf.d/manager-firewall.conf"

# 备份现有配置
if [ -f "$NGINX_CONFIG" ]; then
    BACKUP_FILE="${NGINX_CONFIG}.backup.$(date +%Y%m%d_%H%M%S)"
    cp "$NGINX_CONFIG" "$BACKUP_FILE"
    echo "✓ 已备份现有配置到: $BACKUP_FILE"
fi

# 创建 Nginx 配置
cat > "$NGINX_CONFIG" <<'EOF'
# 防火墙管理系统 Nginx 配置

# 前端服务（端口 8082）
server {
    listen 8082;
    server_name _;
    
    root /root/manager-firewall/frontend;
    index index.html login.html;
    
    # 日志配置
    access_log /var/log/nginx/manager-firewall-access.log;
    error_log /var/log/nginx/manager-firewall-error.log;
    
    # 静态文件
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    # API 代理到后端服务（端口 3002）
    location /api {
        proxy_pass http://localhost:3002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # CORS 头
        add_header Access-Control-Allow-Origin * always;
        add_header Access-Control-Allow-Methods 'GET, POST, PUT, DELETE, OPTIONS' always;
        add_header Access-Control-Allow-Headers 'Content-Type, Authorization' always;
        
        if ($request_method = 'OPTIONS') {
            return 204;
        }
    }
    
    # 安全配置
    location ~ /\. {
        deny all;
    }
}
EOF

echo "✓ 已创建 Nginx 配置文件: $NGINX_CONFIG"

# 测试 Nginx 配置
echo ""
echo "测试 Nginx 配置..."
if nginx -t; then
    echo "✓ Nginx 配置测试通过"
    
    # 重载 Nginx
    echo ""
    echo "重载 Nginx 配置..."
    if systemctl reload nginx 2>/dev/null || nginx -s reload 2>/dev/null; then
        echo "✓ Nginx 配置已重载"
    else
        echo "⚠ 警告: Nginx 重载失败，请手动重载"
    fi
else
    echo "✗ Nginx 配置测试失败"
    echo "请检查配置文件: $NGINX_CONFIG"
    exit 1
fi

echo ""
echo "=========================================="
echo "配置完成"
echo "=========================================="
echo ""
echo "访问地址: http://localhost:8082"
echo ""

