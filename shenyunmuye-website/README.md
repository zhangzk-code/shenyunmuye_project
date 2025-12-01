# 申允木业 - 官方网站前端项目

## 📋 项目概述

申允木业官方网站是一个现代化的全屋定制家居展示平台，采用纯前端技术栈开发，通过 RESTful API 与后端服务交互，实现动态内容管理和用户交互功能。网站支持响应式设计，完美适配 PC、平板和移动设备。

**项目定位**：企业官网 + 产品展示 + 客户服务

**核心价值**：
- 展示公司品牌形象和产品系列
- 提供高定案例展示和定制服务介绍
- 实现客户联系和预约功能
- 支持内容管理系统（CMS）预览模式

---

## ✨ 功能特点

### 🎨 用户界面
- ✅ **完全响应式设计**：支持 PC、平板和手机端，自适应不同屏幕尺寸
- ✅ **现代化 UI 设计**：优雅美观的界面，流畅的动画效果
- ✅ **平滑滚动**：页面内锚点跳转支持平滑滚动
- ✅ **图片懒加载**：优化页面加载性能，提升用户体验
- ✅ **骨架屏加载**：图片加载时显示骨架屏，提升视觉体验

### 📄 页面功能
- ✅ **首页（index.html）**：品牌展示、产品预览、案例展示
- ✅ **产品系列（products.html）**：产品分类筛选、产品详情模态框、多图展示
- ✅ **高定案例（cases.html）**：案例展示、图片弹窗、多图切换
- ✅ **定制服务（service.html）**：服务介绍、预约表单
- ✅ **关于我们（about.html）**：公司介绍、优势展示
- ✅ **联系我们（contact.html）**：联系信息、联系表单

### 🔧 交互功能
- ✅ **产品筛选**：按系列分类筛选产品（经典、现代、轻奢等）
- ✅ **产品详情**：点击产品查看详情，支持多图展示和切换
- ✅ **案例详情**：点击案例查看详情，支持多图展示和键盘/触摸导航
- ✅ **表单提交**：联系表单和预约表单，实时验证和错误提示
- ✅ **浮动侧边栏**：在线咨询、在线客服、返回顶部功能
- ✅ **移动端菜单**：响应式导航菜单，支持移动端友好交互

### 🎯 内容管理
- ✅ **动态内容加载**：通过 API 从后端获取页面内容
- ✅ **CMS 预览模式**：支持预览未发布的内容（`?preview=true`）
- ✅ **全局内容配置**：品牌信息、导航菜单、页脚等全局配置
- ✅ **页面级内容配置**：每个页面独立的内容配置

### 🔐 管理后台集成
- ✅ **返回管理后台按钮**：自动检测登录状态，显示返回按钮
- ✅ **Session 管理**：通过 sessionStorage 和 localStorage 管理登录状态

---

## 📁 项目结构

```
shenyunmuye-website/
├── index.html              # 首页 - 品牌展示和内容预览
├── products.html           # 产品系列页面 - 产品展示和筛选
├── cases.html              # 高定案例页面 - 案例展示
├── about.html              # 关于我们页面 - 公司介绍
├── contact.html            # 联系我们页面 - 联系信息和表单
├── service.html            # 定制服务页面 - 服务介绍和预约表单
├── favicon.svg             # SVG 格式网站图标
├── favicon.ico             # ICO 格式网站图标（兼容旧浏览器）
│
├── css/                    # 样式文件目录
│   ├── style.css          # 主样式文件 - 全局样式、导航栏、页脚等
│   ├── products.css       # 产品页面样式 - 产品卡片、筛选、模态框
│   ├── cases.css          # 案例页面样式 - 案例展示、网格布局
│   ├── about.css          # 关于我们页面样式
│   ├── contact.css        # 联系我们页面样式 - 表单样式
│   ├── service.css         # 定制服务页面样式
│   └── lazy-load.css      # 懒加载和骨架屏样式
│
├── js/                     # JavaScript 文件目录
│   ├── main.js            # 主入口文件 - 移动端菜单、滚动效果等
│   ├── api.js             # API 调用封装 - 统一管理 API 请求
│   ├── content.js         # 内容管理模块 - 动态加载和渲染页面内容
│   ├── products.js        # 产品功能模块 - 产品筛选、详情展示
│   ├── cases.js           # 案例功能模块 - 案例详情、图片弹窗
│   ├── lazy-load.js       # 懒加载模块 - 图片懒加载、滚动动画
│   └── admin-back.js      # 管理后台集成 - 返回管理后台功能
│
└── images/                 # 图片资源目录
    ├── 书架-书房-办公/    # 产品分类图片
    ├── 卧室/
    ├── 厨房/
    ├── 大门/
    ├── 客厅-前台/
    ├── 工厂/
    ├── 楼梯/
    ├── 浴室/
    └── 衣柜/
```

