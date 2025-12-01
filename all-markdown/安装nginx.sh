#!/bin/bash
# Nginx 安装脚本 - 整合所有安装方法，支持 CentOS/Ubuntu/Alibaba Cloud Linux

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

echo "=========================================="
echo "安装 Nginx"
echo "=========================================="
echo

# 检测系统类型
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$ID
    VER=$VERSION_ID
    echo "检测到系统: $OS $VER"
else
    echo -e "${RED}无法检测系统版本${NC}"
    exit 1
fi

# 检测架构
ARCH=$(uname -m)
[ "$ARCH" = "x86_64" ] || ARCH="x86_64"

echo "架构: $ARCH"
echo

# Ubuntu/Debian 安装
if command -v apt-get &> /dev/null; then
    echo -e "${BLUE}检测到 Ubuntu/Debian 系统${NC}"
    apt-get update
    apt-get install -y nginx
    if [ $? -eq 0 ]; then
        systemctl start nginx
        systemctl enable nginx
        echo -e "${GREEN}✓ Nginx 安装成功！${NC}"
        nginx -v
        exit 0
    fi
fi

# CentOS/RHEL/Alibaba Cloud Linux 安装
echo "尝试安装 Nginx..."
echo

# 检查排除规则
EXCLUDE_RULES=$(grep "^exclude" /etc/yum.conf 2>/dev/null || echo "")
if [ -n "$EXCLUDE_RULES" ]; then
    echo -e "${YELLOW}发现 yum 排除规则，可能需要使用 --disableexcludes=all${NC}"
fi

# 方法1: 尝试从 EPEL 仓库安装
echo -e "${BLUE}方法1: 从 EPEL 仓库安装${NC}"
if ! rpm -q epel-release &>/dev/null; then
    echo "安装 EPEL 仓库..."
    yum install -y epel-release
    if [ $? -ne 0 ]; then
        echo -e "${YELLOW}EPEL 仓库安装失败，尝试其他方法...${NC}"
    else
        echo -e "${GREEN}✓ EPEL 仓库已安装${NC}"
        yum clean all
        yum makecache
    fi
fi

# 尝试安装 Nginx
if [ -n "$EXCLUDE_RULES" ]; then
    yum install -y nginx --disableexcludes=all
else
    yum install -y nginx
fi

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Nginx 安装成功！${NC}"
    
    # 启动 Nginx
    systemctl start nginx
    systemctl enable nginx
    
    echo
    echo "Nginx 状态:"
    systemctl status nginx --no-pager -l
    
    echo
    echo "=========================================="
    echo "安装完成"
    echo "=========================================="
    echo
    echo "Nginx 版本:"
    nginx -v
    echo
    echo "下一步: 运行配置脚本"
    echo "  sudo ./配置nginx.sh"
    exit 0
fi

# 方法2: 从 Nginx 官方仓库安装
echo
echo -e "${BLUE}方法2: 从 Nginx 官方仓库安装${NC}"

# 检测系统版本和架构
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$ID
    VER=$VERSION_ID
else
    echo -e "${RED}无法检测系统版本${NC}"
    exit 1
fi

# 检测架构
ARCH=$(uname -m)
if [ "$ARCH" = "x86_64" ]; then
    ARCH="x86_64"
elif [ "$ARCH" = "aarch64" ]; then
    ARCH="aarch64"
else
    ARCH="x86_64"
fi

echo "系统: $OS $VER, 架构: $ARCH"

# 确定 CentOS 版本号
CENTOS_VER=""

# 检查是否是 Alibaba Cloud Linux
if [[ "$OS" == "alinux" ]] || grep -qi "alinux" /etc/os-release 2>/dev/null; then
    # Alibaba Cloud Linux 3 基于 CentOS 8
    if [[ "$VER" == "3"* ]] || grep -q "Alibaba Cloud Linux 3" /etc/os-release 2>/dev/null; then
        CENTOS_VER="8"
    elif [[ "$VER" == "2"* ]]; then
        CENTOS_VER="7"
    else
        CENTOS_VER="8"
    fi
