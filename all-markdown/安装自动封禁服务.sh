#!/bin/bash
# 安装自动封禁服务（定时任务）

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

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
SCAN_SCRIPT="$SCRIPT_DIR/自动扫描并封禁恶意IP.sh"
CRON_LOG="/var/log/nginx/auto_ban_cron.log"

echo "=========================================="
echo "安装自动封禁服务"
echo "=========================================="
echo

# 检查扫描脚本是否存在
if [ ! -f "$SCAN_SCRIPT" ]; then
    echo -e "${RED}✗ 扫描脚本不存在: $SCAN_SCRIPT${NC}"
    exit 1
fi

# 赋予执行权限
chmod +x "$SCAN_SCRIPT"
echo -e "${GREEN}✓ 已设置执行权限${NC}"
echo

# 显示菜单
echo "请选择执行频率:"
echo "  1) 每5分钟执行一次（推荐）"
echo "  2) 每10分钟执行一次"
echo "  3) 每30分钟执行一次"
echo "  4) 每小时执行一次"
echo "  5) 自定义"
echo "  6) 取消"
echo

read -p "请选择 [1-6] (默认: 1): " choice
choice=${choice:-1}

case $choice in
    1)
        CRON_SCHEDULE="*/5 * * * *"
        SCHEDULE_DESC="每5分钟"
        ;;
    2)
        CRON_SCHEDULE="*/10 * * * *"
        SCHEDULE_DESC="每10分钟"
        ;;
    3)
        CRON_SCHEDULE="*/30 * * * *"
        SCHEDULE_DESC="每30分钟"
        ;;
    4)
        CRON_SCHEDULE="0 * * * *"
        SCHEDULE_DESC="每小时"
        ;;
    5)
        read -p "请输入 cron 表达式 (例如: */5 * * * *): " CRON_SCHEDULE
        if [ -z "$CRON_SCHEDULE" ]; then
            echo -e "${RED}错误: cron 表达式不能为空${NC}"
            exit 1
        fi
        SCHEDULE_DESC="自定义: $CRON_SCHEDULE"
        ;;
    6)
        echo "已取消"
        exit 0
        ;;
    *)
        echo -e "${RED}无效的选择${NC}"
        exit 1
        ;;
esac

echo
echo "执行频率: $SCHEDULE_DESC"
echo

# 检查是否已有定时任务
EXISTING_CRON=$(crontab -l 2>/dev/null | grep "$SCAN_SCRIPT")
if [ -n "$EXISTING_CRON" ]; then
    echo -e "${YELLOW}⚠ 发现已存在的定时任务:${NC}"
    echo "$EXISTING_CRON"
    echo
    read -p "是否替换现有任务? [y/N]: " replace
    replace=${replace:-N}
    
    if [[ $replace =~ ^[Yy]$ ]]; then
        # 删除现有任务
        crontab -l 2>/dev/null | grep -v "$SCAN_SCRIPT" | crontab -
        echo -e "${GREEN}✓ 已删除现有任务${NC}"
    else
        echo "已取消"
        exit 0
    fi
fi

# 添加新的定时任务
(crontab -l 2>/dev/null; echo "$CRON_SCHEDULE $SCAN_SCRIPT >> $CRON_LOG 2>&1") | crontab -

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ 定时任务已添加${NC}"
    echo
    echo "定时任务详情:"
    echo "  执行频率: $SCHEDULE_DESC"
    echo "  执行脚本: $SCAN_SCRIPT"
    echo "  日志文件: $CRON_LOG"
    echo
    echo "当前所有定时任务:"
    crontab -l | grep -E "$SCAN_SCRIPT|^#"
    echo
else
    echo -e "${RED}✗ 添加定时任务失败${NC}"
    exit 1
fi

# 测试执行一次
echo "是否现在测试执行一次? [Y/n]: "
read test_run
test_run=${test_run:-Y}

if [[ $test_run =~ ^[Yy]$ ]]; then
    echo
    echo "正在测试执行..."
    echo "----------------------------------------"
    bash "$SCAN_SCRIPT"
    echo "----------------------------------------"
    echo
    echo -e "${GREEN}✓ 测试执行完成${NC}"
    echo "查看日志: tail -f $CRON_LOG"
fi

echo
echo "=========================================="
echo "安装完成"
echo "=========================================="
echo
echo "管理命令:"
echo "  查看定时任务: crontab -l"
echo "  编辑定时任务: crontab -e"
echo "  删除定时任务: crontab -e (然后删除对应行)"
echo "  查看执行日志: tail -f $CRON_LOG"
echo "  查看封禁日志: tail -f /var/log/nginx/auto_ban.log"
echo "  手动执行扫描: sudo $SCAN_SCRIPT"
echo

