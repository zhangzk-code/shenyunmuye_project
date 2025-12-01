#!/bin/bash
# 自动配置 Nginx 替换 http-server

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

# 获取脚本所在目录
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

echo "=========================================="
echo "配置 Nginx 替换 http-server"
echo "=========================================="
echo

# 检查 Nginx 是否安装
if ! command -v nginx &> /dev/null; then
    echo -e "${YELLOW}Nginx 未安装${NC}"
    echo
    echo "请先安装 Nginx:"
    echo "  方法1: 使用安装脚本（推荐）"
    echo "    sudo ./安装nginx.sh"
    echo
    echo "  方法2: 手动安装"
    if command -v yum &> /dev/null; then
        echo "    sudo yum install -y epel-release"
        echo "    sudo yum install -y nginx"
    elif command -v apt-get &> /dev/null; then
        echo "    sudo apt-get update"
        echo "    sudo apt-get install -y nginx"
    fi
    echo
    read -p "是否现在尝试安装? [Y/n]: " install_choice
    install_choice=${install_choice:-Y}
    
    if [[ $install_choice =~ ^[Yy]$ ]]; then
        if [ -f "./安装nginx.sh" ]; then
            bash ./安装nginx.sh
            if [ $? -ne 0 ]; then
                echo -e "${RED}Nginx 安装失败，请手动安装${NC}"
                exit 1
            fi
        else
            # 尝试直接安装
            if command -v yum &> /dev/null; then
                yum install -y epel-release
                yum install -y nginx
            elif command -v apt-get &> /dev/null; then
                apt-get update
                apt-get install -y nginx
            else
                echo -e "${RED}无法自动安装 Nginx，请手动安装${NC}"
                exit 1
            fi
            
            if [ $? -ne 0 ]; then
                echo -e "${RED}Nginx 安装失败${NC}"
                echo "请运行: sudo ./安装nginx.sh"
                exit 1
            fi
        fi
    else
        echo "退出配置"
        exit 0
    fi
fi

# 检查配置文件是否存在
CONFIG_FILE="/etc/nginx/conf.d/shenyunmuye.conf"
TEMPLATE_FILE="$SCRIPT_DIR/nginx完整配置.conf"

if [ ! -f "$TEMPLATE_FILE" ]; then
    echo -e "${RED}错误: 找不到配置文件模板: $TEMPLATE_FILE${NC}"
    exit 1
fi

# 备份现有配置（如果存在）
if [ -f "$CONFIG_FILE" ]; then
    BACKUP_FILE="${CONFIG_FILE}.backup.$(date +%Y%m%d_%H%M%S)"
    cp "$CONFIG_FILE" "$BACKUP_FILE"
    echo -e "${YELLOW}已备份现有配置到: $BACKUP_FILE${NC}"
fi

# 复制配置文件
cp "$TEMPLATE_FILE" "$CONFIG_FILE"
echo -e "${GREEN}✓ 配置文件已复制到: $CONFIG_FILE${NC}"

# 检测实际项目路径
# 检查是否在 /root 目录下
if [ -d "/root/shenyunmuye-website" ] && [ -d "/root/shenyunmuye-admin-frontend" ]; then
    # 项目直接在 /root 下
    WEBSITE_DIR="/root/shenyunmuye-website"
    ADMIN_DIR="/root/shenyunmuye-admin-frontend"
    echo "检测到项目在 /root 目录下"
elif [ -d "$SCRIPT_DIR/shenyunmuye-website" ] && [ -d "$SCRIPT_DIR/shenyunmuye-admin-frontend" ]; then
    # 项目在脚本目录下
    WEBSITE_DIR="$SCRIPT_DIR/shenyunmuye-website"
    ADMIN_DIR="$SCRIPT_DIR/shenyunmuye-admin-frontend"
    echo "检测到项目在脚本目录下: $SCRIPT_DIR"
else
    # 手动输入
    read -p "请输入前端网站目录路径 (例如: /root/shenyunmuye-website): " WEBSITE_DIR
    read -p "请输入管理后台目录路径 (例如: /root/shenyunmuye-admin-frontend): " ADMIN_DIR
fi

# 验证路径
if [ ! -d "$WEBSITE_DIR" ]; then
    echo "错误: 前端网站目录不存在: $WEBSITE_DIR"
    exit 1
fi

if [ ! -d "$ADMIN_DIR" ]; then
    echo "错误: 管理后台目录不存在: $ADMIN_DIR"
    exit 1
fi

echo "前端网站目录: $WEBSITE_DIR"
echo "管理后台目录: $ADMIN_DIR"

# 替换路径占位符
sed -i "s|root /.*/shenyunmuye-website|root $WEBSITE_DIR|g" "$CONFIG_FILE"
sed -i "s|root /.*/shenyunmuye-admin-frontend|root $ADMIN_DIR|g" "$CONFIG_FILE"

echo -e "${GREEN}✓ 路径已更新${NC}"
echo

# 显示配置摘要
echo "配置摘要:"
echo "  项目路径: $project_path"
echo "  前端网站: $project_path/shenyunmuye-website (端口 8080)"
echo "  管理后台: $project_path/shenyunmuye-admin-frontend (端口 8081)"
echo

# 检查目录是否存在
if [ ! -d "$project_path/shenyunmuye-website" ]; then
    echo -e "${YELLOW}⚠ 警告: 前端网站目录不存在: $project_path/shenyunmuye-website${NC}"
fi

if [ ! -d "$project_path/shenyunmuye-admin-frontend" ]; then
    echo -e "${YELLOW}⚠ 警告: 管理后台目录不存在: $project_path/shenyunmuye-admin-frontend${NC}"
fi

echo
echo "测试 Nginx 配置..."
nginx -t

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ 配置测试通过${NC}"
    echo
    read -p "是否现在启动/重载 Nginx? [Y/n]: " start_nginx
    start_nginx=${start_nginx:-Y}
    
    if [[ $start_nginx =~ ^[Yy]$ ]]; then
        # 启动或重载 Nginx
        if systemctl is-active --quiet nginx; then
            echo "重载 Nginx 配置..."
            nginx -s reload
            echo -e "${GREEN}✓ Nginx 配置已重载${NC}"
        else
            echo "启动 Nginx..."
            systemctl start nginx
            systemctl enable nginx
            echo -e "${GREEN}✓ Nginx 已启动并设置为开机自启${NC}"
        fi
    fi
else
    echo -e "${RED}✗ 配置测试失败，请检查配置文件${NC}"
    echo "配置文件位置: $CONFIG_FILE"
    exit 1
fi

echo
echo "=========================================="
echo "配置完成"
echo "=========================================="
echo
echo "下一步:"
echo "1. 停止旧的 http-server 服务: ./停止所有服务.sh"
echo "2. 验证服务: curl http://localhost:8080/"
echo "3. 查看日志: sudo tail -f /var/log/nginx/website-frontend-access.log"
echo
echo "配置文件位置: $CONFIG_FILE"
echo "如需修改配置，编辑后执行: sudo nginx -t && sudo nginx -s reload"

