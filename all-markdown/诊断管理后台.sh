#!/bin/bash
# 通用服务诊断工具 - 支持交互式输入和全面诊断

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 服务配置映射（日志文件会根据服务类型自动选择）
declare -A SERVICE_MAP
SERVICE_MAP[1]="website-backend:3000:nodejs:logs/website-backend.log:pids/website-backend.pid"
SERVICE_MAP[2]="admin-backend:3001:nodejs:logs/admin-backend.log:pids/admin-backend.pid"
SERVICE_MAP[3]="website-frontend:8080:nginx::pids/website-frontend.pid"
SERVICE_MAP[4]="admin-frontend:8081:nginx::pids/admin-frontend.pid"

# 获取脚本所在目录
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# 函数：显示服务选择菜单
show_service_menu() {
    echo ""
    echo "请选择要诊断的服务："
    echo "  1) 前端网站后端 (端口 3000)"
    echo "  2) 管理后台后端 (端口 3001)"
    echo "  3) 前端网站前端 (端口 8080)"
    echo "  4) 管理后台前端 (端口 8081)"
    echo "  5) 自定义输入"
    echo ""
    read -p "请输入选项 [1-5] (默认: 1): " choice
    choice=${choice:-1}
    
    if [ "$choice" = "5" ]; then
        read -p "请输入PID (留空则通过端口查找): " input_pid
        read -p "请输入端口: " input_port
        read -p "请输入日志文件路径 (留空则自动查找): " input_log
        read -p "请输入PID文件路径 (留空则自动查找): " input_pid_file
        
        if [ -z "$input_port" ]; then
            echo -e "${RED}错误: 端口不能为空${NC}"
            exit 1
        fi
        
        PORT=$input_port
        PID=$input_pid
        LOG_FILE=$input_log
        PID_FILE=$input_pid_file
    else
        service_info=${SERVICE_MAP[$choice]}
        if [ -z "$service_info" ]; then
            echo -e "${RED}错误: 无效的选项${NC}"
            exit 1
        fi
        
        IFS=':' read -r service_name PORT SERVICE_TYPE LOG_FILE PID_FILE <<< "$service_info"
    fi
}

# 函数：通过端口查找PID
find_pid_by_port() {
    local port=$1
    local pid=$(lsof -ti tcp:$port 2>/dev/null | head -1)
    
    if [ -z "$pid" ]; then
        pid=$(netstat -tunlp 2>/dev/null | awk -v p=":$port" '$4 ~ p {split($7,a,"/"); if(a[1]!="-" && a[1]!="") print a[1]}' | head -1)
    fi
    
    echo $pid
}

# 函数：从PID文件读取PID
read_pid_from_file() {
    local pid_file=$1
    if [ -n "$pid_file" ] && [ -f "$pid_file" ]; then
        cat "$pid_file" 2>/dev/null
    fi
}

