# 防火墙管理系统

这是一个基于 Web 的防火墙管理系统，用于管理 Nginx IP 白名单和黑名单。

## 功能特性

- ✅ 用户登录认证（Token-based）
- ✅ IP 白名单管理（查看、添加、删除）
- ✅ IP 黑名单管理（查看、添加、删除）
- ✅ Nginx 配置测试和重载
- ✅ 支持 CIDR 网段格式
- ✅ 现代化的 Web UI

## 项目结构

```
manager-firewall/
├── backend/              # 后端服务
│   ├── server.js         # Express 服务器
│   ├── package.json      # 依赖配置
│   └── data/             # 数据存储（自动创建）
│       ├── users.json    # 用户数据
│       └── sessions.json # 会话数据
│
├── frontend/             # 前端界面
│   ├── index.html        # 管理界面
│   ├── login.html        # 登录页面
│   ├── styles/           # 样式文件
│   │   ├── login.css
│   │   └── main.css
│   └── js/               # JavaScript 文件
│       ├── config.js     # API 配置
│       ├── auth.js       # 认证模块
│       ├── login.js      # 登录逻辑
│       └── main.js       # 主应用逻辑
│
├── nginx.conf            # Nginx 配置示例
└── README.md             # 本文件
```

## 快速开始

### 1. 安装后端依赖

```bash
cd manager-firewall/backend
npm install
```

### 2. 配置 Nginx

将 `nginx.conf` 的内容添加到 Nginx 配置中，或创建新文件：

```bash
sudo cp nginx.conf /etc/nginx/conf.d/manager-firewall.conf
sudo nginx -t
sudo systemctl reload nginx
```

### 3. 启动后端服务

```bash
cd manager-firewall/backend
npm start
```

或使用开发模式（自动重启）：

```bash
npm run dev
```

### 4. 访问系统

- 前端界面：http://localhost:8082
- 后端 API：http://localhost:3002

### 5. 默认账户

- 用户名：`admin`
- 密码：`admin123`

## API 接口

### 认证接口

- `POST /api/auth/login` - 登录
- `POST /api/auth/logout` - 登出
- `GET /api/auth/me` - 获取当前用户信息

### 白名单接口

- `GET /api/whitelist` - 获取白名单列表
- `POST /api/whitelist` - 添加白名单 IP
- `DELETE /api/whitelist/:ip` - 删除白名单 IP

### 黑名单接口

- `GET /api/blacklist` - 获取黑名单列表
- `POST /api/blacklist` - 添加黑名单 IP
- `DELETE /api/blacklist/:ip` - 删除黑名单 IP

### Nginx 配置接口

- `GET /api/nginx/test` - 测试 Nginx 配置
- `POST /api/nginx/reload` - 重载 Nginx 配置

## 配置说明

### 环境变量

后端服务支持以下环境变量：

- `FIREWALL_BACKEND_PORT` - 后端服务端口（默认：3002）
- `FIREWALL_BACKEND_HOST` - 后端服务主机（默认：localhost）
- `FIREWALL_FRONTEND_URL` - 前端 URL（用于 CORS）

### Nginx 文件路径

系统默认使用以下路径（需要 root 权限）：

- 黑名单文件：`/etc/nginx/conf.d/blacklist.conf`
- 白名单文件：`/etc/nginx/whitelist.conf`
- Nginx 主配置：`/etc/nginx/nginx.conf`

## 安全注意事项

1. **默认密码**：首次登录后请立即修改默认密码
2. **HTTPS**：生产环境建议使用 HTTPS
3. **权限控制**：确保只有授权用户可以访问系统
4. **防火墙规则**：建议限制访问来源 IP

## 故障排查

### 后端服务无法启动

- 检查端口 3002 是否被占用
- 检查 Node.js 版本（需要 >= 14.0.0）
- 查看后端日志

### 前端无法访问

- 检查 Nginx 是否运行
- 检查端口 8082 是否开放
- 检查 Nginx 配置是否正确

### API 请求失败

- 检查后端服务是否运行
- 检查 CORS 配置
- 查看浏览器控制台错误信息

## 开发

### 后端开发

```bash
cd manager-firewall/backend
npm run dev  # 使用 nodemon 自动重启
```

### 前端开发

直接编辑前端文件，刷新浏览器即可看到更改。

## 许可证

ISC

