# 申允木业 - 后端API服务

这是申允木业官方网站的后端API服务器，提供RESTful API接口。

## 📋 功能

- 联系表单数据提交和存储
- 预约设计表单数据提交和存储
- 管理后台API（查看、更新记录状态）
- 数据验证和错误处理
- CORS支持

## 🚀 快速开始

### 环境要求

- Node.js >= 14.0.0
- npm >= 6.0.0

### 安装步骤

1. **安装依赖**
   ```bash
   cd shenyunmuye-backend
   npm install
   ```

2. **启动服务器**
   ```bash
   npm start
   ```
   或使用开发模式（自动重启）：
   ```bash
   npm run dev
   ```

3. **验证服务**
   - API健康检查：http://localhost:3000/api/health

## 📡 API接口文档

### 基础信息

- **Base URL**: `http://localhost:3000/api`
- **数据格式**: JSON
- **字符编码**: UTF-8

### 接口列表

详细API文档请参考：[API接口文档](./API.md)

#### 主要接口

1. **POST** `/api/contact` - 提交联系表单
2. **POST** `/api/appointment` - 提交预约设计表单
3. **GET** `/api/admin/contacts` - 获取联系记录列表
4. **GET** `/api/admin/appointments` - 获取预约记录列表
5. **PUT** `/api/admin/contacts/:id` - 更新联系记录状态
6. **PUT** `/api/admin/appointments/:id` - 更新预约记录状态
7. **GET** `/api/health` - 健康检查

## 🔧 配置

### 端口配置

默认端口为 `3000`，可通过环境变量修改：

```bash
PORT=8080 npm start
```

### 数据存储

- 数据存储在 `data/` 目录下的JSON文件中
- 首次运行会自动创建数据目录和文件
- 可以轻松迁移到数据库（MySQL、MongoDB等）

### CORS配置

当前配置允许所有来源访问，生产环境建议配置具体域名：

```javascript
app.use(cors({
  origin: 'https://yourdomain.com'
}));
```

## 📁 项目结构

```
shenyunmuye-backend/
├── server.js          # 主服务器文件
├── package.json       # 依赖配置
├── .gitignore        # Git忽略文件
├── data/             # 数据存储目录（自动创建）
│   ├── contacts.json      # 联系表单数据
│   └── appointments.json  # 预约表单数据
└── README.md         # 本文件
```

## 🔍 调试

### 查看日志

服务器会输出所有请求日志：
```
2024-01-15T10:30:00.000Z - POST /api/contact
```

### 常见问题

1. **端口被占用**
   - 修改 `PORT` 环境变量或 `server.js` 中的端口号

2. **数据文件权限错误**
   - 确保 `data/` 目录有写入权限

3. **CORS错误**
   - 检查前端请求的域名是否在CORS允许列表中

## 📝 注意事项

1. **生产环境部署**：
   - 使用环境变量管理配置
   - 配置HTTPS
   - 添加身份验证（管理后台API）
   - 使用数据库替代JSON文件存储
   - 配置反向代理（Nginx）

2. **数据备份**：
   - 定期备份 `data/` 目录下的JSON文件

## 📄 许可证

ISC License