elif [[ "$OS" == "centos" ]] || [[ "$OS" == "rhel" ]]; then
    # 从 /etc/redhat-release 获取版本
    if [ -f /etc/redhat-release ]; then
        if grep -q "CentOS Linux 7" /etc/redhat-release; then
            CENTOS_VER="7"
        elif grep -q "CentOS Linux 8" /etc/redhat-release || grep -q "CentOS Stream 8" /etc/redhat-release; then
            CENTOS_VER="8"
        elif grep -q "CentOS Linux 9" /etc/redhat-release || grep -q "CentOS Stream 9" /etc/redhat-release; then
            CENTOS_VER="9"
        elif [[ "$VER" == "7"* ]]; then
            CENTOS_VER="7"
        elif [[ "$VER" == "8"* ]]; then
            CENTOS_VER="8"
        elif [[ "$VER" == "9"* ]]; then
            CENTOS_VER="9"
        else
            # 尝试从 VERSION_ID 获取
            CENTOS_VER=$(echo $VER | cut -d. -f1)
        fi
    else
        CENTOS_VER=$(echo $VER | cut -d. -f1)
    fi
fi

# 如果无法确定版本，使用 7（最常用）
if [ -z "$CENTOS_VER" ] || [[ ! "$CENTOS_VER" =~ ^[789]$ ]]; then
    echo -e "${YELLOW}无法确定 CentOS 版本，使用 7${NC}"
    CENTOS_VER="7"
fi

echo "使用 CentOS 版本: $CENTOS_VER"

# 创建 Nginx 仓库配置
NGINX_REPO="/etc/yum.repos.d/nginx.repo"

# 使用固定版本号而不是变量
cat > "$NGINX_REPO" <<EOF
[nginx-stable]
name=nginx stable repo
baseurl=http://nginx.org/packages/centos/${CENTOS_VER}/${ARCH}/
gpgcheck=1
enabled=1
gpgkey=https://nginx.org/keys/nginx_signing.key
module_hotfixes=true

[nginx-mainline]
name=nginx mainline repo
baseurl=http://nginx.org/packages/mainline/centos/${CENTOS_VER}/${ARCH}/
gpgcheck=1
enabled=0
gpgkey=https://nginx.org/keys/nginx_signing.key
module_hotfixes=true
EOF

echo -e "${GREEN}✓ Nginx 仓库配置已创建 (CentOS $CENTOS_VER, $ARCH)${NC}"

echo -e "${GREEN}✓ Nginx 仓库配置已创建${NC}"

# 导入 GPG 密钥（如果需要）
if grep -q "gpgcheck=1" "$NGINX_REPO"; then
    echo "导入 Nginx GPG 密钥..."
    rpm --import https://nginx.org/keys/nginx_signing.key 2>/dev/null || true
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ GPG 密钥已导入${NC}"
    fi
fi

# 清理并更新缓存
yum clean all
yum makecache

# 安装 Nginx
echo "安装 Nginx..."
if [ -n "$EXCLUDE_RULES" ]; then
    yum install -y nginx --disableexcludes=all
else
    yum install -y nginx
fi

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Nginx 安装成功！${NC}"
    
    # 启动 Nginx
    systemctl start nginx
    systemctl enable nginx
    
    echo
    echo "Nginx 状态:"
    systemctl status nginx --no-pager -l
    
    echo
    echo "=========================================="
    echo "安装完成"
    echo "=========================================="
    echo
    echo "Nginx 版本:"
    nginx -v
    echo
    echo "下一步: 运行配置脚本"
    echo "  sudo ./配置nginx.sh"
    exit 0
fi

# 方法3: 使用 dnf (CentOS 8+)
if command -v dnf &> /dev/null; then
    echo
    echo -e "${BLUE}方法3: 使用 dnf 安装${NC}"
    
    # 安装 EPEL
    dnf install -y epel-release
    
    # 安装 Nginx
    dnf install -y nginx
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Nginx 安装成功！${NC}"
        systemctl start nginx
        systemctl enable nginx
        exit 0
    fi
fi

# 如果所有方法都失败
echo
echo -e "${RED}✗ Nginx 安装失败${NC}"
echo
echo "可能的解决方案:"
echo "1. 检查网络连接"
echo "2. 手动添加仓库:"
echo "   sudo yum install -y epel-release"
echo "   sudo yum install -y nginx"
echo
echo "3. 或从源码编译安装:"
echo "   wget http://nginx.org/download/nginx-1.24.0.tar.gz"
echo "   tar -xzf nginx-1.24.0.tar.gz"
echo "   cd nginx-1.24.0"
echo "   ./configure"
echo "   make && make install"
echo
echo "4. 检查仓库配置:"
echo "   cat /etc/yum.repos.d/*.repo | grep -i nginx"
echo
exit 1

