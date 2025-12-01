# 申允木业 - 管理后台前端

这是申允木业管理后台的前端界面，包含登录页面和管理页面。

## 📋 功能

- 用户登录
- 联系记录查看和管理
- 预约记录查看和管理
- 数据状态更新
- 统计数据展示

## 🚀 使用方法

### 启动前端

1. **使用Python简单服务器**
   ```bash
   cd shenyunmuye-admin-frontend
   python -m http.server 8081
   ```

2. **使用Node.js http-server**
   ```bash
   npx http-server -p 8081
   ```

3. **直接打开HTML文件**
   - 打开 `login.html` 进行登录
   - 登录成功后自动跳转到 `admin.html`

### 访问地址

- 登录页面：http://localhost:8081/login.html
- 管理页面：http://localhost:8081/admin.html（需要先登录）

## 🔐 默认账户

- **用户名**：admin
- **密码**：admin123

## ⚙️ 配置

### API地址配置

管理后台前端会自动连接到后端API服务（默认：`http://localhost:3001`）

如需修改，编辑 `login.html` 和 `admin.html` 中的 `API_BASE_URL`：

```javascript
const API_BASE_URL = 'http://localhost:3001/api/admin';
```

## 📁 项目结构

```
shenyunmuye-admin-frontend/
├── login.html        # 登录页面
├── admin.html        # 管理页面
└── README.md        # 本文件
```

## 🔒 认证流程

1. 用户访问 `login.html` 输入用户名和密码
2. 前端发送登录请求到后端API
3. 后端验证成功后返回token
4. 前端保存token到localStorage
5. 访问管理页面时，自动携带token进行认证
6. 如果token无效或过期，自动跳转到登录页面

## 📝 注意事项

1. **后端服务**：确保管理后台后端服务在 `http://localhost:3001` 运行
2. **Token存储**：Token存储在浏览器的localStorage中
3. **会话过期**：Token默认24小时后过期，需要重新登录

## 📄 许可证

ISC License

