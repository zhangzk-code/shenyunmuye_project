#!/bin/bash
# 管理敏感文件列表

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

SENSITIVE_FILES_CONFIG="/etc/nginx/sensitive_files.list"

# 确保配置文件存在
if [ ! -f "$SENSITIVE_FILES_CONFIG" ]; then
    mkdir -p "$(dirname "$SENSITIVE_FILES_CONFIG")"
    cat > "$SENSITIVE_FILES_CONFIG" <<'EOF'
# 敏感文件列表配置
# 每行一个敏感文件或路径模式（支持正则表达式）
# 访问这些文件的 IP 会被自动封禁
# 格式：文件名或路径模式
# 示例：robots.txt
# 示例：\.env
# 示例：\.git

robots.txt
\.env
\.git
\.svn
\.htaccess
wp-admin
phpmyadmin
\.sql
\.bak
\.backup
\.old
\.log
\.conf
\.config
admin\.php
config\.php
database\.php
\.git/config
\.git/HEAD
web\.config
\.DS_Store
Thumbs\.db
EOF
    echo -e "${GREEN}✓ 已创建配置文件: $SENSITIVE_FILES_CONFIG${NC}"
fi

# 显示菜单
show_menu() {
    echo "=========================================="
    echo "管理敏感文件列表"
    echo "=========================================="
    echo "  1) 查看当前敏感文件列表"
    echo "  2) 添加敏感文件"
    echo "  3) 删除敏感文件"
    echo "  4) 批量添加敏感文件"
    echo "  5) 恢复默认列表"
    echo "  6) 退出"
    echo
}

# 查看列表
view_list() {
    echo "当前敏感文件列表:"
    echo "----------------------------------------"
    grep -v '^#' "$SENSITIVE_FILES_CONFIG" | grep -v '^$' | nl
    echo "----------------------------------------"
    echo "总计: $(grep -v '^#' "$SENSITIVE_FILES_CONFIG" | grep -v '^$' | wc -l) 个敏感文件"
    echo
}

# 添加敏感文件
add_file() {
    read -p "请输入要添加的敏感文件或路径模式 (支持正则表达式): " pattern
    if [ -z "$pattern" ]; then
        echo -e "${RED}输入不能为空${NC}"
        return
    fi
    
    # 检查是否已存在
    if grep -v '^#' "$SENSITIVE_FILES_CONFIG" | grep -q "^${pattern}$"; then
        echo -e "${YELLOW}⚠ 该敏感文件已存在${NC}"
        return
    fi
    
    # 添加到文件末尾（注释行之后）
    echo "$pattern" >> "$SENSITIVE_FILES_CONFIG"
    echo -e "${GREEN}✓ 已添加: $pattern${NC}"
}

# 删除敏感文件
remove_file() {
    view_list
    read -p "请输入要删除的敏感文件（输入行号或完整内容）: " input
    
    if [ -z "$input" ]; then
        echo -e "${RED}输入不能为空${NC}"
        return
    fi
    
    # 判断是行号还是内容
    if [[ "$input" =~ ^[0-9]+$ ]]; then
        # 是行号
        line_num=$(grep -v '^#' "$SENSITIVE_FILES_CONFIG" | grep -v '^$' | sed -n "${input}p" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
        if [ -z "$line_num" ]; then
            echo -e "${RED}无效的行号${NC}"
            return
        fi
        pattern="$line_num"
    else
        # 是内容
        pattern="$input"
    fi
    
    # 删除（只删除非注释行）
    if grep -v '^#' "$SENSITIVE_FILES_CONFIG" | grep -q "^${pattern}$"; then
        # 转义特殊字符
        escaped_pattern=$(echo "$pattern" | sed 's/[[\.*^$()+?{|]/\\&/g')
        sed -i "/^${escaped_pattern}$/d" "$SENSITIVE_FILES_CONFIG"
        echo -e "${GREEN}✓ 已删除: $pattern${NC}"
    else
        echo -e "${YELLOW}⚠ 未找到: $pattern${NC}"
    fi
}

# 批量添加
batch_add() {
    echo "请输入敏感文件列表（每行一个，输入空行结束）:"
    echo "提示：支持正则表达式，例如 \.env 表示 .env"
    echo
    
    temp_file=$(mktemp)
    while true; do
        read -p "> " line
        if [ -z "$line" ]; then
            break
        fi
        echo "$line" >> "$temp_file"
    done
    
    if [ -s "$temp_file" ]; then
        added=0
        skipped=0
        while read pattern; do
            if grep -v '^#' "$SENSITIVE_FILES_CONFIG" | grep -q "^${pattern}$"; then
                skipped=$((skipped + 1))
            else
                echo "$pattern" >> "$SENSITIVE_FILES_CONFIG"
                added=$((added + 1))
            fi
        done < "$temp_file"
        
        echo
        echo -e "${GREEN}✓ 已添加: $added 个${NC}"
        if [ $skipped -gt 0 ]; then
            echo -e "${YELLOW}⚠ 跳过（已存在）: $skipped 个${NC}"
        fi
    else
        echo -e "${YELLOW}⚠ 未输入任何内容${NC}"
    fi
    
    rm -f "$temp_file"
}

# 恢复默认列表
restore_default() {
    read -p "确定要恢复默认列表吗？这将覆盖当前配置 [y/N]: " confirm
    if [[ ! $confirm =~ ^[Yy]$ ]]; then
        echo "已取消"
        return
    fi
    
    # 备份当前配置
    BACKUP_FILE="${SENSITIVE_FILES_CONFIG}.backup.$(date +%Y%m%d_%H%M%S)"
    cp "$SENSITIVE_FILES_CONFIG" "$BACKUP_FILE"
    echo -e "${GREEN}✓ 已备份当前配置到: $BACKUP_FILE${NC}"
    
    # 恢复默认配置
    cat > "$SENSITIVE_FILES_CONFIG" <<'EOF'
# 敏感文件列表配置
# 每行一个敏感文件或路径模式（支持正则表达式）
# 访问这些文件的 IP 会被自动封禁
# 格式：文件名或路径模式
# 示例：robots.txt
# 示例：\.env
# 示例：\.git

robots.txt
\.env
\.git
\.svn
\.htaccess
wp-admin
phpmyadmin
\.sql
\.bak
\.backup
\.old
\.log
\.conf
\.config
admin\.php
config\.php
database\.php
\.git/config
\.git/HEAD
web\.config
\.DS_Store
Thumbs\.db
EOF
    
    echo -e "${GREEN}✓ 已恢复默认列表${NC}"
}

# 主循环
while true; do
    show_menu
    read -p "请选择操作 [1-6]: " choice
    
    case $choice in
        1)
            view_list
            ;;
        2)
            add_file
            ;;
        3)
            remove_file
            ;;
        4)
            batch_add
            ;;
        5)
            restore_default
            ;;
        6)
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