# 函数：根据服务类型和端口自动查找日志文件
find_log_file() {
    local port=$1
    local service_type=$2
    local log_file=""
    
    # 根据服务类型选择日志文件
    case "$service_type" in
        nginx)
            # Nginx 服务使用系统日志
            if [ "$port" = "8080" ]; then
                # 网站前端 - 检查 Nginx 访问日志和错误日志
                if [ -f "/var/log/nginx/access.log" ]; then
                    log_file="/var/log/nginx/access.log"
                elif [ -f "/var/log/nginx/error.log" ]; then
                    log_file="/var/log/nginx/error.log"
                fi
            elif [ "$port" = "8081" ]; then
                # 管理后台前端 - 检查 Nginx 访问日志和错误日志
                if [ -f "/var/log/nginx/access.log" ]; then
                    log_file="/var/log/nginx/access.log"
                elif [ -f "/var/log/nginx/error.log" ]; then
                    log_file="/var/log/nginx/error.log"
                fi
            fi
            ;;
        nodejs)
            # Node.js 服务使用项目日志
            case "$port" in
                3000)
                    if [ -f "logs/website-backend.log" ]; then
                        log_file="logs/website-backend.log"
                    elif [ -f "website-backend.log" ]; then
                        log_file="website-backend.log"
                    fi
                    ;;
                3001)
                    if [ -f "logs/admin-backend.log" ]; then
                        log_file="logs/admin-backend.log"
                    elif [ -f "admin-backend.log" ]; then
                        log_file="admin-backend.log"
                    fi
                    ;;
            esac
            ;;
        http-server|python-http-server)
            # 旧的前端服务（已弃用，但保留兼容性）
            case "$port" in
                8080)
                    if [ -f "logs/website-frontend.log" ]; then
                        log_file="logs/website-frontend.log"
                    fi
                    ;;
                8081)
                    if [ -f "logs/admin-frontend.log" ]; then
                        log_file="logs/admin-frontend.log"
                    fi
                    ;;
            esac
            ;;
        *)
            # 未知类型，尝试从常见位置查找
            for log in "logs/admin-frontend.log" "logs/website-frontend.log" \
                       "logs/admin-backend.log" "logs/website-backend.log" \
                       "admin-frontend.log" "website-frontend.log" \
                       "admin-backend.log" "website-backend.log"; do
                if [ -f "$log" ]; then
                    if grep -q ":$port" "$log" 2>/dev/null; then
                        log_file=$log
                        break
                    fi
                fi
            done
            ;;
    esac
    
    echo $log_file
}

# 主程序开始
echo "=========================================="
echo "通用服务诊断工具"
echo "=========================================="

# 检查命令行参数
if [ $# -ge 1 ]; then
    # 如果提供了参数，使用参数模式
    if [ "$1" = "--pid" ] && [ -n "$2" ]; then
        PID=$2
        PORT=${3:-3000}
        LOG_FILE=${4:-""}
        PID_FILE=${5:-""}
    elif [ "$1" = "--port" ] && [ -n "$2" ]; then
        PORT=$2
        PID=${3:-""}
        LOG_FILE=${4:-""}
        PID_FILE=${5:-""}
    else
        # 第一个参数作为端口
        PORT=$1
        PID=${2:-""}
        LOG_FILE=${3:-""}
        PID_FILE=${4:-""}
    fi
else
    # 交互式模式
    show_service_menu
fi

# 自动补全缺失的信息
if [ -z "$PID" ]; then
    if [ -n "$PID_FILE" ]; then
        PID=$(read_pid_from_file "$PID_FILE")
    fi
    
    if [ -z "$PID" ] && [ -n "$PORT" ]; then
        PID=$(find_pid_by_port "$PORT")
    fi
fi

# 如果服务类型未确定，先通过端口或PID识别
if [ -z "$SERVICE_TYPE" ]; then
    if [ -n "$PID" ] && ps -p $PID > /dev/null 2>&1; then
        PROCESS_CMD=$(ps -p $PID -o cmd= 2>/dev/null)
        if echo "$PROCESS_CMD" | grep -q "nginx"; then
            SERVICE_TYPE="nginx"
        elif echo "$PROCESS_CMD" | grep -q "node.*server.js"; then
            SERVICE_TYPE="nodejs"
        elif echo "$PROCESS_CMD" | grep -q "http-server"; then
            SERVICE_TYPE="http-server"
        elif echo "$PROCESS_CMD" | grep -q "python.*http.server"; then
            SERVICE_TYPE="python-http-server"
        fi
    elif [ -n "$PORT" ]; then
        # 根据端口推断服务类型
        case "$PORT" in
            3000|3001) SERVICE_TYPE="nodejs" ;;
            8080|8081) SERVICE_TYPE="nginx" ;;
        esac
    fi
fi

if [ -z "$LOG_FILE" ] && [ -n "$PORT" ] && [ -n "$SERVICE_TYPE" ]; then
    LOG_FILE=$(find_log_file "$PORT" "$SERVICE_TYPE")
fi

if [ -z "$PID_FILE" ] && [ -n "$PORT" ]; then
    case $PORT in
        3000) PID_FILE="pids/website-backend.pid" ;;
        3001) PID_FILE="pids/admin-backend.pid" ;;
        8080) PID_FILE="pids/website-frontend.pid" ;;
        8081) PID_FILE="pids/admin-frontend.pid" ;;
    esac