---

## 🏗️ 技术架构

### 前端技术栈
- **HTML5**：语义化标签，SEO 友好
- **CSS3**：Flexbox、Grid 布局，CSS 变量，动画效果
- **JavaScript (ES6+)**：原生 JavaScript，模块化设计，异步编程

### 核心设计模式
- **模块化设计**：功能模块独立，便于维护和扩展
- **事件驱动**：基于事件监听和自定义事件
- **观察者模式**：使用 Intersection Observer API 实现懒加载
- **单例模式**：全局实例管理（lazyImageLoader、scrollReveal）

### 数据流
```
用户操作 → JavaScript 事件处理 → API 请求 → 后端服务 → 数据返回 → DOM 更新
```

---

## 📦 核心模块说明

### 1. `main.js` - 主入口模块
**功能**：页面基础交互功能

**主要功能**：
- 移动端菜单切换
- 返回顶部功能（滚动显示/隐藏）
- 导航栏滚动效果（阴影变化）
- 图片懒加载初始化
- 平滑滚动（锚点跳转）
- 点击外部关闭移动菜单

**关键代码**：
```javascript
// 移动端菜单切换
mobileMenuBtn.addEventListener('click', () => {
    navMenu.classList.toggle('active');
    mobileMenuBtn.classList.toggle('active');
});

// 返回顶部
window.scrollTo({ top: 0, behavior: 'smooth' });
```

---

### 2. `api.js` - API 调用模块
**功能**：统一管理所有 API 请求

**主要功能**：
- API 基础地址自动检测（开发/生产环境）
- API 健康检查
- 联系表单提交
- 预约表单提交
- 错误处理和用户友好提示

**API 配置**：
```javascript
// 自动检测环境
const getApiBaseUrl = () => {
    const hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return 'http://localhost:3000/api';  // 开发环境
    }
    if (hostname === '152.32.209.245') {
        return 'http://152.32.209.245:3000/api';  // 生产环境
    }
    return `${window.location.protocol}//${hostname}:3000/api`;
};
```

**API 接口**：
- `GET /api/health` - 健康检查
- `POST /api/contact` - 提交联系表单
- `POST /api/appointment` - 提交预约表单
- `GET /api/content?page={pageKey}&preview={true|false}` - 获取页面内容

---

### 3. `content.js` - 内容管理模块
**功能**：动态加载和渲染页面内容

**主要功能**：
- 从后端 API 获取页面内容配置
- 应用全局内容（品牌、导航、页脚、浮动侧边栏）
- 渲染页面特定内容（产品、案例等）
- 支持预览模式（`?preview=true`）
- 预览模式下自动在链接中添加预览参数

**内容结构**：
```javascript
{
    global: {
        brand: { name, tagline, logo, slogan, description },
        nav: [{ key, label, link }],
        languages: [{ value, label }],
        footer: { title, description, columns, contact, copyright, icp },
        floatingSidebar: { items, showConsultation, showCustomerService }
    },
    page: {
        // 页面特定内容
    }
}
```

**预览模式**：
- URL 参数：`?preview=true` 或 `?preview=1`
- 功能：显示未发布的内容
- 链接拦截：自动在内部链接中添加预览参数

---

### 4. `products.js` - 产品功能模块
**功能**：产品展示、筛选和详情

**主要功能**：
- 产品系列筛选（经典、现代、轻奢、东方美学、现代年轻、法式顶奢）
- URL 参数同步（`?category={category}`）
- 产品详情模态框（支持单图/多图）
- 图片切换（上一张/下一张、缩略图、键盘导航）
- 自动生成产品详细描述

**产品分类**：
```javascript
const SERIES_TO_CATEGORY = {
    '经典系列': 'classic',
    '东方美学系列': 'oriental',
    '现代系列': 'modern',
    '轻奢系列': 'luxury',
    '现代年轻系列': 'young',
    '法式顶奢系列': 'french'
};
```

**产品详情模态框**：
- 支持单图和多图模式
- 图片切换：按钮、缩略图、键盘（←/→）
- 自动生成详细描述（基于标题、分类、图片路径）

---

### 5. `cases.js` - 案例功能模块
**功能**：案例展示和详情

**主要功能**：
- 案例点击事件绑定（自动检测动态添加的案例）
- 案例详情模态框（支持多图）
- 图片切换（按钮、缩略图、键盘、触摸滑动）
- 移动端触摸滑动支持

**案例数据结构**：
```javascript
{
    title: '案例标题',
    description: '案例描述',
    image: '主图路径',      // 页面显示的主图
    images: ['图片1', '图片2', ...]  // 弹窗中显示的多张图片
}
```

**触摸滑动**：
- 支持移动端左右滑动切换图片
- 滑动阈值：50px
- 使用 `touchstart`、`touchmove`、`touchend` 事件

---

### 6. `lazy-load.js` - 懒加载模块
**功能**：图片懒加载和滚动动画

**主要功能**：
- 图片懒加载（Intersection Observer API）
- 骨架屏显示（加载中状态）
- 滚动显示动画（fade-in-up）
- 降级方案（不支持 Intersection Observer 的浏览器）

**LazyImageLoader 类**：
```javascript
class LazyImageLoader {
    constructor(options = {}) {
        // rootMargin: '50px' - 提前50px开始加载
        // threshold: 0.01
    }
    
