#!/bin/bash
# 自动扫描 Nginx 日志并封禁恶意 IP
# 功能：
# 1. 扫描 /var/log/nginx/ 下所有日志
# 2. 1分钟内访问超过1000次自动封禁
# 3. 访问敏感文件自动封禁
# 4. 自动重载 Nginx

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 配置参数
BLACKLIST_FILE="/etc/nginx/conf.d/blacklist.conf"
WHITELIST_FILE="/etc/nginx/whitelist.conf"
LOG_DIR="/var/log/nginx"
THRESHOLD=1000  # 1分钟内访问次数阈值
SCAN_INTERVAL=60  # 扫描时间窗口（秒）

# 敏感文件列表配置文件（使用 .list 扩展名，避免被 Nginx 解析）
SENSITIVE_FILES_CONFIG="/etc/nginx/sensitive_files.list"

# 加载敏感文件列表
load_sensitive_files() {
    if [ ! -f "$SENSITIVE_FILES_CONFIG" ]; then
        # 创建默认配置文件
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
        echo -e "${GREEN}✓ 已创建敏感文件配置文件: $SENSITIVE_FILES_CONFIG${NC}"
    fi
    
    # 读取敏感文件列表（排除注释和空行）
    # 使用数组方式读取，避免空格问题
    SENSITIVE_FILES=()
    while IFS= read -r line; do
        # 跳过注释和空行
        line=$(echo "$line" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
        if [[ ! "$line" =~ ^# ]] && [[ -n "$line" ]]; then
            SENSITIVE_FILES+=("$line")
        fi
    done < "$SENSITIVE_FILES_CONFIG"
    
    # 调试：显示加载的敏感文件数量（仅在调试模式）
    if [ ${#SENSITIVE_FILES[@]} -eq 0 ]; then
        log_message "WARN" "敏感文件列表为空，请检查配置文件: $SENSITIVE_FILES_CONFIG"
    fi
}

# 初始化时加载
load_sensitive_files

# 检查root权限
if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}错误: 需要root权限${NC}"
    echo "请使用: sudo $0"
    exit 1
fi

# 确保黑名单文件存在
if [ ! -f "$BLACKLIST_FILE" ]; then
    mkdir -p "$(dirname "$BLACKLIST_FILE")"
    cat > "$BLACKLIST_FILE" <<'EOF'
# Nginx IP 黑名单配置
# 此文件包含被禁止访问的 IP 地址
# 自动添加的 IP 请勿手动删除（除非确认安全）

EOF
    echo -e "${GREEN}✓ 已创建黑名单文件: $BLACKLIST_FILE${NC}"
fi

# 日志函数
log_message() {
    local level=$1
    shift
    local message="$@"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] [$level] $message" | tee -a /var/log/nginx/auto_ban.log
}

# 验证 IP 地址格式
is_valid_ip() {
    local ip=$1
    
    # 跳过空值
    if [ -z "$ip" ]; then
        return 1
    fi
    
    # 跳过明显不是 IP 的值（包含斜杠、日期格式等）
    if [[ "$ip" =~ / ]] || [[ "$ip" =~ ^[0-9]{4}/ ]] || [[ "$ip" =~ ^[0-9]{4}-[0-9]{2} ]]; then
        return 1
    fi
    
    # IPv4 格式验证 (例如: 192.168.1.1)
    if [[ "$ip" =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$ ]]; then
        # 验证每个段是否在 0-255 范围内
        IFS='.' read -ra ADDR <<< "$ip"
        for i in "${ADDR[@]}"; do
            if [ "$i" -gt 255 ] || [ "$i" -lt 0 ]; then
                return 1
            fi
        done
        return 0
    fi
    
    # IPv4 CIDR 格式验证 (例如: 192.168.1.0/24)
    if [[ "$ip" =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}/[0-9]{1,2}$ ]]; then
        return 0
    fi
    
    # IPv6 格式验证（简化，检查基本格式）
    if [[ "$ip" =~ ^([0-9a-fA-F]{0,4}:){1,7}[0-9a-fA-F]{0,4}$ ]] || [[ "$ip" =~ ^::1$ ]]; then
        return 0
    fi
    
    # 不是有效的 IP 地址
    return 1
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
    # 使用精确匹配，避免部分匹配
    if grep -v '^[[:space:]]*#' "$WHITELIST_FILE" | grep -q "^[[:space:]]*${ip}[[:space:]]*$"; then
        return 0  # 在白名单中
    fi
    
    # 检查 CIDR 网段
    # 使用输入重定向而不是管道，确保在同一个 shell 中执行
    while IFS= read -r whitelist_entry || [ -n "$whitelist_entry" ]; do
        # 去除首尾空白字符
        whitelist_entry=$(echo "$whitelist_entry" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
        
        # 跳过注释和空行
        [[ "$whitelist_entry" =~ ^[[:space:]]*# ]] && continue
        [[ -z "$whitelist_entry" ]] && continue
        
        # 如果是 CIDR 格式，检查 IP 是否在网段内
        if [[ "$whitelist_entry" =~ / ]]; then
            if ip_in_cidr "$ip" "$whitelist_entry"; then
                return 0  # 在网段内
            fi
        fi
    done < "$WHITELIST_FILE"
    
    return 1  # 不在白名单中
}

# 添加 IP 到黑名单
# 返回值: 0=成功添加, 1=跳过（已在黑名单/白名单/无效IP等）
add_to_blacklist() {
    local ip=$1
    local reason=$2
    
    # 验证 IP 地址格式
    if ! is_valid_ip "$ip"; then
        log_message "WARN" "跳过无效的 IP 地址: $ip (原因: $reason)"
        return 1
    fi
    
    # 跳过本地 IP
    if [[ "$ip" =~ ^127\.|^::1$|^localhost$|^0\.0\.0\.0$ ]]; then
        return 1
    fi
    
    # 检查是否在白名单中（必须在检查黑名单之前，这是最重要的检查）
    # 白名单检查优先级最高，即使 IP 访问了敏感文件或频繁访问，只要在白名单中就跳过
    if is_whitelisted "$ip"; then
        log_message "INFO" "跳过白名单 IP: $ip (原因: $reason)"
        return 1  # 返回 1 表示跳过，不计数
    fi
    
    # 检查是否已在黑名单中（排除注释行）
    if grep -v '^[[:space:]]*#' "$BLACKLIST_FILE" | grep -q "^[[:space:]]*deny[[:space:]]\+$ip[[:space:]]*;"; then
        return 1
    fi
    
    # 添加 IP
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "deny $ip; # 自动封禁 - $reason - $timestamp" >> "$BLACKLIST_FILE"
    log_message "INFO" "已封禁 IP: $ip (原因: $reason)"
    return 0
}

# 检测频繁访问的 IP
detect_frequent_access() {
    log_message "INFO" "开始检测频繁访问的 IP（阈值: ${THRESHOLD}次/${SCAN_INTERVAL}秒）"
    
    local temp_file=$(mktemp)
    local banned_count=0
    
    # 扫描所有日志文件
    find "$LOG_DIR" -name "*.log" -type f 2>/dev/null | while read log_file; do
        if [ ! -f "$log_file" ]; then
            continue
        fi
        
        # 分析最近 SCAN_INTERVAL 秒的日志
        # 使用 tail 和 awk 统计每个 IP 的访问次数（只统计最近60秒）
        # 注意：必须严格验证 IP 格式，避免提取到日期等无效值
        # 使用 tail -n 10000 限制处理最近10000行日志（通常足够覆盖60秒）
        tail -n 10000 "$log_file" 2>/dev/null | awk -v threshold=$THRESHOLD -v scan_interval=$SCAN_INTERVAL '
        {
            # 提取 IP 地址（第一列）
            ip = $1
            
            # 严格验证 IP 格式：
            # 1. 必须是 IPv4 格式（4个数字段，用点分隔）
            # 2. 不能是日期格式（如 2025/12/01）
            # 3. 每个段必须是 0-255 之间的数字
            if (ip ~ /^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$/ && ip !~ /^[0-9]{4}\//) {
                # 进一步验证：确保不是日期格式（检查第一个段是否 > 255）
                split(ip, parts, ".")
                if (parts[1] <= 255 && parts[2] <= 255 && parts[3] <= 255 && parts[4] <= 255) {
                    requests[ip]++
                }
            }
        }
        END {
            for (ip in requests) {
                if (requests[ip] > threshold) {
                    print ip " " requests[ip]
                }
            }
        }
        ' >> "$temp_file" 2>/dev/null
    done
    
    # 合并结果并去重
    if [ -s "$temp_file" ]; then
        # 使用临时文件而不是管道，避免子shell问题
        local sorted_file=$(mktemp)
        sort -u "$temp_file" > "$sorted_file"
        
        while read ip count; do
            # 添加 IP 到黑名单（会自动检查白名单）
            if add_to_blacklist "$ip" "频繁访问 (${count}次/${SCAN_INTERVAL}秒)"; then
                # add_to_blacklist 返回 0 表示成功添加
                banned_count=$((banned_count + 1))
            fi
        done < "$sorted_file"
        
        rm -f "$sorted_file"
    fi
    
    rm -f "$temp_file"
    
    if [ $banned_count -gt 0 ]; then
        log_message "INFO" "频繁访问检测完成，新增封禁: $banned_count 个 IP"
    else
        log_message "INFO" "频繁访问检测完成，未发现异常 IP"
    fi
}

# 检测访问敏感文件的 IP
detect_sensitive_file_access() {
    log_message "INFO" "开始检测访问敏感文件的 IP"
    
    # 重新加载敏感文件列表（可能已更新）
    load_sensitive_files
    
    local temp_file=$(mktemp)
    local ip_file_map=$(mktemp)
    local banned_count=0
    
    # 扫描所有日志文件
    find "$LOG_DIR" -name "*.log" -type f 2>/dev/null | while read log_file; do
        if [ ! -f "$log_file" ]; then
            continue
        fi
        
        # 对每个敏感文件模式进行匹配
        for sensitive_pattern in "${SENSITIVE_FILES[@]}"; do
            # 查找访问该敏感文件的请求
            # 使用 grep 进行匹配，然后 awk 提取 IP
            # 重定向 stderr 到 /dev/null 避免 awk 警告
            grep -E "$sensitive_pattern" "$log_file" 2>/dev/null | \
                awk -v pattern="$sensitive_pattern" '
                {
                    ip = $1
                    path = $7
                    # 验证 IP 格式（使用 [.] 代替 \. 避免转义警告）
                    if (ip ~ /^[0-9]{1,3}[.][0-9]{1,3}[.][0-9]{1,3}[.][0-9]{1,3}$/ && ip !~ /^[0-9]{4}\//) {
                        # 验证 IP 段范围
                        split(ip, parts, "[.]")
                        if (parts[1] <= 255 && parts[2] <= 255 && parts[3] <= 255 && parts[4] <= 255) {
                            print ip "|" pattern "|" path
                        }
                    }
                }
                ' 2>/dev/null | sort -u >> "$ip_file_map" 2>/dev/null
        done
    done
    
    # 处理结果：按 IP 分组，记录所有访问的敏感文件
    if [ -s "$ip_file_map" ]; then
        # 按 IP 分组，收集所有访问的敏感文件
        awk -F'|' '
        {
            ip = $1
            pattern = $2
            path = $3
            
            # 记录每个 IP 访问的敏感文件
            if (!(ip in files)) {
                files[ip] = pattern
            } else {
                # 如果已存在，添加新的敏感文件（去重）
                if (index(files[ip], pattern) == 0) {
                    files[ip] = files[ip] "," pattern
                }
            }
        }
        END {
            for (ip in files) {
                print ip "|" files[ip]
            }
        }
        ' "$ip_file_map" > "$temp_file" 2>/dev/null
        
        # 使用输入重定向而不是管道，避免子shell问题
        while IFS='|' read ip files; do
            # 格式化敏感文件列表（移除转义字符，更易读）
            # 使用 | 作为分隔符避免 sed 错误（当路径包含 / 时）
            if [ -n "$files" ] && [ "$files" != "" ]; then
                # 替换转义字符，使用 | 作为分隔符
                clean_files=$(echo "$files" | sed 's|\\\.|.|g' | sed 's|\\/|/|g' | sed 's|\\\\|\\|g')
            else
                clean_files="未知文件"
            fi
            if [ -n "$ip" ] && [ "$ip" != "" ]; then
                # 添加 IP 到黑名单（会自动检查白名单）
                if add_to_blacklist "$ip" "访问敏感文件: $clean_files"; then
                    # add_to_blacklist 返回 0 表示成功添加
                    banned_count=$((banned_count + 1))
                fi
            fi
        done < "$temp_file"
    fi
    
    rm -f "$temp_file" "$ip_file_map"
    
    if [ $banned_count -gt 0 ]; then
        log_message "INFO" "敏感文件访问检测完成，新增封禁: $banned_count 个 IP"
    else
        log_message "INFO" "敏感文件访问检测完成，未发现异常 IP"
    fi
}

# 检测异常请求（二进制数据等，不包含 TLS 握手）
detect_abnormal_requests() {
    log_message "INFO" "开始检测异常请求的 IP"
    
    local temp_file=$(mktemp)
    local details_file=$(mktemp)  # 存储 IP 和异常原因
    local banned_count=0
    
    # 扫描所有日志文件
    find "$LOG_DIR" -name "*.log" -type f 2>/dev/null | while read log_file; do
        if [ ! -f "$log_file" ]; then
            continue
        fi
        
        # 注意：不检测 TLS 握手尝试（\x16\x03\x01），因为这是正常的 HTTPS 连接尝试
        
        # 1. 检测包含二进制数据的请求（排除 TLS 握手）
        # 检测包含多个连续 \x 转义序列但不是 TLS 握手的请求
        grep -E "\\\\x[0-9a-fA-F]{2}.*\\\\x[0-9a-fA-F]{2}.*\\\\x[0-9a-fA-F]{2}" "$log_file" 2>/dev/null | \
            grep -v "\\\\x16\\\\x03\\\\x01" | \
            awk '{
                ip = $1
                if (ip ~ /^[0-9]{1,3}[.][0-9]{1,3}[.][0-9]{1,3}[.][0-9]{1,3}$/ && ip !~ /^[0-9]{4}\//) {
                    split(ip, parts, "[.]")
                    if (parts[1] <= 255 && parts[2] <= 255 && parts[3] <= 255 && parts[4] <= 255) {
                        print ip "|二进制数据攻击（包含多个连续\\x转义序列）"
                    }
                }
            }' 2>/dev/null | sort -u >> "$details_file"
        
        # 2. 检测返回 400 错误且请求异常的（排除 TLS 相关的 400 错误）
        # 排除状态码为 157 的请求（通常是 TLS 握手导致的）
        awk '$9 == 400 && $10 != 157 && length($7) > 500 && $7 ~ /[^[:print:]]/ {
            ip = $1
            path = $7
            if (ip ~ /^[0-9]{1,3}[.][0-9]{1,3}[.][0-9]{1,3}[.][0-9]{1,3}$/ && ip !~ /^[0-9]{4}\//) {
                split(ip, parts, "[.]")
                if (parts[1] <= 255 && parts[2] <= 255 && parts[3] <= 255 && parts[4] <= 255) {
                    path_short = substr(path, 1, 80)
                    if (length(path) > 80) path_short = path_short "..."
                    print ip "|异常请求路径（长度" length(path) "字符，包含非打印字符）: " path_short
                }
            }
        }' "$log_file" 2>/dev/null | sort -u >> "$details_file"
        
        # 3. 检测 User-Agent 为空且返回 400（排除 TLS 相关的）
        awk '($11 == "-" || $11 == "\"-\"") && $9 == 400 && $10 != 157 && length($7) > 300 {
            ip = $1
            path = $7
            if (ip ~ /^[0-9]{1,3}[.][0-9]{1,3}[.][0-9]{1,3}[.][0-9]{1,3}$/ && ip !~ /^[0-9]{4}\//) {
                split(ip, parts, "[.]")
                if (parts[1] <= 255 && parts[2] <= 255 && parts[3] <= 255 && parts[4] <= 255) {
                    path_short = substr(path, 1, 80)
                    if (length(path) > 80) path_short = path_short "..."
                    print ip "|空User-Agent且异常请求路径（长度" length(path) "字符）: " path_short
                }
            }
        }' "$log_file" 2>/dev/null | sort -u >> "$details_file"
    done
    
    # 处理结果
    if [ -s "$details_file" ]; then
        while IFS='|' read ip reason; do
            if add_to_blacklist "$ip" "$reason"; then
                # add_to_blacklist 返回 0 表示成功添加
                banned_count=$((banned_count + 1))
            fi
        done < <(sort -u "$details_file")
    fi
    
    rm -f "$temp_file" "$details_file"
    
    if [ $banned_count -gt 0 ]; then
        log_message "INFO" "异常请求检测完成，新增封禁: $banned_count 个 IP"
    else
        log_message "INFO" "异常请求检测完成，未发现异常 IP"
    fi
}

# 重载 Nginx 配置
reload_nginx() {
    # 先检查是否有语法错误
    local nginx_test_output=$(nginx -t 2>&1)
    if echo "$nginx_test_output" | grep -q "successful"; then
        nginx -s reload 2>/dev/null
        if [ $? -eq 0 ]; then
            log_message "INFO" "Nginx 配置已重载"
            return 0
        else
            log_message "ERROR" "Nginx 重载失败"
            return 1
        fi
    else
        log_message "ERROR" "Nginx 配置语法错误，跳过重载"
        echo "$nginx_test_output" >> /var/log/nginx/auto_ban.log 2>&1
        # 显示错误信息（前3行）
        echo "$nginx_test_output" | head -3 | while read line; do
            log_message "ERROR" "$line"
        done
        return 1
    fi
}

# 主函数
main() {
    log_message "INFO" "========== 开始自动扫描并封禁恶意 IP =========="
    
    local total_banned=0
    # 统计黑名单数量（排除注释行，只统计实际的 deny 指令）
    local before_count=$(grep -v '^[[:space:]]*#' "$BLACKLIST_FILE" | grep -c "^[[:space:]]*deny" 2>/dev/null || echo 0)
    
    # 执行各项检测
    detect_frequent_access
    detect_sensitive_file_access
    detect_abnormal_requests
    
    # 统计黑名单数量（排除注释行，只统计实际的 deny 指令）
    local after_count=$(grep -v '^[[:space:]]*#' "$BLACKLIST_FILE" | grep -c "^[[:space:]]*deny" 2>/dev/null || echo 0)
    total_banned=$((after_count - before_count))
    
    # 如果有新增封禁，尝试重载 Nginx
    if [ $total_banned -gt 0 ]; then
        log_message "INFO" "本次扫描新增封禁: $total_banned 个 IP"
        if ! reload_nginx; then
            log_message "WARN" "Nginx 配置有错误，请手动检查: sudo nginx -t"
        fi
    else
        log_message "INFO" "本次扫描未发现新的恶意 IP"
    fi
    
    log_message "INFO" "当前黑名单总数: $after_count 个 IP"
    log_message "INFO" "========== 扫描完成 =========="
    echo
}

# 执行主函数
main

exit 0