fi

echo ""
echo "诊断配置:"
echo "  PID: ${PID:-未找到}"
echo "  端口: ${PORT:-未指定}"
echo "  服务类型: ${SERVICE_TYPE:-未识别}"
echo "  日志文件: ${LOG_FILE:-未找到}"
echo "  PID文件: ${PID_FILE:-未找到}"
echo ""

# 如果既没有PID也没有端口，退出
if [ -z "$PID" ] && [ -z "$PORT" ]; then
    echo -e "${RED}错误: 无法确定PID或端口，请手动指定${NC}"
    exit 1
fi

# ==================== 诊断项 ====================

# 【1】检查进程状态
echo -e "${BLUE}【1】检查进程状态${NC}"
if [ -n "$PID" ] && ps -p $PID > /dev/null 2>&1; then
    echo -e "${GREEN}✓ 进程 $PID 存在${NC}"
    ps -p $PID -o pid,ppid,user,cmd,%mem,%cpu,stat,etime,start
    PROCESS_CMD=$(ps -p $PID -o cmd= 2>/dev/null)
    
    # 判断服务类型（如果还未识别）
    if [ -z "$SERVICE_TYPE" ]; then
        if echo "$PROCESS_CMD" | grep -q "nginx"; then
            SERVICE_TYPE="nginx"
            echo -e "${GREEN}  服务类型: Nginx${NC}"
        elif echo "$PROCESS_CMD" | grep -q "http-server"; then
            SERVICE_TYPE="http-server"
            echo -e "${YELLOW}  服务类型: http-server (Node.js)${NC}"
        elif echo "$PROCESS_CMD" | grep -q "python.*http.server"; then
            SERVICE_TYPE="python-http-server"
            echo -e "${YELLOW}  服务类型: Python http.server (已弃用)${NC}"
        elif echo "$PROCESS_CMD" | grep -q "node.*server.js"; then
            SERVICE_TYPE="nodejs"
            echo -e "${GREEN}  服务类型: Node.js${NC}"
        else
            SERVICE_TYPE="unknown"
            echo -e "${YELLOW}  服务类型: 未知${NC}"
        fi
    else
        # 显示已识别的服务类型
        case "$SERVICE_TYPE" in
            nginx) echo -e "${GREEN}  服务类型: Nginx${NC}" ;;
            nodejs) echo -e "${GREEN}  服务类型: Node.js${NC}" ;;
            http-server) echo -e "${YELLOW}  服务类型: http-server (Node.js)${NC}" ;;
            python-http-server) echo -e "${YELLOW}  服务类型: Python http.server (已弃用)${NC}" ;;
            *) echo -e "${YELLOW}  服务类型: $SERVICE_TYPE${NC}" ;;
        esac
    fi
    
    # 根据服务类型更新日志文件路径
    if [ -n "$PORT" ] && [ -n "$SERVICE_TYPE" ]; then
        NEW_LOG_FILE=$(find_log_file "$PORT" "$SERVICE_TYPE")
        if [ -n "$NEW_LOG_FILE" ] && [ "$NEW_LOG_FILE" != "$LOG_FILE" ]; then
            LOG_FILE=$NEW_LOG_FILE
            echo -e "${GREEN}  已更新日志文件路径: $LOG_FILE${NC}"
        fi
    fi
else
    echo -e "${RED}✗ 进程 $PID 不存在${NC}"
    if [ -n "$PORT" ]; then
        echo "  尝试通过端口 $PORT 查找进程..."
        FOUND_PID=$(find_pid_by_port "$PORT")
        if [ -n "$FOUND_PID" ]; then
            echo -e "${GREEN}  找到进程: $FOUND_PID${NC}"
            PID=$FOUND_PID
            ps -p $PID -o pid,ppid,user,cmd,%mem,%cpu,stat,etime,start
        else
            echo -e "${RED}  端口 $PORT 上没有运行中的进程${NC}"
        fi
    fi
