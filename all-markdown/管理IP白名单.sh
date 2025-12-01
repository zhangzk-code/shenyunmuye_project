#!/bin/bash
# 管理 IP 白名单（不会被自动封禁）

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

WHITELIST_FILE="/etc/nginx/whitelist.conf"

# 确保白名单文件存在
if [ ! -f "$WHITELIST_FILE" ]; then
    mkdir -p "$(dirname "$WHITELIST_FILE")"
    cat > "$WHITELIST_FILE" <<'EOF'
# IP 白名单配置
# 此文件中的 IP 不会被自动封禁
# 格式：每行一个 IP 地址
# 示例：39.158.50.12
# 示例：10.0.0.0/8

EOF
    echo -e "${GREEN}✓ 已创建白名单文件: $WHITELIST_FILE${NC}"
fi

# 显示菜单
show_menu() {
    echo "=========================================="
    echo "管理 IP 白名单"
    echo "=========================================="
    echo "  1) 查看当前白名单"
    echo "  2) 添加 IP 到白名单"
    echo "  3) 从白名单中删除 IP"
    echo "  4) 清空白名单"
    echo "  5) 退出"
    echo
}

# 查看白名单
view_whitelist() {
    echo "当前白名单:"
    echo "----------------------------------------"
    grep -v '^#' "$WHITELIST_FILE" | grep -v '^$' | nl
    echo "----------------------------------------"
    echo "总计: $(grep -v '^#' "$WHITELIST_FILE" | grep -v '^$' | wc -l) 个 IP"
    echo
}

# 添加 IP
add_ip() {
    read -p "请输入要添加到白名单的 IP 地址: " ip
    if [ -z "$ip" ]; then
        echo -e "${RED}IP 地址不能为空${NC}"
        return
    fi
    
    # 检查是否已存在
    if grep -v '^#' "$WHITELIST_FILE" | grep -q "^${ip}$"; then
        echo -e "${YELLOW}⚠ IP $ip 已在白名单中${NC}"
        return
    fi
    
    echo "$ip" >> "$WHITELIST_FILE"
    echo -e "${GREEN}✓ 已添加 IP $ip 到白名单${NC}"
}

# 删除 IP
remove_ip() {
    read -p "请输入要删除的 IP 地址: " ip
    if [ -z "$ip" ]; then
        echo -e "${RED}IP 地址不能为空${NC}"
        return
    fi
    
    if grep -v '^#' "$WHITELIST_FILE" | grep -q "^${ip}$"; then
        sed -i "/^${ip}$/d" "$WHITELIST_FILE"
        echo -e "${GREEN}✓ 已从白名单中删除 IP $ip${NC}"
    else
        echo -e "${YELLOW}⚠ IP $ip 不在白名单中${NC}"
    fi
}

# 清空白名单
clear_whitelist() {
    read -p "确定要清空白名单吗? [y/N]: " confirm
    if [[ $confirm =~ ^[Yy]$ ]]; then
        head -5 "$WHITELIST_FILE" > "$WHITELIST_FILE.tmp"
        mv "$WHITELIST_FILE.tmp" "$WHITELIST_FILE"
        echo -e "${GREEN}✓ 白名单已清空${NC}"
    fi
}

# 主循环
while true; do
    show_menu
    read -p "请选择操作 [1-5]: " choice
    
    case $choice in
        1)
            view_whitelist
            ;;
        2)
            add_ip
            ;;
        3)
            remove_ip
            ;;
        4)
            clear_whitelist
            ;;
        5)
            echo "退出"
            exit 0
            ;;
        *)
            echo -e "${RED}无效的选择${NC}"
            ;;
    esac
    
    echo
    read -p "按 Enter 继续..."
    clear
done

