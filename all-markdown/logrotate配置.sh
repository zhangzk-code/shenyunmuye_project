#!/bin/bash
# 配置日志轮转 - 包含 Nginx 日志和项目日志

# 获取脚本所在目录
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
LOG_DIR="$SCRIPT_DIR/logs"

echo "=========================================="
echo "配置日志轮转"
echo "=========================================="
echo

# 检查是否以root运行
if [ "$EUID" -ne 0 ]; then 
    echo "警告: 需要root权限来配置logrotate"
    echo "请使用: sudo $0"
    exit 1
fi

# 创建logrotate配置文件
LOGROTATE_CONF="/etc/logrotate.d/shenyunmuye"

cat > "$LOGROTATE_CONF" <<'EOF'
# 申允木业项目日志轮转配置

# ==================== Nginx 日志 ====================
# Nginx 访问日志和错误日志
/var/log/nginx/*.log {
    # 每天轮转
    daily
    # 保留7天的日志
    rotate 7
    # 压缩旧日志
    compress
    # 延迟压缩（不压缩当天的日志）
    delaycompress
    # 如果日志文件不存在，不报错
    missingok
    # 如果日志文件为空，不轮转
    notifempty
    # 创建新日志文件的权限和所有者
    create 0644 root root
    # 共享脚本（所有匹配的日志文件轮转后只执行一次脚本）
    sharedscripts
    # 轮转后执行的脚本（通知 Nginx 重新打开日志文件）
    postrotate
        # 如果 Nginx 正在运行，发送 USR1 信号重新打开日志文件
        if [ -f /var/run/nginx.pid ]; then
            kill -USR1 `cat /var/run/nginx.pid` 2>/dev/null || true
        fi
    endscript
}

# ==================== 项目日志 ====================
# 项目 logs 目录下的日志（如果存在）
/root/shenyunmuye_project/logs/*.log {
    # 每天轮转
    daily
    # 保留7天的日志
    rotate 7
    # 压缩旧日志
    compress
    # 延迟压缩（不压缩当天的日志）
    delaycompress
    # 如果日志文件不存在，不报错
    missingok
    # 如果日志文件为空，不轮转
    notifempty
    # 创建新日志文件的权限和所有者
    create 0644 root root
    # 共享脚本
    sharedscripts
    # 轮转后执行的脚本（如果需要重启服务，取消注释）
    postrotate
        # 如果需要重启服务，取消下面的注释
        # /root/shenyunmuye_project/停止所有服务.sh
        # /root/shenyunmuye_project/启动所有服务.sh prod
    endscript
}
EOF

# 替换路径占位符（如果项目路径不同）
if [ -n "$SCRIPT_DIR" ] && [ "$SCRIPT_DIR" != "/root/shenyunmuye_project" ]; then
    sed -i "s|/root/shenyunmuye_project|$SCRIPT_DIR|g" "$LOGROTATE_CONF"
fi

echo "✓ Logrotate配置文件已创建: $LOGROTATE_CONF"
echo
echo "配置内容:"
cat "$LOGROTATE_CONF"
echo
echo "=========================================="
echo "配置完成"
echo "=========================================="
echo

# 检查日志文件
echo "检查日志文件:"
echo "  Nginx 日志:"
ls -lh /var/log/nginx/*.log 2>/dev/null | head -10 || echo "    未找到 Nginx 日志文件"

echo
echo "  项目日志:"
if [ -d "$LOG_DIR" ]; then
    ls -lh "$LOG_DIR"/*.log 2>/dev/null | head -10 || echo "    未找到项目日志文件"
else
    echo "    日志目录不存在: $LOG_DIR"
fi

echo
echo "测试配置:"
echo "  sudo logrotate -d $LOGROTATE_CONF"
echo
echo "手动执行轮转:"
echo "  sudo logrotate -f $LOGROTATE_CONF"
echo
echo "查看logrotate状态:"
echo "  cat /var/lib/logrotate/status | grep shenyunmuye"
echo
echo "查看 Nginx 日志文件:"
echo "  ls -lh /var/log/nginx/"