    addImage(imgElement, showSkeleton = true) {
        // 添加图片到观察列表
    }
}
```

**ScrollReveal 类**：
```javascript
class ScrollReveal {
    constructor(options = {}) {
        // animationClass: 'fade-in-up'
    }
    
    addElement(element) {
        // 添加元素到观察列表
    }
}
```

**全局实例**：
- `window.lazyImageLoader` - 图片懒加载实例
- `window.scrollReveal` - 滚动动画实例

---

### 7. `admin-back.js` - 管理后台集成模块
**功能**：管理后台返回功能

**主要功能**：
- 自动检测登录状态（sessionStorage/localStorage）
- 显示/隐藏返回管理后台按钮
- 构建管理后台 URL（根据当前域名）

**检测逻辑**：
```javascript
// 1. 检查 sessionStorage
const adminBackUrl = sessionStorage.getItem('admin_back_url');

// 2. 检查 localStorage
const adminToken = localStorage.getItem('admin_token');

// 3. 构建管理后台 URL
const adminUrl = `${protocol}//${hostname}:8081/admin.html`;
```

---

## 🔌 API 接口说明

### 1. 健康检查
```
GET /api/health
```
**响应**：
```json
{
    "success": true,
    "message": "API is running"
}
```

---

### 2. 获取页面内容
```
GET /api/content?page={pageKey}&preview={true|false}
```
**参数**：
- `page`：页面标识（home、products、cases、about、contact、service）
- `preview`：是否预览模式（true/false，可选）

**响应**：
```json
{
    "success": true,
    "data": {
        "global": { ... },
        "page": { ... }
    }
}
```

---

### 3. 提交联系表单
```
POST /api/contact
Content-Type: application/json
```
**请求体**：
```json
{
    "name": "姓名",
    "phone": "电话",
    "email": "邮箱",
    "message": "留言内容"
}
```
**响应**：
```json
{
    "success": true,
    "message": "提交成功"
}
```

---

### 4. 提交预约表单
```
POST /api/appointment
Content-Type: application/json
```
**请求体**：
```json
{
    "name": "姓名",
    "phone": "电话",
    "email": "邮箱",
    "appointmentDate": "预约日期",
    "message": "留言内容"
}
```
**响应**：
```json
{
    "success": true,
    "message": "预约成功"
}
```

---

## 🚀 使用说明

### 开发环境运行

1. **启动后端服务**
   ```bash
   cd ../shenyunmuye-backend
   npm start
   ```
   后端服务默认运行在 `http://localhost:3000`

