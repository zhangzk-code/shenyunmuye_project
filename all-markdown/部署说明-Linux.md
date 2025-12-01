# Linux服务器部署说明

## 服务器信息

- **IP地址**: 152.32.209.245
- **操作系统**: Linux

## 部署步骤

### 1. 上传项目文件

将整个项目上传到服务器，建议放在 `/opt/shenyunmuye` 或 `/home/用户名/shenyunmuye` 目录。

### 2. 安装依赖

```bash
# 安装Node.js (如果未安装)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 或使用yum (CentOS/RHEL)
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo yum install -y nodejs

# 安装Python3 (如果未安装)
sudo apt-get install -y python3
# 或
sudo yum install -y python3
```

### 3. 配置防火墙

```bash
# Ubuntu/Debian (ufw)
sudo ufw allow 3000/tcp
sudo ufw allow 3001/tcp
sudo ufw allow 8080/tcp
sudo ufw allow 8081/tcp
sudo ufw reload

# CentOS/RHEL (firewalld)
sudo firewall-cmd --permanent --add-port=3000/tcp
sudo firewall-cmd --permanent --add-port=3001/tcp
sudo firewall-cmd --permanent --add-port=8080/tcp
sudo firewall-cmd --permanent --add-port=8081/tcp
sudo firewall-cmd --reload
```

### 4. 启动服务

```bash
# 进入项目目录
cd /path/to/shenyunmuye_project

# 给启动脚本添加执行权限
chmod +x 启动所有服务.sh
chmod +x 停止所有服务.sh

# 生产环境启动
./启动所有服务.sh prod

# 或开发环境启动
./启动所有服务.sh
```

### 5. 验证服务

```bash
# 检查服务是否运行
curl http://localhost:3000/api/health
curl http://localhost:3001/api/admin/health

# 检查端口监听
netstat -tuln | grep -E '3000|3001|8080|8081'
```

## 使用systemd管理服务（推荐）

### 创建服务文件

创建 `/etc/systemd/system/shenyunmuye.service`:

```ini
[Unit]
Description=申允木业项目服务
After=network.target

[Service]
Type=forking
User=your_username
WorkingDirectory=/path/to/shenyunmuye_project
ExecStart=/path/to/shenyunmuye_project/启动所有服务.sh prod
ExecStop=/path/to/shenyunmuye_project/停止所有服务.sh
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

### 使用systemd

```bash
# 重新加载systemd配置
sudo systemctl daemon-reload

# 启动服务
sudo systemctl start shenyunmuye

# 设置开机自启
sudo systemctl enable shenyunmuye

# 查看状态
sudo systemctl status shenyunmuye

# 查看日志
sudo journalctl -u shenyunmuye -f
```

## 使用PM2管理Node.js服务（推荐）

### 安装PM2

```bash
sudo npm install -g pm2
```

### 创建PM2配置文件

创建 `ecosystem.config.js`:

```javascript
module.exports = {
  apps: [
    {
      name: 'website-backend',
      script: './shenyunmuye-backend/server.js',
      cwd: '/path/to/shenyunmuye_project',
      env: {
        NODE_ENV: 'production',
        WEBSITE_BACKEND_PORT: 3000,
        WEBSITE_BACKEND_HOST: '152.32.209.245'
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      error_file: './logs/website-backend-error.log',
      out_file: './logs/website-backend-out.log'
    },
    {
      name: 'admin-backend',
      script: './shenyunmuye-admin-backend/server.js',
      cwd: '/path/to/shenyunmuye_project',
      env: {
        NODE_ENV: 'production',
        ADMIN_BACKEND_PORT: 3001,
        ADMIN_BACKEND_HOST: '152.32.209.245',
        ADMIN_FRONTEND_URL: 'http://152.32.209.245:8081'
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      error_file: './logs/admin-backend-error.log',
      out_file: './logs/admin-backend-out.log'
    }
  ]
};
```

### 使用PM2

```bash
# 启动所有服务
pm2 start ecosystem.config.js

# 查看状态
pm2 status

# 查看日志
pm2 logs

# 停止服务
pm2 stop all

# 重启服务
pm2 restart all

# 设置开机自启
pm2 startup
pm2 save
```

## 使用Nginx反向代理（推荐）

### 安装Nginx

```bash
sudo apt-get install nginx
# 或
sudo yum install nginx
```

### 配置Nginx

创建 `/etc/nginx/sites-available/shenyunmuye`:

```nginx
# 前端网站
server {
    listen 80;
    server_name 152.32.209.245;
    
    location / {
        proxy_pass http://localhost:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # API代理
    location /api {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}

# 管理后台
server {
    listen 8081;
    server_name 152.32.209.245;
    
    location / {
        proxy_pass http://localhost:8081;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
    
    # API代理
    location /api/admin {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

### 启用配置

```bash
# 创建符号链接
sudo ln -s /etc/nginx/sites-available/shenyunmuye /etc/nginx/sites-enabled/

# 测试配置
sudo nginx -t

# 重启Nginx
sudo systemctl restart nginx
```

## 访问地址

- **前端网站**: http://152.32.209.245:8080
- **管理后台**: http://152.32.209.245:8081/login.html

如果使用Nginx反向代理：
- **前端网站**: http://152.32.209.245
- **管理后台**: http://152.32.209.245:8081/login.html

## 默认账户

- **用户名**: admin
- **密码**: admin123

**重要**: 生产环境请立即修改默认密码！

## 故障排查

### 检查服务状态

```bash
# 查看进程
ps aux | grep node
ps aux | grep python

# 查看端口
netstat -tuln | grep -E '3000|3001|8080|8081'

# 查看日志
tail -f logs/*.log
```

### 常见问题

1. **端口被占用**: 使用 `lsof -i :端口号` 查看占用进程
2. **权限问题**: 确保有执行权限 `chmod +x *.sh`
3. **依赖未安装**: 进入各目录运行 `npm install`
4. **防火墙阻止**: 检查防火墙规则

## 安全建议

1. 修改默认管理员密码
2. 使用HTTPS（配置SSL证书）
3. 配置防火墙规则
4. 定期备份数据文件
5. 使用反向代理隐藏真实端口
6. 配置日志轮转

