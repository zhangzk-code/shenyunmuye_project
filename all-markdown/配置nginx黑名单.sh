#!/bin/bash
# 配置 Nginx IP 黑名单 - 禁止恶意 IP 访问

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

BLACKLIST_FILE="/etc/nginx/conf.d/blacklist.conf"
WHITELIST_FILE="/etc/nginx/whitelist.conf"
NGINX_CONFIG="/etc/nginx/conf.d/shenyunmuye.conf"
NGINX_MAIN_CONFIG="/etc/nginx/nginx.conf"

echo "=========================================="
echo "配置 Nginx IP 黑名单"
echo "=========================================="
echo

# 【1】创建黑名单配置文件
echo -e "${BLUE}【1】创建黑名单配置文件${NC}"
if [ ! -f "$BLACKLIST_FILE" ]; then
    cat > "$BLACKLIST_FILE" <<'EOF'
# Nginx IP 黑名单配置
# 此文件包含被禁止访问的 IP 地址
# 格式: deny IP地址;
# 示例: deny 192.168.1.100;
# 示例: deny 10.0.0.0/8;  (禁止整个网段)

# 以下是被禁止的 IP 地址
# 手动添加的 IP 请添加在下方

EOF
    echo -e "${GREEN}✓ 已创建黑名单配置文件: $BLACKLIST_FILE${NC}"
else
    echo -e "${GREEN}✓ 黑名单配置文件已存在${NC}"
fi
echo

# 【2】在主配置文件中引入黑名单
echo -e "${BLUE}【2】配置 Nginx 使用黑名单${NC}"

# 检查主配置文件是否已包含黑名单
if grep -q "blacklist.conf" "$NGINX_MAIN_CONFIG" 2>/dev/null; then
    echo -e "${GREEN}✓ 主配置文件中已包含黑名单${NC}"
elif [ -f "$NGINX_CONFIG" ] && grep -q "blacklist.conf" "$NGINX_CONFIG" 2>/dev/null; then
    echo -e "${GREEN}✓ 配置文件中已包含黑名单${NC}"
else
    # 在 http 块中添加 include
    if [ -f "$NGINX_MAIN_CONFIG" ]; then
        # 检查 http 块
        if grep -q "^http {" "$NGINX_MAIN_CONFIG"; then
            # 在 http 块末尾（最后一个 } 之前）添加 include
            if ! grep -q "include.*blacklist.conf" "$NGINX_MAIN_CONFIG"; then
                # 在 http 块的 include 行附近添加
                if grep -q "include.*conf.d/\*\.conf" "$NGINX_MAIN_CONFIG"; then
                    echo -e "${YELLOW}⚠ 主配置文件已包含 conf.d/*.conf，黑名单会自动加载${NC}"
                else
                    # 手动添加 include
                    sed -i '/^http {/a\    include /etc/nginx/conf.d/blacklist.conf;' "$NGINX_MAIN_CONFIG"
                    echo -e "${GREEN}✓ 已在主配置文件中添加黑名单引用${NC}"
                fi
            fi
        fi
    fi
    
    # 或者在项目配置文件中添加
    if [ -f "$NGINX_CONFIG" ]; then
        # 在每个 server 块中添加
        if ! grep -q "include.*blacklist.conf" "$NGINX_CONFIG"; then
            # 在每个 server 块开头添加
            sed -i '/^server {/a\    include /etc/nginx/conf.d/blacklist.conf;' "$NGINX_CONFIG"
            echo -e "${GREEN}✓ 已在项目配置文件中添加黑名单引用${NC}"
        fi
    fi
fi
echo