2. **启动前端服务（可选）**
   
   如果后端未配置静态文件服务，可以使用本地 Web 服务器：
   
   **使用 Python**：
   ```bash
   # Python 3
   python -m http.server 8080
   
   # Python 2
   python -m SimpleHTTPServer 8080
   ```
   
   **使用 Node.js http-server**：
   ```bash
   npx http-server -p 8080
   ```
   
   **使用 VS Code Live Server**：
   - 安装 Live Server 扩展
   - 右键 `index.html` → Open with Live Server

3. **访问网站**
   - 开发环境：`http://localhost:8080`（或后端配置的端口）
   - 生产环境：`http://152.32.209.245:3000`（或配置的域名）

---

### 生产环境部署

1. **配置 Web 服务器（Nginx 示例）**
   ```nginx
   server {
       listen 80;
       server_name your-domain.com;
       
       root /path/to/shenyunmuye-website;
       index index.html;
       
       location / {
           try_files $uri $uri/ /index.html;
       }
       
       location /api {
           proxy_pass http://localhost:3000;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
       }
   }
   ```

2. **配置 API 地址**
   
   修改 `js/api.js` 中的 `getApiBaseUrl()` 函数，确保生产环境 API 地址正确。

3. **优化资源**
   - 压缩 CSS 和 JavaScript 文件
   - 优化图片（使用 WebP 格式，压缩大小）
   - 启用 Gzip 压缩

---

## ⚙️ 配置说明

### 1. API 地址配置

**文件**：`js/api.js`