fi

# 【2】检查资源使用情况
if [ -n "$PID" ] && ps -p $PID > /dev/null 2>&1; then
    echo ""
    echo -e "${BLUE}【2】检查资源使用情况${NC}"
    
    FD_COUNT=$(lsof -p $PID 2>/dev/null | wc -l)
    MEM_KB=$(ps -p $PID -o rss= 2>/dev/null | tr -d ' ')
    MEM_MB=$((MEM_KB / 1024))
    CPU=$(ps -p $PID -o %cpu= 2>/dev/null | tr -d ' ')
    VSZ_KB=$(ps -p $PID -o vsz= 2>/dev/null | tr -d ' ')
    VSZ_MB=$((VSZ_KB / 1024))
    
    echo "  文件描述符数量: $FD_COUNT"
    echo "  物理内存 (RSS): ${MEM_KB} KB (${MEM_MB} MB)"
    echo "  虚拟内存 (VSZ): ${VSZ_KB} KB (${VSZ_MB} MB)"
    echo "  CPU使用率: ${CPU}%"
    
    # 检查文件描述符限制
    if [ -f "/proc/$PID/limits" ]; then
        FD_LIMIT=$(grep "open files" /proc/$PID/limits 2>/dev/null | awk '{print $4}')
        if [ -n "$FD_LIMIT" ] && [ "$FD_LIMIT" != "unlimited" ]; then
            FD_USAGE=$((FD_COUNT * 100 / FD_LIMIT))
            echo "  文件描述符限制: $FD_LIMIT (使用率: ${FD_USAGE}%)"
            if [ $FD_USAGE -gt 90 ]; then
                echo -e "${YELLOW}  ⚠ 警告: 文件描述符使用率超过90%${NC}"
            fi
        fi
    fi
    
    # 内存使用警告
    if [ $MEM_MB -gt 1024 ]; then
        echo -e "${YELLOW}  ⚠ 警告: 内存使用超过1GB${NC}"
    fi
fi

# 【3】检查网络连接
if [ -n "$PORT" ]; then
    echo ""
    echo -e "${BLUE}【3】检查网络连接 (端口 $PORT)${NC}"
    
    CONN_COUNT=$(netstat -anp 2>/dev/null | grep ":$PORT" | wc -l)
    echo "  总连接数: $CONN_COUNT"
    
    if [ $CONN_COUNT -gt 0 ]; then
        echo ""
        echo "  连接状态分布:"
        netstat -anp 2>/dev/null | grep ":$PORT" | awk '{print $6}' | sort | uniq -c | while read count state; do
            echo "    $state: $count"
        done
        
        # 检查CLOSE_WAIT连接
        CLOSE_WAIT_COUNT=$(netstat -anp 2>/dev/null | grep ":$PORT" | grep CLOSE_WAIT | wc -l)
        if [ $CLOSE_WAIT_COUNT -gt 0 ]; then
            echo -e "${YELLOW}  ⚠ 警告: 发现 $CLOSE_WAIT_COUNT 个 CLOSE_WAIT 连接${NC}"
            echo "    这些连接可能占用资源，建议重启服务"
        fi
        
        # 检查ESTABLISHED连接
        ESTABLISHED_COUNT=$(netstat -anp 2>/dev/null | grep ":$PORT" | grep ESTABLISHED | wc -l)
        echo "  活跃连接 (ESTABLISHED): $ESTABLISHED_COUNT"
        
        # 显示最近的连接（最多5个）
        echo ""
        echo "  最近的连接 (最多5个):"
        netstat -anp 2>/dev/null | grep ":$PORT" | head -5 | while read line; do
            echo "    $line"
        done
    else
        echo -e "${YELLOW}  ⚠ 端口 $PORT 上没有连接${NC}"
    fi
    
    # 检查端口监听状态
    if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null 2>&1 || netstat -tuln 2>/dev/null | grep -q ":$PORT "; then
        echo -e "${GREEN}  ✓ 端口 $PORT 正在监听${NC}"
    else
        echo -e "${RED}  ✗ 端口 $PORT 未监听${NC}"
    fi
