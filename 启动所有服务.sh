#!/bin/bash

# 申允木业项目 - 启动所有服务 (Linux版本)

echo "========================================"
echo "申允木业项目 - 启动所有服务"
echo "========================================"
echo

# 检查是否指定了环境参数
ENV="development"
if [ "$1" = "prod" ] || [ "$1" = "production" ]; then
    ENV="production"
fi

echo "当前环境: $ENV"
echo

# 检查必要的命令是否存在
if ! command -v npm &> /dev/null; then
    echo "错误: 未找到 npm，请先安装 Node.js"
    exit 1
fi

if ! command -v python3 &> /dev/null; then
    echo "错误: 未找到 python3，请先安装 Python3"
    exit 1
fi

# 检查 Nginx 是否已安装（推荐使用 Nginx）
if ! command -v nginx &> /dev/null; then
    echo "警告: 未找到 Nginx"
    echo "  推荐安装 Nginx 以获得更好的性能和稳定性"
    echo ""
    echo "  快速安装:"
    echo "    sudo ./安装nginx.sh"
    echo ""
    echo "  或手动安装:"
    echo "    sudo yum install -y nginx --disableexcludes=all"
    echo ""
    echo "  安装后配置:"
    echo "    sudo ./配置nginx.sh"
    echo ""
    echo "  注意: 前端服务现在使用 Nginx，请先安装和配置 Nginx"
    echo ""
    read -p "是否继续（将无法启动前端服务）? [y/N]: " continue_choice
    if [[ ! $continue_choice =~ ^[Yy]$ ]]; then
        exit 1
    fi
