# 申允木业官方网站项目

这是一个专业的全屋定制家居官方网站项目，采用前后端分离架构，包含前端网站、后端API服务、管理后台前端和管理后台后端四个部分。

## 📦 项目结构

```
shenyunmuye_project/
├── shenyunmuye-website/         # 前端网站
│   ├── index.html
│   ├── products.html
│   ├── cases.html
│   ├── about.html
│   ├── contact.html
│   ├── service.html
│   ├── css/
│   ├── js/
│   ├── images/                  # 图片资源
│   └── README.md
│
├── shenyunmuye-backend/         # 后端API服务（前端网站）
│   ├── server.js
│   ├── package.json
│   ├── data/                   # 数据存储（自动创建）
│   ├── README.md
│   └── API.md
│
├── shenyunmuye-admin-frontend/  # 管理后台前端
│   ├── login.html              # 登录页面
│   ├── admin.html              # 管理页面
│   └── README.md
│
├── shenyunmuye-admin-backend/   # 管理后台后端
│   ├── server.js
│   ├── package.json
│   ├── data/                   # 用户和会话数据（自动创建）
│   └── README.md
│
├── 启动所有服务.bat            # Windows启动脚本
├── 启动所有服务.sh             # Linux启动脚本
├── 停止所有服务.bat            # Windows停止脚本
├── 停止所有服务.sh             # Linux停止脚本
├── 检查依赖.bat                # Windows依赖检查
├── 检查依赖.sh                 # Linux依赖检查
└── README.md                   # 本文件
```

## 🚀 快速开始

### Windows 系统

1. **检查依赖**
   ```bash
   检查依赖.bat
   ```

2. **启动所有服务**
   ```bash
   启动所有服务.bat
   ```
   生产环境：
   ```bash
   启动所有服务.bat prod
   ```

3. **访问网站**
   - 前端网站：http://localhost:8080
   - 管理后台：http://localhost:8081/login.html

### Linux 系统

1. **上传项目到服务器**
   ```bash
   scp -r shenyunmuye_project user@152.32.209.245:/opt/
   ```

2. **安装依赖**
   ```bash
   cd /opt/shenyunmuye_project
   chmod +x *.sh
   ./检查依赖.sh
   ```

3. **配置防火墙**
   ```bash
   sudo ufw allow 3000/tcp
   sudo ufw allow 3001/tcp
   sudo ufw allow 8080/tcp
   sudo ufw allow 8081/tcp
   sudo ufw reload
   ```

4. **启动服务**
   ```bash
   ./启动所有服务.sh prod
   ```

5. **访问网站**
   - 前端网站：http://152.32.209.245:8080
   - 管理后台：http://152.32.209.245:8081/login.html

## 🔐 默认账户

### 管理后台

- **用户名**：admin
- **密码**：admin123

**重要**：生产环境请立即修改默认密码！

## 📡 服务端口

| 服务 | 端口 | 说明 |
|------|------|------|
| 前端网站后端 | 3000 | API服务 |
| 管理后台后端 | 3001 | 管理后台API服务 |
| 前端网站前端 | 8080 | Web服务器 |
| 管理后台前端 | 8081 | Web服务器 |

## 📚 详细文档

- **快速部署指南**：查看 [快速部署指南.md](./快速部署指南.md)
- **Linux部署说明**：查看 [部署说明-Linux.md](./部署说明-Linux.md)
- **前端网站**：查看 [shenyunmuye-website/README.md](./shenyunmuye-website/README.md)
- **后端API**：查看 [shenyunmuye-backend/README.md](./shenyunmuye-backend/README.md)
- **API接口文档**：查看 [shenyunmuye-backend/API.md](./shenyunmuye-backend/API.md)
- **管理后台前端**：查看 [shenyunmuye-admin-frontend/README.md](./shenyunmuye-admin-frontend/README.md)
- **管理后台后端**：查看 [shenyunmuye-admin-backend/README.md](./shenyunmuye-admin-backend/README.md)

## 🔧 环境要求

- Node.js >= 14.0.0
- npm >= 6.0.0
- Python 3（用于启动Web服务器）

## ⚙️ 配置说明

### 环境变量

**前端网站后端**：
- `WEBSITE_BACKEND_PORT`: 端口（默认3000）
- `WEBSITE_BACKEND_HOST`: 主机（默认localhost）

**管理后台后端**：
- `ADMIN_BACKEND_PORT`: 端口（默认3001）
- `ADMIN_BACKEND_HOST`: 主机（默认localhost）
- `ADMIN_FRONTEND_URL`: 前端URL（用于CORS）

### 生产环境配置

生产环境会自动：
- 绑定到 `0.0.0.0` 以允许外部访问
- 使用服务器IP地址（152.32.209.245）
- 配置CORS允许跨域访问

## 🚢 部署到Linux服务器

详细步骤请参考：[部署说明-Linux.md](./部署说明-Linux.md)

### 快速部署命令

```bash
# 1. 上传项目
scp -r shenyunmuye_project user@152.32.209.245:/opt/

# 2. SSH登录服务器
ssh user@152.32.209.245

# 3. 进入项目目录
cd /opt/shenyunmuye_project

# 4. 添加执行权限
chmod +x *.sh

# 5. 检查依赖
./检查依赖.sh

# 6. 配置防火墙
sudo ufw allow 3000/tcp
sudo ufw allow 3001/tcp
sudo ufw allow 8080/tcp
sudo ufw allow 8081/tcp

# 7. 启动服务
./启动所有服务.sh prod
```

## 📝 注意事项

1. **图片资源**：确保 `images` 文件夹在 `shenyunmuye-website/` 目录下
2. **防火墙**：Linux服务器需要开放相应端口
3. **默认密码**：生产环境必须修改管理后台默认密码
4. **HTTPS**：建议生产环境配置SSL证书

## 🔒 安全建议

1. 修改默认管理员密码
2. 使用HTTPS（配置SSL证书）
3. 配置防火墙规则
4. 使用反向代理（Nginx）
5. 定期备份数据文件
6. 配置日志轮转

## 📄 许可证

ISC License