fi

# 【4】检查日志文件
echo ""
echo -e "${BLUE}【4】检查日志文件${NC}"

# 对于 Nginx 服务，检查多个日志文件
if [ "$SERVICE_TYPE" = "nginx" ]; then
    # 根据端口选择对应的日志文件
    if [ "$PORT" = "8080" ]; then
        NGINX_ACCESS_LOG="/var/log/nginx/website-frontend-access.log"
        NGINX_ERROR_LOG="/var/log/nginx/website-frontend-error.log"
    elif [ "$PORT" = "8081" ]; then
        NGINX_ACCESS_LOG="/var/log/nginx/admin-frontend-access.log"
        NGINX_ERROR_LOG="/var/log/nginx/admin-frontend-error.log"
    else
        # 默认使用通用日志
        NGINX_ACCESS_LOG="/var/log/nginx/access.log"
        NGINX_ERROR_LOG="/var/log/nginx/error.log"
    fi
    
    # 如果专用日志不存在，回退到通用日志
    if [ ! -f "$NGINX_ACCESS_LOG" ]; then
        NGINX_ACCESS_LOG="/var/log/nginx/access.log"
    fi
    if [ ! -f "$NGINX_ERROR_LOG" ]; then
        NGINX_ERROR_LOG="/var/log/nginx/error.log"
    fi
    
    echo "  Nginx 访问日志: $NGINX_ACCESS_LOG"
    if [ -f "$NGINX_ACCESS_LOG" ]; then
        LOG_SIZE=$(ls -lh "$NGINX_ACCESS_LOG" 2>/dev/null | awk '{print $5}')
        LOG_LINES=$(wc -l < "$NGINX_ACCESS_LOG" 2>/dev/null)
        echo -e "    ${GREEN}✓ 存在${NC} - 大小: $LOG_SIZE, 行数: $LOG_LINES"
        
        # 显示该端口的最近访问
        if [ -n "$PORT" ]; then
            echo "    端口 $PORT 的最近访问:"
            grep ":$PORT " "$NGINX_ACCESS_LOG" 2>/dev/null | tail -5 | while read line; do
                echo "      $line"
            done
        fi
    else
        echo -e "    ${RED}✗ 不存在${NC}"
    fi
    
    echo ""
    echo "  Nginx 错误日志: $NGINX_ERROR_LOG"
    if [ -f "$NGINX_ERROR_LOG" ]; then
        LOG_SIZE=$(ls -lh "$NGINX_ERROR_LOG" 2>/dev/null | awk '{print $5}')
        LOG_LINES=$(wc -l < "$NGINX_ERROR_LOG" 2>/dev/null)
        echo -e "    ${GREEN}✓ 存在${NC} - 大小: $LOG_SIZE, 行数: $LOG_LINES"
        
        # 显示最近的错误
        ERROR_COUNT=$(grep -i "error\|warn" "$NGINX_ERROR_LOG" 2>/dev/null | wc -l)
        if [ $ERROR_COUNT -gt 0 ]; then
            echo -e "    ${YELLOW}⚠ 发现 $ERROR_COUNT 个错误/警告${NC}"
            echo "    最近的错误:"
            grep -i "error\|warn" "$NGINX_ERROR_LOG" 2>/dev/null | tail -3 | while read line; do
                echo -e "      ${RED}$line${NC}"
            done
        fi
    else
        echo -e "    ${RED}✗ 不存在${NC}"
    fi
    
    # 使用错误日志作为主要日志文件（用于后续分析）
    if [ -f "$NGINX_ERROR_LOG" ]; then
        LOG_FILE=$NGINX_ERROR_LOG
    elif [ -f "$NGINX_ACCESS_LOG" ]; then
        LOG_FILE=$NGINX_ACCESS_LOG
    fi