else
    echo "✓ Nginx 已安装"
    
    # 检查 Nginx 配置文件是否存在
    if [ ! -f "/etc/nginx/conf.d/shenyunmuye.conf" ]; then
        echo "⚠ 警告: Nginx 配置文件不存在"
        echo "  请运行配置脚本: sudo ./配置nginx.sh"
        echo ""
        read -p "是否继续（前端服务可能无法启动）? [y/N]: " continue_choice
        if [[ ! $continue_choice =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
fi

# 获取脚本所在目录
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# 创建日志目录（使用绝对路径）
LOG_DIR="$SCRIPT_DIR/logs"
mkdir -p "$LOG_DIR"

# 创建PID文件目录（使用绝对路径）
PID_DIR="$SCRIPT_DIR/pids"
mkdir -p "$PID_DIR"

# 所有服务都以 root 用户运行（因为需要访问 /root 目录）
# 确保日志和PID目录权限正确
if [ "$EUID" -eq 0 ]; then
    chmod -R 755 "$LOG_DIR" "$PID_DIR" 2>/dev/null
fi

# 检查端口是否已被占用
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1 || netstat -tuln 2>/dev/null | grep -q ":$port "; then
        echo "警告: 端口 $port 已被占用"
        return 1
    fi
    return 0
}

# 启动服务的函数（以 root 用户运行，因为需要访问 /root 目录）
start_service() {
    local name=$1
    local dir=$2
    local port=$3
    local log_file="$LOG_DIR/${name}.log"
    local pid_file="$PID_DIR/${name}.pid"
    
    if [ -f "$pid_file" ]; then
        local old_pid=$(cat "$pid_file")
        if kill -0 "$old_pid" 2>/dev/null; then
            echo "服务 $name 已在运行 (PID: $old_pid)"
            return 0
        else
            rm -f "$pid_file"
        fi
    fi
    
    check_port $port
    cd "$dir"
    
    if [ ! -d "node_modules" ]; then
        echo "正在安装 $name 的依赖..."
        npm install
    fi
    
    if [ "$ENV" = "production" ]; then
        export NODE_ENV=production
    else
        export NODE_ENV=development
    fi
    
    # 确保目录存在
    mkdir -p "$LOG_DIR"
    mkdir -p "$PID_DIR"
    
    # 以当前用户运行（通常是 root，因为需要访问 /root 目录）
    nohup npm start > "$log_file" 2>&1 &
    local pid=$!
    echo $pid > "$pid_file"
    
    cd "$SCRIPT_DIR"
    
    sleep 2
    
    if kill -0 "$pid" 2>/dev/null; then
        echo "✓ $name 启动成功 (PID: $pid, 端口: $port, 用户: root)"
        return 0
    else
        echo "✗ $name 启动失败，请查看日志: $log_file"
        rm -f "$pid_file"
        return 1
    fi
}

# 启动Python HTTP服务器（已弃用，保留用于兼容性）
start_python_server() {
    local name=$1
    local dir=$2
    local port=$3
    local log_file="$LOG_DIR/${name}.log"
    local pid_file="$PID_DIR/${name}.pid"
    
    if [ -f "$pid_file" ]; then
        local old_pid=$(cat "$pid_file")
        if kill -0 "$old_pid" 2>/dev/null; then
            echo "服务 $name 已在运行 (PID: $old_pid)"
            return 0
        else
            rm -f "$pid_file"
        fi
    fi
    
    check_port $port
    cd "$dir"
    
    # 确保目录存在
    mkdir -p "$LOG_DIR"
    mkdir -p "$PID_DIR"
    
    nohup python3 -m http.server $port > "$log_file" 2>&1 &
    local pid=$!
    echo $pid > "$pid_file"
    cd "$SCRIPT_DIR"
    
    sleep 1
    
    if kill -0 "$pid" 2>/dev/null; then
        echo "✓ $name 启动成功 (PID: $pid, 端口: $port)"
        return 0
    else
        echo "✗ $name 启动失败，请查看日志: $log_file"
        rm -f "$pid_file"
        return 1
    fi
}

# 启动 Nginx（用于前端网站和管理后台前端，生产级服务器）
start_nginx_server() {
    local name=$1
    local dir=$2
    local port=$3
    local pid_file="$PID_DIR/${name}.pid"
    
    # 检查 Nginx 是否安装
    if ! command -v nginx &> /dev/null; then
        echo "✗ Nginx 未安装，请先安装 Nginx"
        echo "  运行: sudo ./安装nginx.sh"
        echo "  或: sudo yum install -y nginx --disableexcludes=all"
        return 1
    fi
    
    # 检查 Nginx 配置目录是否存在
    NGINX_CONF_DIR="/etc/nginx/conf.d"
    if [ ! -d "$NGINX_CONF_DIR" ]; then
        echo "⚠ 警告: Nginx 配置目录不存在: $NGINX_CONF_DIR"
        echo "  请先安装和配置 Nginx"
        return 1
    fi
    
    # 根据服务名称确定应该检查的配置文件
    if [ "$name" = "firewall-frontend" ]; then
        # 防火墙管理系统使用独立的配置文件
        NGINX_CONFIG="$NGINX_CONF_DIR/manager-firewall.conf"
        if [ ! -f "$NGINX_CONFIG" ]; then
            echo "⚠ 警告: 防火墙管理配置文件不存在: $NGINX_CONFIG"
            echo "  请运行配置脚本: sudo ./manager-firewall/配置nginx.sh"
            echo "  或手动创建配置文件"
            return 1
        fi
    else
        # 其他服务使用主配置文件
        NGINX_CONFIG="$NGINX_CONF_DIR/shenyunmuye.conf"
        if [ ! -f "$NGINX_CONFIG" ]; then
            echo "⚠ 警告: Nginx 配置文件不存在: $NGINX_CONFIG"
            echo "  请先运行配置脚本: sudo ./配置nginx.sh"
            echo "  或手动创建配置文件"
            return 1
        fi
    fi
    
    # 检查配置文件中是否包含该端口的配置
    if ! grep -q "listen $port" "$NGINX_CONFIG" 2>/dev/null; then
        echo "⚠ 警告: 配置文件中未找到端口 $port 的配置"
        echo "  请检查配置文件: $NGINX_CONFIG"
        if [ "$name" = "firewall-frontend" ]; then
            echo "  或运行配置脚本: sudo ./manager-firewall/配置nginx.sh"
        else
            echo "  或运行配置脚本: sudo ./配置nginx.sh"
        fi
    fi
    
    # 检查 Nginx 配置语法
    echo "检查 Nginx 配置..."
    if [ "$EUID" -eq 0 ]; then
        NGINX_TEST=$(nginx -t 2>&1)
    else
        NGINX_TEST=$(sudo nginx -t 2>&1)
    fi
    
    if [ $? -ne 0 ]; then
        echo "✗ Nginx 配置测试失败:"
        echo "$NGINX_TEST"
        echo "  请修复配置后重试"
        return 1
    fi
    echo "✓ Nginx 配置测试通过"
    
    # 检查端口是否被占用（排除 Nginx）
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        local pid=$(lsof -Pi :$port -sTCP:LISTEN -t | head -1)
        local cmd=$(ps -p $pid -o cmd= 2>/dev/null)
        if ! echo "$cmd" | grep -q "nginx"; then
            echo "⚠ 警告: 端口 $port 已被其他进程占用 (PID: $pid)"
            echo "  请先停止占用端口的进程"
            return 1
        fi
    fi
    
    # 启动或重载 Nginx（如果是系统服务）
    if systemctl is-active --quiet nginx 2>/dev/null; then
        echo "✓ Nginx 已在运行，重载配置以确保端口 $port 生效..."
        # 重载配置以确保最新配置生效
        if [ "$EUID" -eq 0 ]; then
            nginx -s reload &>/dev/null
        else
            sudo nginx -s reload &>/dev/null
        fi
        
        if [ $? -eq 0 ]; then
            echo "✓ Nginx 配置已重载"
        else
            echo "⚠ 警告: Nginx 配置重载失败"
        fi
    else
        echo "启动 Nginx 服务..."
        if [ "$EUID" -eq 0 ]; then
            systemctl start nginx
            systemctl enable nginx &>/dev/null
        else
            sudo systemctl start nginx
            sudo systemctl enable nginx &>/dev/null
        fi
        
        if [ $? -ne 0 ]; then
            echo "✗ Nginx 启动失败"
            echo "  查看日志: sudo journalctl -u nginx -n 50"
            return 1
        fi
        echo "✓ Nginx 服务已启动并设置为开机自启"
    fi
    
    # 等待 Nginx 启动
    sleep 2
    
    # 获取 Nginx 主进程 PID（从 systemd 或进程查找）
    local nginx_pid=""
    
    # 方法1: 从 systemd 获取
    if systemctl is-active --quiet nginx 2>/dev/null; then
        nginx_pid=$(systemctl show nginx --property MainPID --value 2>/dev/null)
    fi
    
    # 方法2: 从进程查找
    if [ -z "$nginx_pid" ]; then
        nginx_pid=$(pgrep -f "nginx: master process" | head -1)
    fi
    
    # 方法3: 从端口查找（作为备选）
    if [ -z "$nginx_pid" ]; then
        nginx_pid=$(lsof -ti tcp:$port 2>/dev/null | head -1)
    fi
    
    # 保存 PID 到文件（用于停止脚本）
    if [ -n "$nginx_pid" ] && kill -0 "$nginx_pid" 2>/dev/null; then
        echo $nginx_pid > "$pid_file"
        echo "✓ Nginx PID 已保存: $nginx_pid"
    fi
    
    # 验证端口是否在监听
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1 || netstat -tuln 2>/dev/null | grep -q ":$port "; then
        echo "✓ $name 启动成功 (端口: $port, 使用 Nginx, PID: ${nginx_pid:-未知})"
        echo "  访问地址: http://localhost:$port"
        return 0
    else
        echo "⚠ 警告: 端口 $port 未监听"
        echo "  可能的原因:"
        echo "  1. Nginx 配置文件中未正确配置该端口"
        echo "  2. 配置文件路径不正确"
        echo "  3. 检查配置文件: $NGINX_CONFIG"
        echo "  4. 查看 Nginx 错误日志: sudo tail -f /var/log/nginx/error.log"
        return 1
    fi
}

# 启动 http-server（已弃用，保留用于兼容性）
start_http_server() {
    local name=$1
    local dir=$2
    local port=$3
    local log_file="$LOG_DIR/${name}.log"
    local pid_file="$PID_DIR/${name}.pid"
    
    if [ -f "$pid_file" ]; then
        local old_pid=$(cat "$pid_file")
        if kill -0 "$old_pid" 2>/dev/null; then
            echo "服务 $name 已在运行 (PID: $old_pid)"
            return 0
        else
            rm -f "$pid_file"
        fi
    fi
    
    check_port $port
    cd "$dir"
    
    # 确保目录存在
    mkdir -p "$LOG_DIR"
    mkdir -p "$PID_DIR"
    
    # 使用 http-server 启动
    nohup http-server -a 0.0.0.0 -p $port --log-ip > "$log_file" 2>&1 &
    local pid=$!
    echo $pid > "$pid_file"
    cd "$SCRIPT_DIR"
    
    sleep 3
    
    if kill -0 "$pid" 2>/dev/null; then
        if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1 || netstat -tuln 2>/dev/null | grep -q ":$port "; then
            echo "✓ $name 启动成功 (PID: $pid, 端口: $port, 使用 http-server)"
            return 0
        else
            echo "⚠ 警告: 进程存在但端口未监听，请检查日志: $log_file"
            return 1
        fi
    else
        echo "✗ $name 启动失败，请查看日志: $log_file"
        rm -f "$pid_file"
        return 1
    fi
}

if [ "$ENV" = "production" ]; then
    echo "[1/4] 启动前端网站后端服务 (端口 3000)..."
    export WEBSITE_BACKEND_PORT=3000
    export WEBSITE_BACKEND_HOST=152.32.209.245
    start_service "website-backend" "shenyunmuye-backend" 3000
    
    sleep 2
    
    echo "[2/4] 启动管理后台后端服务 (端口 3001)..."
    export ADMIN_BACKEND_PORT=3001
    export ADMIN_BACKEND_HOST=152.32.209.245
    export ADMIN_FRONTEND_URL=http://152.32.209.245:8081
    start_service "admin-backend" "shenyunmuye-admin-backend" 3001
    
    sleep 2
    
    echo "[3/4] 启动前端网站 (端口 8080)..."
    start_nginx_server "website-frontend" "shenyunmuye-website" 8080
    
    sleep 1
    
    echo "[4/4] 启动管理后台前端 (端口 8081)..."
    start_nginx_server "admin-frontend" "shenyunmuye-admin-frontend" 8081
    
    sleep 1
    
    echo "[5/5] 启动防火墙管理后端服务 (端口 3002)..."
    export FIREWALL_BACKEND_PORT=3002
    export FIREWALL_BACKEND_HOST=0.0.0.0
    export FIREWALL_FRONTEND_URL=http://152.32.209.245:8082
    start_service "firewall-backend" "manager-firewall/backend" 3002
    
    sleep 1
    
    echo "[6/6] 启动防火墙管理前端 (端口 8082)..."
    start_nginx_server "firewall-frontend" "manager-firewall/frontend" 8082
    
    sleep 1
    
    echo
    echo "========================================"
    echo "所有服务已启动！"
    echo "========================================"
    echo
    echo "访问地址："
    echo "  前端网站: http://152.32.209.245:8080"
    echo "  管理后台: http://152.32.209.245:8081/login.html"
    echo "  防火墙管理: http://152.32.209.245:8082"
    echo
    echo "默认管理账户："
    echo "  用户名: admin"
    echo "  密码: admin123"
    echo
    echo "日志文件保存在: $LOG_DIR/"
    echo "PID文件保存在: $PID_DIR/"
    echo
    echo "使用 ./停止所有服务.sh 停止所有服务"
    echo
else
    echo "[1/4] 启动前端网站后端服务 (端口 3000)..."
    export WEBSITE_BACKEND_PORT=3000
    export WEBSITE_BACKEND_HOST=localhost
    start_service "website-backend" "shenyunmuye-backend" 3000
    
    sleep 2
    
    echo "[2/4] 启动管理后台后端服务 (端口 3001)..."
    export ADMIN_BACKEND_PORT=3001
    export ADMIN_BACKEND_HOST=localhost
    export ADMIN_FRONTEND_URL=http://localhost:8081
    start_service "admin-backend" "shenyunmuye-admin-backend" 3001
    
    sleep 2
    
    echo "[3/4] 启动前端网站 (端口 8080)..."
    start_nginx_server "website-frontend" "shenyunmuye-website" 8080
    
    sleep 1
    
    echo "[4/4] 启动管理后台前端 (端口 8081)..."
    start_nginx_server "admin-frontend" "shenyunmuye-admin-frontend" 8081
    
    sleep 1
    
    echo "[5/5] 启动防火墙管理后端服务 (端口 3002)..."
    export FIREWALL_BACKEND_PORT=3002
    export FIREWALL_BACKEND_HOST=localhost
    export FIREWALL_FRONTEND_URL=http://localhost:8082
    start_service "firewall-backend" "manager-firewall/backend" 3002
    
    sleep 1
    
    echo "[6/6] 启动防火墙管理前端 (端口 8082)..."
    start_nginx_server "firewall-frontend" "manager-firewall/frontend" 8082
    
    sleep 1
    
    echo
    echo "========================================"
    echo "所有服务已启动！"
    echo "========================================"
    echo
    echo "访问地址："
    echo "  前端网站: http://localhost:8080"
    echo "  管理后台: http://localhost:8081/login.html"
    echo "  防火墙管理: http://localhost:8082"
    echo
    echo "默认管理账户："
    echo "  用户名: admin"
    echo "  密码: admin123"
    echo
    echo "日志文件保存在: $LOG_DIR/"
    echo "PID文件保存在: $PID_DIR/"
    echo
    echo "使用 ./停止所有服务.sh 停止所有服务"
    echo
fi