# 【3】显示菜单
show_menu() {
    echo "=========================================="
    echo "IP 黑名单管理"
    echo "=========================================="
    echo "  1) 添加 IP 到黑名单"
    echo "  2) 从黑名单中删除 IP"
    echo "  3) 查看当前黑名单"
    echo "  4) 从日志中提取恶意 IP（扫描敏感文件）"
    echo "  5) 从日志中提取频繁访问的 IP（可能攻击）"
    echo "  6) 从日志中提取异常请求的 IP（TLS扫描、二进制数据等）"
    echo "  7) 管理敏感文件列表"
    echo "  8) 管理 IP 白名单（不会被自动封禁）"
    echo "  9) 安装自动封禁服务（定时任务）"
    echo "  10) 手动执行自动扫描"
    echo "  11) 清空黑名单"
    echo "  12) 测试配置并重载 Nginx"
    echo "  13) 退出"
    echo
}

# 将 IP 地址转换为整数
ip_to_int() {
    local ip=$1
    IFS='.' read -ra ADDR <<< "$ip"
    
    # 验证 IP 格式（必须是 4 段）
    if [ ${#ADDR[@]} -ne 4 ]; then
        echo ""
        return 1
    fi
    
    # 验证每个段是否在 0-255 范围内
    for i in "${ADDR[@]}"; do
        if ! [[ "$i" =~ ^[0-9]+$ ]] || [ "$i" -lt 0 ] || [ "$i" -gt 255 ]; then
            echo ""
            return 1
        fi
    done
    
    echo $(( (${ADDR[0]} * 256 * 256 * 256) + (${ADDR[1]} * 256 * 256) + (${ADDR[2]} * 256) + ${ADDR[3]} ))
}

# 检查 IP 是否在 CIDR 网段内
ip_in_cidr() {
    local ip=$1
    local cidr=$2
    
    # 提取网络地址和子网掩码位数
    local network=$(echo "$cidr" | cut -d'/' -f1)
    local prefix=$(echo "$cidr" | cut -d'/' -f2)
    
    # 验证格式
    if ! [[ "$network" =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$ ]] || \
       ! [[ "$prefix" =~ ^[0-9]+$ ]] || [ "$prefix" -lt 0 ] || [ "$prefix" -gt 32 ]; then
        return 1
    fi
    
    # 将 IP 和网络地址转换为整数
    local ip_int=$(ip_to_int "$ip")
    local network_int=$(ip_to_int "$network")
    
    # 如果转换失败，返回 1
    if [ -z "$ip_int" ] || [ -z "$network_int" ]; then
        return 1
    fi
    
    # 计算子网掩码并检查 IP 是否在网段内
    if [ "$prefix" -eq 0 ]; then
        # /0 匹配所有 IP
        return 0
    elif [ "$prefix" -eq 32 ]; then
        # /32 精确匹配
        if [ "$ip_int" -eq "$network_int" ]; then
            return 0
        else
            return 1
        fi
    else
        # 计算掩码：前 prefix 位为 1，后 (32-prefix) 位为 0
        # 使用：mask = (2^32 - 1) - (2^(32-prefix) - 1)
        local host_bits=$((32 - prefix))
        local host_mask=$(( (1 << host_bits) - 1 ))
        local mask=$(( 4294967295 - host_mask ))
        
        # 检查 IP 和网络地址在掩码后的网络部分是否相同
        if [ $((ip_int & mask)) -eq $((network_int & mask)) ]; then
            return 0  # 在网段内
        else
            return 1  # 不在网段内
        fi
    fi
}

# 检查 IP 是否在白名单中
is_whitelisted() {
    local ip=$1
    
    # 如果 IP 为空，不在白名单中
    if [ -z "$ip" ]; then
        return 1
    fi
    
    if [ ! -f "$WHITELIST_FILE" ]; then
        return 1  # 白名单文件不存在，不在白名单中
    fi
    
    # 检查 IP 是否在白名单中（排除注释行）
    if grep -v '^[[:space:]]*#' "$WHITELIST_FILE" | grep -q "^[[:space:]]*${ip}[[:space:]]*$"; then
        return 0  # 在白名单中
    fi
    
    # 检查 CIDR 网段
    while IFS= read -r whitelist_entry; do
        # 跳过注释和空行
        [[ "$whitelist_entry" =~ ^[[:space:]]*# ]] && continue
        [[ -z "${whitelist_entry// }" ]] && continue
        
        # 如果是 CIDR 格式，检查 IP 是否在网段内
        if [[ "$whitelist_entry" =~ / ]]; then
            if ip_in_cidr "$ip" "$whitelist_entry"; then
                return 0  # 在网段内
            fi
        fi
    done < "$WHITELIST_FILE"
    
    return 1  # 不在白名单中
}

# 统一的添加 IP 到黑名单函数（确保白名单检查）
# 参数: $1=IP地址, $2=注释/原因（可选）
# 返回值: 0=成功添加, 1=跳过（已在黑名单/白名单/无效IP等）
add_to_blacklist() {
    local ip=$1
    local comment=$2
    
    # 如果 IP 为空，跳过
    if [ -z "$ip" ]; then
        return 1
    fi
    
    # 检查是否在白名单中（优先级最高，必须在检查黑名单之前）
    if is_whitelisted "$ip"; then
        echo -e "${YELLOW}⚠ 跳过白名单 IP: $ip${NC}"
        return 1  # 返回 1 表示跳过
    fi
    
    # 检查 IP 是否已在黑名单中（排除注释行）
    if grep -v '^[[:space:]]*#' "$BLACKLIST_FILE" | grep -q "^[[:space:]]*deny[[:space:]]\+$ip[[:space:]]*;"; then
        return 1  # 已在黑名单中，跳过
    fi
    
    # 添加 IP 到黑名单
    if [ -n "$comment" ]; then
        echo "deny $ip; # $comment" >> "$BLACKLIST_FILE"
    else
        echo "deny $ip;" >> "$BLACKLIST_FILE"
    fi
    
    return 0  # 返回 0 表示成功添加
}

# 【4】添加 IP 到黑名单
add_ip() {
    read -p "请输入要禁止的 IP 地址 (例如: 192.168.1.100 或 10.0.0.0/8): " ip
    if [ -z "$ip" ]; then
        echo -e "${RED}IP 地址不能为空${NC}"
        return
    fi
    
    # 使用统一的添加函数（会自动检查白名单）
    local comment=""
    read -p "是否添加备注? [y/N]: " add_note
    if [[ $add_note =~ ^[Yy]$ ]]; then
        read -p "请输入备注: " note
        comment="$note"
    fi
    
    if add_to_blacklist "$ip" "$comment"; then
        echo -e "${GREEN}✓ 已添加 IP $ip 到黑名单${NC}"
    else
        # add_to_blacklist 已经输出了相应的提示信息（白名单或已在黑名单）
        # 这里不需要额外输出
        :
    fi
}

# 【5】从黑名单中删除 IP
remove_ip() {
    read -p "请输入要删除的 IP 地址: " ip
    if [ -z "$ip" ]; then
        echo -e "${RED}IP 地址不能为空${NC}"
        return
    fi
    
    # 检查 IP 是否在黑名单中（排除注释行）
    if grep -v '^[[:space:]]*#' "$BLACKLIST_FILE" | grep -q "^[[:space:]]*deny[[:space:]]\+$ip[[:space:]]*;"; then
        # 删除匹配的行（包括注释）
        sed -i "/^[[:space:]]*deny[[:space:]]\+$ip[[:space:]]*;/d" "$BLACKLIST_FILE"
        echo -e "${GREEN}✓ 已从黑名单中删除 IP $ip${NC}"
    else
        echo -e "${YELLOW}⚠ IP $ip 不在黑名单中${NC}"
    fi
}

# 【6】查看当前黑名单
view_blacklist() {
    echo "当前黑名单:"
    echo "----------------------------------------"
    # 只显示非注释行的 deny 指令
    if grep -v '^[[:space:]]*#' "$BLACKLIST_FILE" | grep -q "deny"; then
        grep -v '^[[:space:]]*#' "$BLACKLIST_FILE" | grep "deny" | nl
    else
        echo "  黑名单为空"
    fi
    echo "----------------------------------------"
    # 统计非注释行的 deny 数量
    echo "总计: $(grep -v '^[[:space:]]*#' "$BLACKLIST_FILE" | grep -c "deny" 2>/dev/null || echo 0) 个 IP"
}

# 【7】从日志中提取扫描敏感文件的 IP
extract_scanner_ips() {
    echo "正在分析日志，查找扫描敏感文件的 IP..."
    echo
    
    # 加载敏感文件列表（使用 .list 扩展名，避免被 Nginx 解析）
    SENSITIVE_FILES_CONFIG="/etc/nginx/sensitive_files.list"
    if [ ! -f "$SENSITIVE_FILES_CONFIG" ]; then
        echo -e "${YELLOW}⚠ 敏感文件配置文件不存在，使用默认列表${NC}"
        SENSITIVE_FILES=("\.env" "\.git" "\.svn" "\.htaccess" "wp-admin" "phpmyadmin" "\.sql" "\.bak" "\.backup" "\.old" "\.log" "\.conf" "\.config")
    else
        # 从配置文件读取敏感文件列表（排除注释和空行）
        SENSITIVE_FILES=()
        while IFS= read -r line; do
            line=$(echo "$line" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
            if [[ ! "$line" =~ ^# ]] && [[ -n "$line" ]]; then
                SENSITIVE_FILES+=("$line")
            fi
        done < "$SENSITIVE_FILES_CONFIG"
    fi
    
    SENSITIVE_PATTERNS=$(IFS='|'; echo "${SENSITIVE_FILES[*]}")
    
    # 扫描 /var/log/nginx 目录下所有日志文件
    LOG_DIR="/var/log/nginx"
    LOG_FILES=($(find "$LOG_DIR" -name "*.log" -type f 2>/dev/null))
    
    if [ ${#LOG_FILES[@]} -eq 0 ]; then
        echo -e "${YELLOW}⚠ 未找到日志文件${NC}"
        return
    fi
    
    echo "找到 ${#LOG_FILES[@]} 个日志文件"
    echo
    
    SCANNER_IPS=$(mktemp)
    IP_FILE_MAP=$(mktemp)
    
    for log_file in "${LOG_FILES[@]}"; do
        if [ -f "$log_file" ]; then
            echo "分析: $log_file"
            # 提取 IP 和对应的敏感文件
            grep -E "$SENSITIVE_PATTERNS" "$log_file" 2>/dev/null | \
                awk -v pattern="$SENSITIVE_PATTERNS" '
                BEGIN {
                    split(pattern, patterns, "|")
                }
                {
                    ip = $1
                    path = $7
                    # 验证 IP 格式（使用 [.] 代替 \. 避免转义警告）
                    if (ip ~ /^[0-9]{1,3}[.][0-9]{1,3}[.][0-9]{1,3}[.][0-9]{1,3}$/ && ip !~ /^[0-9]{4}\//) {
                        # 验证 IP 段范围
                        split(ip, parts, "[.]")
                        if (parts[1] <= 255 && parts[2] <= 255 && parts[3] <= 255 && parts[4] <= 255) {
                            # 找出匹配的敏感文件
                            for (i in patterns) {
                                if (path ~ patterns[i]) {
                                    print ip "|" patterns[i]
                                    break
                                }
                            }
                        }
                    }
                }
                ' 2>/dev/null | sort -u >> "$IP_FILE_MAP"
        fi
    done
    
    # 按 IP 分组，收集所有访问的敏感文件
    if [ -s "$IP_FILE_MAP" ]; then
        awk -F'|' '
        {
            ip = $1
            file = $2
            if (!(ip in files)) {
                files[ip] = file
            } else {
                if (index(files[ip], file) == 0) {
                    files[ip] = files[ip] "," file
                }
            }
        }
        END {
            for (ip in files) {
                print ip "|" files[ip]
            }
        }
        ' "$IP_FILE_MAP" | sort -u > "$SCANNER_IPS"
    fi
    
    if [ -s "$SCANNER_IPS" ]; then
        IP_COUNT=$(wc -l < "$SCANNER_IPS")
        echo
        echo "找到 $IP_COUNT 个可疑 IP:"
        head -20 "$SCANNER_IPS" | while IFS='|' read ip files; do
            # 使用 | 作为分隔符避免 sed 错误
            clean_files=$(echo "$files" | sed 's|\\\.|.|g' | sed 's|\\/|/|g' | sed 's|\\\\|\\|g')
            echo "  $ip - 访问: $clean_files"
        done
        echo
        
        read -p "是否将这些 IP 添加到黑名单? [y/N]: " add_choice
        if [[ $add_choice =~ ^[Yy]$ ]]; then
            added=0
            skipped=0
            
            while IFS='|' read ip files; do
                # 使用 | 作为分隔符避免 sed 错误
                clean_files=$(echo "$files" | sed 's|\\\.|.|g' | sed 's|\\/|/|g' | sed 's|\\\\|\\|g')
                
                # 使用统一的添加函数（会自动检查白名单）
                if add_to_blacklist "$ip" "自动添加 - 扫描敏感文件: $clean_files"; then
                    added=$((added + 1))
                else
                    # 如果是白名单 IP，增加跳过计数
                    if is_whitelisted "$ip"; then
                        skipped=$((skipped + 1))
                    fi
                fi
            done < "$SCANNER_IPS"
            
            echo -e "${GREEN}✓ 已添加 $added 个 IP 到黑名单${NC}"
            if [ $skipped -gt 0 ]; then
                echo -e "${YELLOW}⚠ 跳过 $skipped 个白名单 IP${NC}"
            fi
        fi
    else
        echo -e "${YELLOW}⚠ 未找到扫描敏感文件的 IP${NC}"
    fi
    
    rm -f "$SCANNER_IPS" "$IP_FILE_MAP"
}

# 【8】从日志中提取频繁访问的 IP（可能攻击）
extract_attacker_ips() {
    read -p "请输入阈值（每分钟请求数，默认 1000）: " threshold
    threshold=${threshold:-1000}
    
    echo "正在分析日志，查找频繁访问的 IP（> $threshold 次/分钟）..."
    echo
    
    # 扫描 /var/log/nginx 目录下所有日志文件
    LOG_DIR="/var/log/nginx"
    LOG_FILES=($(find "$LOG_DIR" -name "*.log" -type f 2>/dev/null))
    
    if [ ${#LOG_FILES[@]} -eq 0 ]; then
        echo -e "${YELLOW}⚠ 未找到日志文件${NC}"
        return
    fi
    
    echo "找到 ${#LOG_FILES[@]} 个日志文件"
    echo
    
    ATTACKER_IPS=$(mktemp)
    
    for log_file in "${LOG_FILES[@]}"; do
        if [ -f "$log_file" ]; then
            echo "分析: $log_file"
            # 统计每个 IP 的请求数（最近1分钟，使用 tail 限制处理最近10000行）
            # 只统计有效的 IP 地址
            tail -n 10000 "$log_file" 2>/dev/null | awk -v threshold=$threshold '
                {
                    ip = $1
                    # 验证 IP 格式（使用 [.] 代替 \. 避免转义警告）
                    if (ip ~ /^[0-9]{1,3}[.][0-9]{1,3}[.][0-9]{1,3}[.][0-9]{1,3}$/ && ip !~ /^[0-9]{4}\//) {
                        # 验证 IP 段范围
                        split(ip, parts, "[.]")
                        if (parts[1] <= 255 && parts[2] <= 255 && parts[3] <= 255 && parts[4] <= 255) {
                            requests[ip]++
                        }
                    }
                }
                END {
                    for (ip in requests) {
                        if (requests[ip] > threshold) {
                            print ip
                        }
                    }
                }
            ' "$log_file" 2>/dev/null >> "$ATTACKER_IPS"
        fi
    done
    
    if [ -s "$ATTACKER_IPS" ]; then
        IP_COUNT=$(sort -u "$ATTACKER_IPS" | wc -l)
        echo
        echo "找到 $IP_COUNT 个可疑 IP（请求数 > $threshold）:"
        sort -u "$ATTACKER_IPS" | head -20
        echo
        
        read -p "是否将这些 IP 添加到黑名单? [y/N]: " add_choice
        if [[ $add_choice =~ ^[Yy]$ ]]; then
            added=0
            skipped=0
            
            for ip in $(sort -u "$ATTACKER_IPS"); do
                # 使用统一的添加函数（会自动检查白名单）
                if add_to_blacklist "$ip" "自动添加 - 频繁访问 ($threshold+ 次/分钟)"; then
                    added=$((added + 1))
                else
                    # 如果是白名单 IP，增加跳过计数
                    if is_whitelisted "$ip"; then
                        skipped=$((skipped + 1))
                    fi
                fi
            done
            
            echo -e "${GREEN}✓ 已添加 $added 个 IP 到黑名单${NC}"
            if [ $skipped -gt 0 ]; then
                echo -e "${YELLOW}⚠ 跳过 $skipped 个白名单 IP${NC}"
            fi
        fi
    else
        echo -e "${YELLOW}⚠ 未找到频繁访问的 IP${NC}"
    fi
    
    rm -f "$ATTACKER_IPS"
}

# 【8】从日志中提取异常请求的 IP（二进制数据等，不包含 TLS 握手）
extract_abnormal_ips() {
    echo "正在分析日志，查找异常请求的 IP..."
    echo "检测类型："
    echo "  - 二进制数据请求（排除 TLS 握手）"
    echo "  - 返回 400 错误的异常请求（排除 TLS 相关）"
    echo "  - 异常 User-Agent"
    echo "  注意：不检测 TLS/SSL 握手尝试（\\x16\\x03\\x01），因为这是正常的 HTTPS 连接尝试"
    echo
    
    # 扫描 /var/log/nginx 目录下所有日志文件
    LOG_DIR="/var/log/nginx"
    LOG_FILES=($(find "$LOG_DIR" -name "*.log" -type f 2>/dev/null))
    
    if [ ${#LOG_FILES[@]} -eq 0 ]; then
        echo -e "${YELLOW}⚠ 未找到日志文件${NC}"
        return
    fi
    
    echo "找到 ${#LOG_FILES[@]} 个日志文件"
    echo
    
    ABNORMAL_IPS=$(mktemp)
    ABNORMAL_DETAILS=$(mktemp)  # 存储 IP 和异常原因
    
    for log_file in "${LOG_FILES[@]}"; do
        if [ -f "$log_file" ]; then
            echo "分析: $log_file"
            
            # 注意：不检测 TLS 握手尝试（\x16\x03\x01），因为这是正常的 HTTPS 连接尝试
            
            # 注意：异常请求检测已优化，避免误封正常用户
            # 只检测明显的恶意请求，不检测单个二进制字符或短请求
            
            # 1. 检测包含多个连续二进制数据的请求（排除 TLS 握手）
            # 只检测包含 3 个以上连续 \x 转义序列的请求（更可能是攻击）
            grep -E "\\\\x[0-9a-fA-F]{2}.*\\\\x[0-9a-fA-F]{2}.*\\\\x[0-9a-fA-F]{2}" "$log_file" 2>/dev/null | \
                grep -v "\\\\x16\\\\x03\\\\x01" | \
                awk '{
                    ip = $1
                    # 验证 IP 格式（使用 [.] 代替 \. 避免转义警告）
                    if (ip ~ /^[0-9]{1,3}[.][0-9]{1,3}[.][0-9]{1,3}[.][0-9]{1,3}$/ && ip !~ /^[0-9]{4}\//) {
                        split(ip, parts, "[.]")
                        if (parts[1] <= 255 && parts[2] <= 255 && parts[3] <= 255 && parts[4] <= 255) {
                            print ip "|二进制数据攻击（包含多个连续\\x转义序列）"
                        }
                    }
                }' 2>/dev/null | sort -u >> "$ABNORMAL_DETAILS"
            
            # 2. 检测返回 400 错误且请求异常的（排除 TLS 相关的 400 错误）
            # 更严格的判断：请求行长度 > 500 字符且包含非打印字符（更可能是攻击）
            awk '$9 == 400 && $10 != 157 && length($7) > 500 && $7 ~ /[^[:print:]]/ {
                ip = $1
                path = $7
                if (ip ~ /^[0-9]{1,3}[.][0-9]{1,3}[.][0-9]{1,3}[.][0-9]{1,3}$/ && ip !~ /^[0-9]{4}\//) {
                    split(ip, parts, "[.]")
                    if (parts[1] <= 255 && parts[2] <= 255 && parts[3] <= 255 && parts[4] <= 255) {
                        # 截取路径前100字符用于显示
                        path_short = substr(path, 1, 100)
                        if (length(path) > 100) path_short = path_short "..."
                        print ip "|异常请求路径（长度" length(path) "字符，包含非打印字符）: " path_short
                    }
                }
            }' "$log_file" 2>/dev/null | sort -u >> "$ABNORMAL_DETAILS"
            
            # 3. 检测 User-Agent 为空且返回 400（排除 TLS 相关的）
            # 更严格的判断：User-Agent 为空 + 返回 400 + 请求路径异常长（> 300字符）
            awk '($11 == "-" || $11 == "\"-\"") && $9 == 400 && $10 != 157 && length($7) > 300 {
                ip = $1
                path = $7
                if (ip ~ /^[0-9]{1,3}[.][0-9]{1,3}[.][0-9]{1,3}[.][0-9]{1,3}$/ && ip !~ /^[0-9]{4}\//) {
                    split(ip, parts, "[.]")
                    if (parts[1] <= 255 && parts[2] <= 255 && parts[3] <= 255 && parts[4] <= 255) {
                        # 截取路径前100字符用于显示
                        path_short = substr(path, 1, 100)
                        if (length(path) > 100) path_short = path_short "..."
                        print ip "|空User-Agent且异常请求路径（长度" length(path) "字符）: " path_short
                    }
                }
            }' "$log_file" 2>/dev/null | sort -u >> "$ABNORMAL_DETAILS"
        fi
    done
    
    # 提取唯一的 IP 列表
    cut -d'|' -f1 "$ABNORMAL_DETAILS" 2>/dev/null | sort -u > "$ABNORMAL_IPS"
    
    if [ -s "$ABNORMAL_IPS" ]; then
        IP_COUNT=$(sort -u "$ABNORMAL_IPS" | wc -l)
        echo
        echo "找到 $IP_COUNT 个可疑 IP（异常请求）:"
        echo "----------------------------------------"
        # 显示 IP 和对应的异常原因
        while IFS='|' read ip reason; do
            echo -e "${RED}$ip${NC}"
            echo -e "  原因: ${YELLOW}$reason${NC}"
            echo
        done < <(sort -u "$ABNORMAL_DETAILS" | head -30)
        echo "----------------------------------------"
        echo
        
        read -p "是否将这些 IP 添加到黑名单? [y/N]: " add_choice
        if [[ $add_choice =~ ^[Yy]$ ]]; then
            added=0
            skipped=0
            
            # 从详细信息中提取 IP 和原因
            while IFS='|' read ip reason; do
                # 检查是否在白名单中
                # 截取原因的前50字符，避免注释过长
                reason_short=$(echo "$reason" | cut -c1-50)
                
                # 使用统一的添加函数（会自动检查白名单）
                if add_to_blacklist "$ip" "自动添加 - $reason_short"; then
                    added=$((added + 1))
                else
                    # 如果是白名单 IP，增加跳过计数
                    if is_whitelisted "$ip"; then
                        skipped=$((skipped + 1))
                    fi
                fi
            done < <(sort -u "$ABNORMAL_DETAILS")
            
            echo -e "${GREEN}✓ 已添加 $added 个 IP 到黑名单${NC}"
            if [ $skipped -gt 0 ]; then
                echo -e "${YELLOW}⚠ 跳过 $skipped 个白名单 IP${NC}"
            fi
        fi
    else
        echo -e "${YELLOW}⚠ 未找到异常请求的 IP${NC}"
    fi
    
    rm -f "$ABNORMAL_IPS" "$ABNORMAL_DETAILS"
}

# 【9】清空黑名单
clear_blacklist() {
    read -p "确定要清空黑名单吗? [y/N]: " confirm
    if [[ $confirm =~ ^[Yy]$ ]]; then
        # 备份当前黑名单
        cp "$BLACKLIST_FILE" "${BLACKLIST_FILE}.backup.$(date +%Y%m%d_%H%M%S)"
        
        # 检查文件是否有注释头
        if grep -q "^#" "$BLACKLIST_FILE"; then
            # 保留文件头注释（保留所有以 # 开头的行）
            grep "^#" "$BLACKLIST_FILE" > "$BLACKLIST_FILE.tmp"
            # 添加一个空行
            echo "" >> "$BLACKLIST_FILE.tmp"
        else
            # 如果没有注释，创建默认注释
            cat > "$BLACKLIST_FILE.tmp" <<'EOF'
# Nginx IP 黑名单配置
# 此文件包含被禁止访问的 IP 地址
# 自动添加的 IP 请勿手动删除（除非确认安全）

EOF
        fi
        
        mv "$BLACKLIST_FILE.tmp" "$BLACKLIST_FILE"
        echo -e "${GREEN}✓ 黑名单已清空（已备份）${NC}"
        echo "备份文件: ${BLACKLIST_FILE}.backup.$(date +%Y%m%d_%H%M%S)"
    fi
}

# 【10】测试配置并重载
reload_nginx() {
    echo "测试 Nginx 配置..."
    if nginx -t 2>&1 | grep -q "successful"; then
        echo -e "${GREEN}✓ 配置语法正确${NC}"
        echo "重载 Nginx..."
        nginx -s reload
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}✓ Nginx 配置已重载${NC}"
        else
            echo -e "${RED}✗ Nginx 重载失败${NC}"
        fi
    else
        echo -e "${RED}✗ 配置语法错误:${NC}"
        nginx -t
    fi
}

# 主循环
while true; do
    show_menu
    read -p "请选择操作 [1-13]: " choice
    
    case $choice in
        1)
            add_ip
            echo
            ;;
        2)
            remove_ip
            echo
            ;;
        3)
            view_blacklist
            echo
            ;;
        4)
            extract_scanner_ips
            echo
            ;;
        5)
            extract_attacker_ips
            echo
            ;;
        6)
            extract_abnormal_ips
            echo
            ;;
        7)
            if [ -f "./管理敏感文件列表.sh" ]; then
                bash ./管理敏感文件列表.sh
            else
                echo -e "${RED}错误: 找不到 管理敏感文件列表.sh${NC}"
            fi
            echo
            ;;
        8)
            if [ -f "./管理IP白名单.sh" ]; then
                bash ./管理IP白名单.sh
            else
                echo -e "${RED}错误: 找不到 管理IP白名单.sh${NC}"
            fi
            echo
            ;;
        9)
            if [ -f "./安装自动封禁服务.sh" ]; then
                bash ./安装自动封禁服务.sh
            else
                echo -e "${RED}错误: 找不到 安装自动封禁服务.sh${NC}"
            fi
            echo
            ;;
        10)
            if [ -f "./自动扫描并封禁恶意IP.sh" ]; then
                echo "正在执行自动扫描..."
                bash ./自动扫描并封禁恶意IP.sh
            else
                echo -e "${RED}错误: 找不到 自动扫描并封禁恶意IP.sh${NC}"
            fi
            echo
            ;;
        11)
            clear_blacklist
            echo
            ;;
        12)
            reload_nginx
            echo
            ;;
        13)
            echo "退出"
            exit 0
            ;;
        *)
            echo -e "${RED}无效的选择${NC}"
            echo
            ;;
    esac
    
    read -p "按 Enter 继续..."
    clear
done