**修改方法**：
```javascript
const getApiBaseUrl = () => {
    const hostname = window.location.hostname;
    
    // 开发环境
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return 'http://localhost:3000/api';
    }
    
    // 生产环境（根据实际域名修改）
    if (hostname === 'your-domain.com') {
        return 'https://your-domain.com/api';
    }
    
    // 默认使用相对路径
    return `${window.location.protocol}//${hostname}:3000/api`;
};
```

---

### 2. 颜色主题配置

**文件**：`css/style.css`

**修改方法**：
```css
:root {
    --primary-color: #1a1a1a;      /* 主色调 */
    --secondary-color: #f5f5f5;    /* 次要颜色 */
    --accent-color: #d4af37;        /* 强调色 */
    --text-color: #333;             /* 文本颜色 */
    --text-light: #666;              /* 浅色文本 */
    --white: #ffffff;                /* 白色 */
    --border-color: #e0e0e0;        /* 边框颜色 */
    --shadow: 0 2px 10px rgba(0, 0, 0, 0.1);  /* 阴影 */
    --transition: all 0.3s ease;     /* 过渡效果 */
}
```

---

### 3. 联系方式配置

**方式一**：通过 CMS 后台配置（推荐）
- 登录管理后台
- 进入内容管理
- 修改全局内容中的联系方式

**方式二**：直接修改 HTML 文件
- 修改各页面的页脚部分
- 修改 `contact.html` 中的联系信息

---

### 4. 浮动侧边栏配置

**文件**：通过 CMS 后台配置

**配置项**：
```javascript
{
    items: [
        { label: '在线咨询', action: 'consultation', link: '...' },
        { label: '在线客服', action: 'customerService', link: '...' }
    ],
    showConsultation: true,      // 是否显示在线咨询
    showCustomerService: true     // 是否显示在线客服
}
```

---

## 🛠️ 开发指南

### 添加新页面

1. **创建 HTML 文件**
   ```html
   <!DOCTYPE html>
   <html lang="zh-CN">
   <head>
       <meta charset="UTF-8">
       <meta name="viewport" content="width=device-width, initial-scale=1.0">
       <title>页面标题 - 申允木业</title>
       <link rel="icon" type="image/svg+xml" href="favicon.svg">
       <link rel="alternate icon" href="favicon.ico">
       <link rel="stylesheet" href="css/style.css">
       <link rel="stylesheet" href="css/your-page.css">
   </head>
   <body data-page="your-page-key">
       <!-- 页面内容 -->
       <script src="js/lazy-load.js" defer></script>
       <script src="js/content.js" defer></script>
       <script src="js/main.js" defer></script>
   </body>
   </html>
   ```

2. **创建 CSS 文件**
   - 在 `css/` 目录下创建 `your-page.css`
   - 引入到 HTML 文件中

3. **在 content.js 中添加页面渲染逻辑**
   ```javascript
   function renderPageContent(pageKey, pageContent) {
       if (pageKey === 'your-page-key') {
           // 渲染页面内容
       }
   }
   ```

4. **在后端添加页面内容配置**
   - 在 `site-content.json` 中添加页面配置

---

### 添加新功能模块

1. **创建 JavaScript 文件**
   ```javascript
   (function() {
       'use strict';
       
       // 你的代码
       
       // 导出到全局（如果需要）
       window.yourModule = {
           // 导出的函数
       };
   })();
   ```

2. **在 HTML 中引入**
   ```html
   <script src="js/your-module.js" defer></script>
   ```

3. **初始化功能**
   ```javascript
   if (document.readyState === 'loading') {
       document.addEventListener('DOMContentLoaded', initYourModule);
   } else {
       initYourModule();
   }
   ```

---

### 调试技巧

1. **使用浏览器开发者工具**
   - F12 打开开发者工具
   - Console 查看 JavaScript 错误和日志
   - Network 查看 API 请求和响应
   - Elements 查看 DOM 结构

2. **启用预览模式**
   - 在 URL 后添加 `?preview=true`
   - 查看未发布的内容

3. **检查 API 连接**
   - 打开浏览器控制台
   - 查看 Network 标签
   - 检查 API 请求是否成功

---

## 🌐 浏览器支持

### 支持的浏览器
- ✅ Chrome 60+
- ✅ Firefox 55+
- ✅ Safari 12+
- ✅ Edge 79+
- ✅ 移动端浏览器（iOS Safari、Chrome Mobile）

### 使用的现代特性
- **Intersection Observer API**：用于图片懒加载和滚动动画
- **Fetch API**：用于 API 请求
- **CSS Grid / Flexbox**：用于布局
- **CSS Variables**：用于主题配置
- **ES6+ 语法**：箭头函数、模板字符串、解构赋值等

### 降级方案
- 不支持 Intersection Observer 的浏览器：直接加载所有图片
- 不支持 Fetch API 的浏览器：需要添加 polyfill

---

## 📝 注意事项

### 1. 文件路径
- **图片路径**：确保 `images/` 文件夹与 HTML 文件在同一目录
- **相对路径**：所有资源使用相对路径，便于部署

### 2. API 服务
- **必须运行后端服务**：前端表单和内容加载需要后端 API 支持
- **CORS 配置**：如果前后端不在同一域名，需要配置 CORS

### 3. 内容管理
- **预览模式**：预览模式下的内容可能未发布，仅供预览
- **内容缓存**：浏览器可能缓存内容，清除缓存后查看最新内容

### 4. 性能优化
- **图片优化**：使用适当的图片格式和大小
- **懒加载**：所有图片使用懒加载，提升首屏加载速度
- **代码压缩**：生产环境建议压缩 CSS 和 JavaScript

### 5. SEO 优化
- **语义化 HTML**：使用语义化标签
- **Meta 标签**：确保每个页面都有适当的 meta 标签
- **Alt 属性**：所有图片都有 alt 属性

---

## 🔍 常见问题

### Q1: 页面内容不显示？
**A**: 检查以下几点：
1. 后端服务是否运行
2. API 地址是否正确
3. 浏览器控制台是否有错误
4. Network 标签中 API 请求是否成功

### Q2: 表单提交失败？
**A**: 检查以下几点：
1. 后端服务是否运行
2. API 地址是否正确
3. 表单数据格式是否正确
4. 浏览器控制台错误信息

### Q3: 图片不显示？
**A**: 检查以下几点：
1. 图片路径是否正确
2. 图片文件是否存在
3. 浏览器控制台是否有 404 错误
4. 懒加载是否正常工作

### Q4: 移动端菜单不工作？
**A**: 检查以下几点：
1. `main.js` 是否正确加载
2. 浏览器控制台是否有错误
3. 移动端菜单按钮是否存在

### Q5: 预览模式不工作？
**A**: 检查以下几点：
1. URL 参数是否正确（`?preview=true`）
2. 后端是否支持预览模式
3. 内容是否有未发布的版本

---

## 📄 许可证

ISC License

---

## 👥 维护者

申允木业开发团队

---

## 📞 技术支持

如有问题，请联系开发团队或查看项目文档。

---

**最后更新**：2024年