elif [ -n "$LOG_FILE" ] && [ -f "$LOG_FILE" ]; then
    # 其他服务的日志文件检查
    LOG_SIZE=$(ls -lh "$LOG_FILE" 2>/dev/null | awk '{print $5}')
    LOG_SIZE_BYTES=$(stat -f%z "$LOG_FILE" 2>/dev/null || stat -c%s "$LOG_FILE" 2>/dev/null)
    LOG_LINES=$(wc -l < "$LOG_FILE" 2>/dev/null)
    LOG_MODIFY_TIME=$(stat -f%Sm "$LOG_FILE" 2>/dev/null || stat -c%y "$LOG_FILE" 2>/dev/null | cut -d'.' -f1)
    
    echo "  文件路径: $LOG_FILE"
    echo "  文件大小: $LOG_SIZE ($(($LOG_SIZE_BYTES / 1024 / 1024)) MB)"
    echo "  行数: $LOG_LINES"
    echo "  最后修改: $LOG_MODIFY_TIME"
    
    # 检查是否有写入权限
    if [ -w "$LOG_FILE" ]; then
        echo -e "${GREEN}  ✓ 日志文件可写${NC}"
    else
        echo -e "${YELLOW}  ⚠ 日志文件不可写（可能是只读或需要权限）${NC}"
    fi
    
    # 显示最后10条日志
    echo ""
    echo "  最后10条日志:"
    tail -n 10 "$LOG_FILE" 2>/dev/null | while read line; do
        echo "    $line"
    done
    
    # 检查最近的错误
    ERROR_COUNT=$(grep -i "error\|exception\|traceback\|failed" "$LOG_FILE" 2>/dev/null | wc -l)
    if [ $ERROR_COUNT -gt 0 ]; then
        echo ""
        echo -e "${YELLOW}  发现 $ERROR_COUNT 条错误/异常记录${NC}"
        echo "  最近的错误 (最多3条):"
        grep -i "error\|exception\|traceback\|failed" "$LOG_FILE" 2>/dev/null | tail -3 | while read line; do
            echo -e "    ${RED}$line${NC}"
        done
    fi
    
    # 统计最近1小时的访问量
    if command -v date &> /dev/null; then
        ONE_HOUR_AGO=$(date -d '1 hour ago' '+%d/%b/%Y:%H' 2>/dev/null || date -v-1H '+%d/%b/%Y:%H' 2>/dev/null || echo "")
        if [ -n "$ONE_HOUR_AGO" ]; then
            RECENT_ACCESS=$(grep "$ONE_HOUR_AGO" "$LOG_FILE" 2>/dev/null | wc -l)
            echo "  最近1小时访问量: $RECENT_ACCESS"
        fi
    fi
else
    echo -e "${YELLOW}  ⚠ 日志文件不存在或未指定: ${LOG_FILE:-未指定}${NC}"
    if [ -n "$SERVICE_TYPE" ]; then
        echo "  服务类型: $SERVICE_TYPE"
        echo "  提示:"
        case "$SERVICE_TYPE" in
            nginx)
                echo "    - Nginx 日志通常在: /var/log/nginx/access.log 和 /var/log/nginx/error.log"
                echo "    - 需要 root 权限查看系统日志"
                ;;
            nodejs)
                echo "    - Node.js 日志通常在: logs/website-backend.log 或 logs/admin-backend.log"
                ;;
        esac
    fi
fi

