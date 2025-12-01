# Nginx 部署与配置指南

## 概述

本文档介绍如何安装、配置和使用 Nginx 作为前端服务的 Web 服务器，替代 Python `http.server` 和 Node.js `http-server`，提供生产级的性能和稳定性。

## 目录

1. [安装 Nginx](#安装-nginx)
2. [配置 Nginx](#配置-nginx)
3. [服务管理](#服务管理)
4. [常见问题](#常见问题)
5. [故障排查](#故障排查)

---

## 安装 Nginx

### 快速安装（推荐）

使用自动安装脚本：

```bash
chmod +x 安装nginx.sh
sudo ./安装nginx.sh
```

脚本会自动：
- 检测系统类型（CentOS/Ubuntu）
- 尝试多种安装方法（EPEL、官方仓库等）
- 处理 Alibaba Cloud Linux 等特殊系统
- 启动并启用 Nginx 服务

### 手动安装

#### CentOS/RHEL

```bash
# 方法1: 从 EPEL 仓库安装（推荐）
sudo yum install -y epel-release
sudo yum install -y nginx

# 方法2: 从 Nginx 官方仓库安装
sudo tee /etc/yum.repos.d/nginx.repo > /dev/null <<EOF
[nginx-stable]
name=nginx stable repo
baseurl=http://nginx.org/packages/centos/8/x86_64/
gpgcheck=1
enabled=1
gpgkey=https://nginx.org/keys/nginx_signing.key
module_hotfixes=true
EOF

sudo rpm --import https://nginx.org/keys/nginx_signing.key
sudo yum install -y nginx
```

#### Ubuntu/Debian

```bash
sudo apt-get update
sudo apt-get install -y nginx
```

### 验证安装

```bash
# 检查版本
nginx -v

# 检查状态
sudo systemctl status nginx

# 检查端口
sudo netstat -tulnp | grep nginx
```

### 常见安装问题

#### 问题1: "Unable to find a match: nginx"

**原因**: CentOS 默认仓库没有 Nginx

**解决**: 
```bash
# 安装 EPEL 仓库
sudo yum install -y epel-release
sudo yum install -y nginx
```

#### 问题2: "All matches were filtered out by exclude filtering"

**原因**: yum 有排除规则

**解决**:
```bash
sudo yum install -y nginx --disableexcludes=all
```

#### 问题3: Alibaba Cloud Linux 3 仓库错误

**原因**: `$releasever` 变量解析为 3，但 Nginx 仓库没有 CentOS 3

**解决**: 使用安装脚本，会自动识别并修复

---

## 配置 Nginx

### 快速配置（推荐）

使用自动配置脚本：

```bash
chmod +x 配置nginx.sh
sudo ./配置nginx.sh
```

脚本会：
- 检查 Nginx 是否安装
- 复制配置文件到 `/etc/nginx/conf.d/shenyunmuye.conf`
- 自动检测项目路径
- 测试配置语法
- 启动/重载 Nginx

### 配置文件位置

- **主配置**: `/etc/nginx/conf.d/shenyunmuye.conf`
- **访问日志**: `/var/log/nginx/access.log`
- **错误日志**: `/var/log/nginx/error.log`

### 服务端口

- **前端网站**: 8080
- **管理后台**: 8081

### 手动配置

如果自动配置失败，可以手动配置：

```bash
# 1. 复制配置文件
sudo cp nginx完整配置.conf /etc/nginx/conf.d/shenyunmuye.conf

# 2. 编辑配置文件，修改路径
sudo nano /etc/nginx/conf.d/shenyunmuye.conf

# 3. 测试配置
sudo nginx -t

# 4. 重载配置
sudo systemctl reload nginx
```

### 配置说明

配置文件包含两个 `server` 块：

1. **端口 8080** - 前端网站
   - `root`: `/root/shenyunmuye-website`
   - `index`: `index.html`

2. **端口 8081** - 管理后台
   - `root`: `/root/shenyunmuye-admin-frontend`
   - `index`: `login.html`

### 权限配置

由于项目在 `/root` 目录下，Nginx 需要以 `root` 用户运行：

```bash
# 修改 Nginx 用户为 root
sudo sed -i 's/^user .*/user root;/' /etc/nginx/nginx.conf

# 重启 Nginx
sudo systemctl restart nginx
```

**注意**: 使用 root 用户运行 Nginx 有安全风险，但在需要访问 `/root` 目录的场景下是必要的。

---

## 服务管理

### 启动服务

使用启动脚本（推荐）：

```bash
./启动所有服务.sh
```

启动脚本会自动：
- 检查 Nginx 是否安装
- 检查配置文件
- 测试配置语法
- 启动或重载 Nginx
- 验证端口监听

### 停止服务

```bash
# 停止所有服务（包括后端）
./停止所有服务.sh

# 仅停止 Nginx
sudo systemctl stop nginx
```

### 重启服务

```bash
# 重启 Nginx
sudo systemctl restart nginx

# 重载配置（不中断服务）
sudo systemctl reload nginx
# 或
sudo nginx -s reload
```

### 查看状态

```bash
# 查看服务状态
sudo systemctl status nginx

# 查看进程
ps aux | grep nginx

# 查看端口监听
sudo netstat -tulnp | grep nginx
```

### PID 管理

Nginx 是系统服务，PID 由 systemd 管理：

```bash
# 从 systemd 获取 PID
systemctl show nginx --property MainPID --value

# 从进程查找
pgrep -f "nginx: master process"

# 从端口查找
lsof -ti tcp:8080
```

启动脚本会在 `pids/` 目录下创建辅助 PID 文件，用于停止脚本。

---

## 常见问题

### 问题1: 404 Not Found

**可能原因**:
1. 配置文件中的 `root` 路径不正确
2. Nginx 用户没有权限访问文件
3. 文件不存在

**排查步骤**:
```bash
# 1. 检查配置文件路径
sudo grep "root" /etc/nginx/conf.d/shenyunmuye.conf

# 2. 检查文件是否存在
ls -la /root/shenyunmuye-website/index.html
ls -la /root/shenyunmuye-admin-frontend/login.html

# 3. 检查 Nginx 用户
sudo grep "^user" /etc/nginx/nginx.conf

# 4. 查看错误日志
sudo tail -50 /var/log/nginx/error.log
```

**解决方法**:
```bash
# 使用诊断脚本
sudo ./诊断nginx.sh

# 或使用修复脚本
sudo ./配置nginx.sh
```

### 问题2: 权限被拒绝

**原因**: Nginx 用户（默认 `nginx`）无法访问 `/root` 目录

**解决**: 修改 Nginx 用户为 `root`（见[权限配置](#权限配置)）

### 问题3: 配置语法错误

**排查**:
```bash
# 测试配置
sudo nginx -t

# 查看详细错误
sudo nginx -T 2>&1 | grep error
```

### 问题4: 端口被占用

**排查**:
```bash
# 查看端口占用
sudo lsof -i :8080
sudo lsof -i :8081

# 停止占用端口的进程
sudo kill -9 <PID>
```

---

## 故障排查

### 诊断工具

使用诊断脚本进行完整诊断：

```bash
sudo ./诊断nginx.sh
```

诊断脚本会检查：
- 配置文件语法
- 文件路径和权限
- Nginx 进程状态
- 端口监听状态
- 错误日志
- 访问日志

### 日志查看

```bash
# 查看错误日志
sudo tail -f /var/log/nginx/error.log

# 查看访问日志
sudo tail -f /var/log/nginx/access.log

# 查看特定端口的访问
sudo grep ":8080" /var/log/nginx/access.log | tail -20
```

### 手动测试

```bash
# 测试配置
sudo nginx -t

# 测试访问
curl http://localhost:8080/
curl http://localhost:8081/

# 测试文件读取
sudo -u root cat /root/shenyunmuye-website/index.html
```

### 常见错误

1. **"Permission denied"**: Nginx 用户无权限访问文件
2. **"No such file or directory"**: 文件路径不正确
3. **"Address already in use"**: 端口被占用
4. **"Connection refused"**: Nginx 未启动或配置错误

---

## 相关文件

- `安装nginx.sh` - Nginx 安装脚本
- `配置nginx.sh` - Nginx 配置脚本
- `诊断nginx.sh` - Nginx 诊断脚本
- `nginx完整配置.conf` - Nginx 配置文件模板
- `启动所有服务.sh` - 启动所有服务（包括 Nginx）
- `停止所有服务.sh` - 停止所有服务

---

## 总结

✅ **安装**: 使用 `安装nginx.sh` 自动安装  
✅ **配置**: 使用 `配置nginx.sh` 自动配置  
✅ **管理**: 使用 `启动所有服务.sh` 和 `停止所有服务.sh`  
✅ **诊断**: 使用 `诊断nginx.sh` 排查问题  

现在 Nginx 已经配置完成，可以正常提供服务了！