# 【5】检查PID文件
if [ -n "$PID_FILE" ]; then
    echo ""
    echo -e "${BLUE}【5】检查PID文件${NC}"
    if [ -f "$PID_FILE" ]; then
        FILE_PID=$(cat "$PID_FILE" 2>/dev/null)
        echo "  PID文件路径: $PID_FILE"
        echo "  文件中的PID: $FILE_PID"
        
        if [ -n "$PID" ] && [ "$FILE_PID" = "$PID" ]; then
            echo -e "${GREEN}  ✓ PID文件与进程匹配${NC}"
        elif [ -n "$FILE_PID" ] && ps -p $FILE_PID > /dev/null 2>&1; then
            echo -e "${YELLOW}  ⚠ PID文件中的进程存在，但与当前PID不同${NC}"
        else
            echo -e "${RED}  ✗ PID文件中的进程不存在${NC}"
        fi
    else
        echo -e "${YELLOW}  ⚠ PID文件不存在: $PID_FILE${NC}"
        
        # 对于 Nginx 服务，尝试从 systemd 获取 PID
        if [ -n "$PORT" ] && [ "$PORT" = "8080" ] || [ "$PORT" = "8081" ]; then
            echo "  这是 Nginx 服务，尝试从 systemd 获取 PID..."
            if systemctl is-active --quiet nginx 2>/dev/null; then
                SYSTEMD_PID=$(systemctl show nginx --property MainPID --value 2>/dev/null)
                if [ -n "$SYSTEMD_PID" ]; then
                    echo -e "${GREEN}  ✓ 从 systemd 获取到 Nginx PID: $SYSTEMD_PID${NC}"
                    echo "  注意: Nginx 是系统服务，PID 由 systemd 管理"
                fi
            fi
        fi
    fi
fi

# 【6】检查系统资源
echo ""
echo -e "${BLUE}【6】检查系统资源${NC}"

# 磁盘空间
DISK_USAGE=$(df -h . | tail -1 | awk '{print $5}' | sed 's/%//')
echo "  当前目录磁盘使用率: ${DISK_USAGE}%"
if [ $DISK_USAGE -gt 90 ]; then
    echo -e "${RED}  ⚠ 警告: 磁盘空间不足（使用率>90%）${NC}"
elif [ $DISK_USAGE -gt 80 ]; then
    echo -e "${YELLOW}  ⚠ 警告: 磁盘空间紧张（使用率>80%）${NC}"
fi

# 系统负载
if [ -f /proc/loadavg ]; then
    LOAD_AVG=$(cat /proc/loadavg | awk '{print $1}')
    CPU_CORES=$(nproc 2>/dev/null || echo "1")
    LOAD_RATIO=$(echo "scale=2; $LOAD_AVG / $CPU_CORES" | bc 2>/dev/null || echo "1")
    echo "  系统负载: $LOAD_AVG (CPU核心数: $CPU_CORES)"
    if (( $(echo "$LOAD_RATIO > 2.0" | bc -l 2>/dev/null || echo "0") )); then
        echo -e "${RED}  ⚠ 警告: 系统负载过高${NC}"
    fi
fi

# 内存使用
if command -v free &> /dev/null; then
    MEM_INFO=$(free -m | grep Mem)
    MEM_TOTAL=$(echo $MEM_INFO | awk '{print $2}')
    MEM_USED=$(echo $MEM_INFO | awk '{print $3}')
    MEM_FREE=$(echo $MEM_INFO | awk '{print $4}')
    MEM_USAGE=$((MEM_USED * 100 / MEM_TOTAL))
    echo "  系统内存: 总计 ${MEM_TOTAL}MB, 已用 ${MEM_USED}MB, 空闲 ${MEM_FREE}MB (使用率: ${MEM_USAGE}%)"
    if [ $MEM_USAGE -gt 90 ]; then
        echo -e "${RED}  ⚠ 警告: 系统内存使用率超过90%${NC}"
    fi
fi

# 【7】测试服务响应
if [ -n "$PORT" ]; then
    echo ""
    echo -e "${BLUE}【7】测试服务响应${NC}"
    echo "  尝试连接 http://localhost:$PORT/ ..."
    
    RESPONSE_TIME=$(timeout 5 curl -s -o /dev/null -w "%{time_total}" http://localhost:$PORT/ 2>/dev/null)
    HTTP_CODE=$(timeout 5 curl -s -o /dev/null -w "%{http_code}" http://localhost:$PORT/ 2>/dev/null)
    
    if [ $? -eq 0 ] && [ -n "$RESPONSE_TIME" ]; then
        echo -e "${GREEN}  ✓ 服务可以响应${NC}"
        echo "    响应时间: ${RESPONSE_TIME}秒"
        echo "    HTTP状态码: $HTTP_CODE"
    else
        echo -e "${RED}  ✗ 服务无法响应或超时${NC}"
        echo "  尝试使用TCP连接测试..."
        timeout 2 bash -c "echo > /dev/tcp/localhost/$PORT" 2>/dev/null
        if [ $? -eq 0 ]; then
            echo -e "${YELLOW}  ✓ 端口可以连接（TCP层面正常）${NC}"
            echo -e "${YELLOW}  ✗ 但HTTP请求无响应（可能是应用层问题）${NC}"
        else
            echo -e "${RED}  ✗ 端口无法连接${NC}"
        fi
    fi
fi

# 【8】检查防火墙状态
echo ""
echo -e "${BLUE}【8】检查防火墙状态${NC}"
if command -v firewall-cmd &> /dev/null; then
    if firewall-cmd --state &>/dev/null; then
        FIREWALL_STATUS="运行中"
        if firewall-cmd --query-port=$PORT/tcp &>/dev/null; then
            echo -e "${GREEN}  ✓ 防火墙运行中，端口 $PORT 已开放${NC}"
        else
            echo -e "${YELLOW}  ⚠ 防火墙运行中，但端口 $PORT 可能未开放${NC}"
        fi
    else
        echo "  防火墙未运行 (firewalld)"
    fi
elif command -v ufw &> /dev/null; then
    UFW_STATUS=$(ufw status 2>/dev/null | head -1)
    echo "  防火墙状态: $UFW_STATUS"
    if echo "$UFW_STATUS" | grep -q "active"; then
        if ufw status | grep -q "$PORT/tcp"; then
            echo -e "${GREEN}  ✓ 端口 $PORT 在防火墙规则中${NC}"
        else
            echo -e "${YELLOW}  ⚠ 端口 $PORT 可能未在防火墙规则中${NC}"
        fi
    fi
else
    echo "  未检测到常见防火墙工具"
fi

# 【9】检查进程线程状态
if [ -n "$PID" ] && ps -p $PID > /dev/null 2>&1; then
    echo ""
    echo -e "${BLUE}【9】检查进程线程状态${NC}"
    THREAD_COUNT=$(ps -T -p $PID 2>/dev/null | wc -l)
    echo "  线程数: $((THREAD_COUNT - 1))"  # 减去标题行
    
    # 显示线程详情（如果有）
    if [ $THREAD_COUNT -gt 2 ]; then
        echo "  线程详情:"
        ps -T -p $PID -o tid,state,%cpu,%mem,etime 2>/dev/null | tail -n +2 | head -5
    fi
fi

# 【10】生成诊断建议
echo ""
echo "=========================================="
echo -e "${BLUE}诊断建议${NC}"
echo "=========================================="

SUGGESTIONS=()

if [ -n "$PID" ] && ! ps -p $PID > /dev/null 2>&1; then
    SUGGESTIONS+=("进程不存在，需要重启服务")
fi

if [ -n "$PORT" ] && ! lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
    SUGGESTIONS+=("端口未监听，需要重启服务")
fi

if [ -n "$CLOSE_WAIT_COUNT" ] && [ $CLOSE_WAIT_COUNT -gt 10 ]; then
    SUGGESTIONS+=("CLOSE_WAIT连接过多，建议重启服务清理连接")
fi

if [ -n "$FD_USAGE" ] && [ $FD_USAGE -gt 90 ]; then
    SUGGESTIONS+=("文件描述符使用率过高，考虑重启服务")
fi

if [ -n "$DISK_USAGE" ] && [ $DISK_USAGE -gt 90 ]; then
    SUGGESTIONS+=("磁盘空间不足，需要清理日志或文件")
fi

if [ "$SERVICE_TYPE" = "python-http-server" ]; then
    SUGGESTIONS+=("使用Python http.server，建议迁移到http-server以获得更好的性能")
fi

if [ ${#SUGGESTIONS[@]} -eq 0 ]; then
    echo -e "${GREEN}✓ 未发现明显问题${NC}"
else
    for i in "${!SUGGESTIONS[@]}"; do
        echo "$((i+1)). ${SUGGESTIONS[$i]}"
    done
fi

echo ""
echo "=========================================="
echo "诊断完成"
echo "=========================================="
