const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');

const app = express();
// 使用环境变量或配置文件中的端口，如果没有则使用默认值3001
const PORT = process.env.ADMIN_BACKEND_PORT || 3001;
const HOST = process.env.ADMIN_BACKEND_HOST || 'localhost';
const WEBSITE_BACKEND_HOST = process.env.WEBSITE_BACKEND_HOST || 'localhost';
const WEBSITE_BACKEND_PORT = process.env.WEBSITE_BACKEND_PORT || 3000;
const PUBLIC_UPLOAD_BASE = process.env.PUBLIC_UPLOAD_BASE || `http://${WEBSITE_BACKEND_HOST}:${WEBSITE_BACKEND_PORT}`;

// 中间件 - CORS配置
// 当使用 credentials: true 时，origin 不能是 '*'
const corsOptions = {
    origin: function (origin, callback) {
        // 允许的源列表
        const allowedOrigins = [
            'http://localhost:8081',
            'http://127.0.0.1:8081',
            'http://152.32.209.245:8081',
            process.env.ADMIN_FRONTEND_URL
        ].filter(Boolean); // 过滤掉 undefined/null
        
        // 如果没有 origin（如 Postman 直接请求），允许通过
        // 或者 origin 在允许列表中，或者允许所有来源（开发环境）
        if (!origin || allowedOrigins.includes(origin) || allowedOrigins.length === 0) {
            callback(null, true);
        } else {
            callback(null, true); // 开发环境允许所有来源
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
    exposedHeaders: ['Content-Type', 'Authorization'],
    optionsSuccessStatus: 204 // 预检请求返回204
};

app.use(cors(corsOptions));

// 手动处理OPTIONS预检请求（确保所有路由都能正确处理）
app.options('*', cors(corsOptions));
app.use(bodyParser.json({ strict: false })); // strict: false 允许解析字符串类型的 JSON
app.use(bodyParser.urlencoded({ extended: true }));

// 请求日志中间件（已禁用调试日志）
app.use((req, res, next) => {
    next();
});

// 数据存储目录
const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');
const WEB_DATA_DIR = path.join(__dirname, '..', 'shenyunmuye-backend', 'data');
const CONTACTS_FILE = path.join(WEB_DATA_DIR, 'contacts.json');
const APPOINTMENTS_FILE = path.join(WEB_DATA_DIR, 'appointments.json');
const CONTENT_FILE = path.join(WEB_DATA_DIR, 'site-content.json');
const CONTENT_DEFAULT_FILE = path.join(WEB_DATA_DIR, 'site-content.default.json');
const PUBLISHED_CONTENT_FILE = path.join(WEB_DATA_DIR, 'site-content.published.json'); // 已发布内容
const UPLOAD_DIR = path.join(__dirname, '..', 'shenyunmuye-backend', 'uploads');
const MEDIA_FILE = path.join(DATA_DIR, 'media.json');
const VERSIONS_DIR = path.join(DATA_DIR, 'versions');
const DRAFTS_DIR = path.join(DATA_DIR, 'drafts');
const LOGS_FILE = path.join(DATA_DIR, 'logs.json');
const LOGS_ARCHIVE_DIR = path.join(DATA_DIR, 'logs-archive');
const USER_LOGS_FILE = path.join(DATA_DIR, 'user-logs.json');

// 确保数据目录存在
async function ensureDataDir() {
    try {
        await fs.access(DATA_DIR);
    } catch {
        await fs.mkdir(DATA_DIR, { recursive: true });
    }
    
    // 确保日志归档目录存在
    try {
        await fs.access(LOGS_ARCHIVE_DIR);
    } catch {
        await fs.mkdir(LOGS_ARCHIVE_DIR, { recursive: true });
    }
    
    // 初始化用户文件（如果不存在，创建默认管理员）
    try {
        await fs.access(USERS_FILE);
    } catch {
        const defaultUsers = [{
            id: '1',
            username: 'admin',
            password: hashPassword('admin123'), // 默认密码：admin123
            role: 'admin',
            createdAt: new Date().toISOString()
        }];
        await fs.writeFile(USERS_FILE, JSON.stringify(defaultUsers, null, 2));
    }
    
    // 初始化会话文件
    try {
        await fs.access(SESSIONS_FILE);
    } catch {
        await fs.writeFile(SESSIONS_FILE, JSON.stringify([], null, 2));
    }
}

// 密码哈希
function hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
}

// 生成会话token
function generateToken() {
    return crypto.randomBytes(32).toString('hex');
}

// 验证token中间件
async function authenticateToken(req, res, next) {
    const authHeader = req.headers.authorization;
    const token = (authHeader && authHeader.replace('Bearer ', '')) || (req.cookies && req.cookies.token);
    
    if (!token) {
        return res.status(401).json({
            success: false,
            message: '未授权，请先登录'
        });
    }
    
    try {
        const sessionsData = await fs.readFile(SESSIONS_FILE, 'utf8');
        const sessions = JSON.parse(sessionsData);
        const session = sessions.find(s => s.token === token && s.expiresAt > new Date().toISOString());
        
        if (!session) {
            return res.status(401).json({
                success: false,
                message: '会话已过期，请重新登录'
            });
        }
        
        req.user = session.user;
        next();
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: '验证失败'
        });
    }
}

// 确保版本和草稿目录存在
async function ensureVersionDirs() {
    try {
        await fs.mkdir(VERSIONS_DIR, { recursive: true });
        await fs.mkdir(DRAFTS_DIR, { recursive: true });
    } catch (error) {
    }
}

// 初始化已发布内容文件（从当前内容复制）
async function ensurePublishedContentFile() {
    try {
        await fs.access(PUBLISHED_CONTENT_FILE);
    } catch {
        // 如果已发布内容不存在，从当前内容复制
        try {
            const currentContent = await loadJsonFile(CONTENT_FILE, { global: {}, pages: {} });
            await fs.writeFile(PUBLISHED_CONTENT_FILE, JSON.stringify(currentContent, null, 2));
        } catch (error) {
            // 如果当前内容也不存在，使用默认内容
            const defaults = await loadJsonFile(CONTENT_DEFAULT_FILE, { global: {}, pages: {} });
            await fs.writeFile(PUBLISHED_CONTENT_FILE, JSON.stringify(defaults, null, 2));
        }
    }
}

// 初始化媒体库文件
async function ensureMediaFile() {
    try {
        await fs.access(MEDIA_FILE);
    } catch {
        await fs.writeFile(MEDIA_FILE, JSON.stringify([], null, 2));
    }
}

// 初始化
ensureDataDir();
ensureUploadDir();
ensureVersionDirs();
ensureMediaFile();
ensurePublishedContentFile();

const uploadStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, UPLOAD_DIR);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const ext = path.extname(file.originalname || '');
        cb(null, `${uniqueSuffix}${ext}`);
    }
});
const upload = multer({ storage: uploadStorage });

async function ensureUploadDir() {
    try {
        await fs.access(UPLOAD_DIR);
    } catch {
        await fs.mkdir(UPLOAD_DIR, { recursive: true });
    }
}
async function loadJsonFile(filePath, fallback = {}) {
    try {
        const data = await fs.readFile(filePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        return JSON.parse(JSON.stringify(fallback));
    }
}

async function ensureContentFile() {
    try {
        await fs.access(CONTENT_FILE);
    } catch {
        const defaults = await loadJsonFile(CONTENT_DEFAULT_FILE, { global: {}, pages: {} });
        await fs.writeFile(CONTENT_FILE, JSON.stringify(defaults, null, 2));
    }
}

function deepMerge(target = {}, source = {}) {
    if (Array.isArray(target) && Array.isArray(source)) {
        return source.length ? source : target;
    }

    if (typeof target === 'object' && typeof source === 'object') {
        const result = { ...target };
        Object.keys(source).forEach(key => {
            if (key in target) {
                result[key] = deepMerge(target[key], source[key]);
            } else {
                result[key] = source[key];
            }
        });
        return result;
    }

    return source === undefined ? target : source;
}

async function getContentDataMerged() {
    await ensureContentFile();
    const defaults = await loadJsonFile(CONTENT_DEFAULT_FILE, { global: {}, pages: {} });
    const stored = await loadJsonFile(CONTENT_FILE, {});
    return deepMerge(defaults, stored);
}

async function getContentRaw() {
    await ensureContentFile();
    return loadJsonFile(CONTENT_FILE, {});
}


// ==================== 认证接口 ====================

// 记录用户日志的辅助函数（需要在登录接口之前定义）
async function recordUserLog(req, action, details = {}) {
    try {
        // 读取现有用户日志
        let userLogs = [];
        try {
            const userLogsData = await fs.readFile(USER_LOGS_FILE, 'utf8');
            userLogs = JSON.parse(userLogsData);
        } catch {
            userLogs = [];
        }
        
        // 生成日志ID
        const logId = crypto.randomBytes(8).toString('hex');
        
        // 获取客户端IP地址
        const xForwardedFor = req.headers['x-forwarded-for'];
        const forwardedIp = xForwardedFor ? (xForwardedFor.split(',')[0] || '').trim() : null;
        const clientIp = forwardedIp || 
                        req.headers['x-real-ip'] || 
                        (req.connection && req.connection.remoteAddress) || 
                        (req.socket && req.socket.remoteAddress) ||
                        req.ip ||
                        'unknown';
        
        // 添加新日志
        const logEntry = {
            id: logId,
            action,
            details,
            timestamp: new Date().toISOString(),
            user: req.user ? (req.user.username || 'unknown') : 'unknown',
            userId: req.user ? (req.user.id || null) : null,
            ip: clientIp
        };
        
        userLogs.unshift(logEntry); // 新日志添加到开头
        
        // 只保留最近1000条日志
        if (userLogs.length > 1000) {
            userLogs = userLogs.slice(0, 1000);
        }
        
        // 保存日志
        await fs.writeFile(USER_LOGS_FILE, JSON.stringify(userLogs, null, 2));
        
        return logEntry;
    } catch (error) {
        // 记录用户日志失败，静默处理
        return null;
    }
}

/**
 * 用户登录
 * POST /api/admin/auth/login
 */
app.post('/api/admin/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({
                success: false,
                message: '用户名和密码不能为空'
            });
        }
        
        const usersData = await fs.readFile(USERS_FILE, 'utf8');
        const users = JSON.parse(usersData);
        
        const user = users.find(u => u.username === username);
        if (!user || user.password !== hashPassword(password)) {
            return res.status(401).json({
                success: false,
                message: '用户名或密码错误'
            });
        }
        
        // 更新最后登录时间
        user.lastLogin = new Date().toISOString();
        await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2));
        
        // 创建会话
        const token = generateToken();
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24小时后过期
        
        const sessionsData = await fs.readFile(SESSIONS_FILE, 'utf8');
        const sessions = JSON.parse(sessionsData);
        
        // 移除该用户的其他会话
        const filteredSessions = sessions.filter(s => s.user.id !== user.id);
        
        filteredSessions.push({
            token,
            userId: user.id,
            user: {
                id: user.id,
                username: user.username,
                role: user.role
            },
            expiresAt: expiresAt.toISOString(),
            createdAt: new Date().toISOString()
        });
        
        await fs.writeFile(SESSIONS_FILE, JSON.stringify(filteredSessions, null, 2));
        
        // 记录登录日志（需要构造一个临时的req对象）
        const tempReq = {
            user: {
                id: user.id,
                username: user.username,
                role: user.role
            },
            headers: req.headers,
            connection: req.connection,
            socket: req.socket,
            ip: req.ip
        };
        await recordUserLog(tempReq, 'login', { username });
        
        res.json({
            success: true,
            message: '登录成功',
            data: {
                token,
                user: {
                    id: user.id,
                    username: user.username,
                    role: user.role
                }
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: '服务器错误'
        });
    }
});

/**
 * 用户登出
 * POST /api/admin/auth/logout
 */
app.post('/api/admin/auth/logout', authenticateToken, async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        const token = (authHeader && authHeader.replace('Bearer ', '')) || (req.cookies && req.cookies.token);
        
        // 记录登出日志
        await recordUserLog(req, 'logout', { username: req.user.username });
        
        const sessionsData = await fs.readFile(SESSIONS_FILE, 'utf8');
        const sessions = JSON.parse(sessionsData);
        const filteredSessions = sessions.filter(s => s.token !== token);
        
        await fs.writeFile(SESSIONS_FILE, JSON.stringify(filteredSessions, null, 2));
        
        res.json({
            success: true,
            message: '登出成功'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: '服务器错误'
        });
    }
});

/**
 * 获取当前用户信息
 * GET /api/admin/auth/me
 */
app.get('/api/admin/auth/me', authenticateToken, async (req, res) => {
    res.json({
        success: true,
        data: req.user
    });
});

/**
 * 获取客户端IP地址
 * GET /api/admin/auth/ip
 */
app.get('/api/admin/auth/ip', authenticateToken, async (req, res) => {
    try {
        // 获取客户端IP地址（与记录日志时使用相同的逻辑）
        const xForwardedFor = req.headers['x-forwarded-for'];
        const forwardedIp = xForwardedFor ? (xForwardedFor.split(',')[0] || '').trim() : null;
        const clientIp = forwardedIp || 
                        req.headers['x-real-ip'] || 
                        (req.connection && req.connection.remoteAddress) || 
                        (req.socket && req.socket.remoteAddress) ||
                        req.ip ||
                        'unknown';
        
        res.json({
            success: true,
            data: {
                ip: clientIp
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: '获取IP地址失败'
        });
    }
});

// ==================== 用户管理接口 ====================

/**
 * 获取用户列表
 * GET /api/admin/users
 */
app.get('/api/admin/users', authenticateToken, async (req, res) => {
    try {
        // 只有管理员可以查看用户列表
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: '权限不足'
            });
        }
        
        const usersData = await fs.readFile(USERS_FILE, 'utf8');
        const users = JSON.parse(usersData);
        
        // 移除密码字段
        const usersWithoutPassword = users.map(user => ({
            id: user.id,
            username: user.username,
            role: user.role,
            createdAt: user.createdAt,
            lastLogin: user.lastLogin || null
        }));
        
        res.json({
            success: true,
            data: usersWithoutPassword
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: '获取用户列表失败: ' + error.message
        });
    }
});

/**
 * 创建用户
 * POST /api/admin/users
 */
app.post('/api/admin/users', authenticateToken, async (req, res) => {
    try {
        // 只有管理员可以创建用户
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: '权限不足'
            });
        }
        
        const { username, password, role } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({
                success: false,
                message: '用户名和密码不能为空'
            });
        }
        
        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                message: '密码长度至少6位'
            });
        }
        
        const usersData = await fs.readFile(USERS_FILE, 'utf8');
        const users = JSON.parse(usersData);
        
        // 检查用户名是否已存在
        if (users.find(u => u.username === username)) {
            return res.status(400).json({
                success: false,
                message: '用户名已存在'
            });
        }
        
        // 生成新用户ID
        const newId = String(Math.max(...users.map(u => parseInt(u.id) || 0)) + 1);
        
        // 创建新用户
        const newUser = {
            id: newId,
            username,
            password: hashPassword(password),
            role: role || 'user',
            createdAt: new Date().toISOString()
        };
        
        users.push(newUser);
        await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2));
        
        // 记录用户日志
        await recordUserLog(req, 'create_user', { username, role: newUser.role });
        
        res.json({
            success: true,
            message: '用户创建成功',
            data: {
                id: newUser.id,
                username: newUser.username,
                role: newUser.role,
                createdAt: newUser.createdAt
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: '创建用户失败: ' + error.message
        });
    }
});

/**
 * 删除用户
 * DELETE /api/admin/users/:id
 */
app.delete('/api/admin/users/:id', authenticateToken, async (req, res) => {
    try {
        // 只有管理员可以删除用户
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: '权限不足'
            });
        }
        
        const { id } = req.params;
        
        const usersData = await fs.readFile(USERS_FILE, 'utf8');
        const users = JSON.parse(usersData);
        
        const userIndex = users.findIndex(u => u.id === id);
        if (userIndex === -1) {
            return res.status(404).json({
                success: false,
                message: '用户不存在'
            });
        }
        
        const user = users[userIndex];
        
        // 检查是否是最后一个管理员
        if (user.role === 'admin') {
            const adminCount = users.filter(u => u.role === 'admin').length;
            if (adminCount <= 1) {
                return res.status(400).json({
                    success: false,
                    message: '不能删除最后一个管理员'
                });
            }
        }
        
        // 不能删除自己
        if (user.id === req.user.id) {
            return res.status(400).json({
                success: false,
                message: '不能删除自己的账号'
            });
        }
        
        // 记录用户日志
        await recordUserLog(req, 'delete_user', { username: user.username });
        
        // 删除用户
        users.splice(userIndex, 1);
        await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2));
        
        // 同时删除该用户的所有会话
        const sessionsData = await fs.readFile(SESSIONS_FILE, 'utf8');
        const sessions = JSON.parse(sessionsData);
        const filteredSessions = sessions.filter(s => s.userId !== id);
        await fs.writeFile(SESSIONS_FILE, JSON.stringify(filteredSessions, null, 2));
        
        res.json({
            success: true,
            message: '用户删除成功'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: '删除用户失败: ' + error.message
        });
    }
});

/**
 * 修改用户密码
 * PUT /api/admin/users/:id/password
 */
app.put('/api/admin/users/:id/password', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { password } = req.body;
        
        if (!password) {
            return res.status(400).json({
                success: false,
                message: '密码不能为空'
            });
        }
        
        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                message: '密码长度至少6位'
            });
        }
        
        const usersData = await fs.readFile(USERS_FILE, 'utf8');
        const users = JSON.parse(usersData);
        
        const user = users.find(u => u.id === id);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: '用户不存在'
            });
        }
        
        // 只有管理员可以修改其他用户的密码，或者用户可以修改自己的密码
        if (req.user.role !== 'admin' && req.user.id !== id) {
            return res.status(403).json({
                success: false,
                message: '权限不足'
            });
        }
        
        // 更新密码
        user.password = hashPassword(password);
        await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2));
        
        // 记录用户日志
        await recordUserLog(req, 'change_password', { 
            username: user.username,
            targetUserId: id,
            isSelf: req.user.id === id
        });
        
        res.json({
            success: true,
            message: '密码修改成功'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: '修改密码失败: ' + error.message
        });
    }
});

// ==================== 数据管理接口 ====================

/**
 * 获取联系记录列表
 * GET /api/admin/contacts
 */
app.get('/api/admin/contacts', authenticateToken, async (req, res) => {
    try {
        const data = await fs.readFile(CONTACTS_FILE, 'utf8');
        const contacts = JSON.parse(data);
        contacts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        
        res.json({
            success: true,
            data: contacts,
            total: contacts.length
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: '服务器错误'
        });
    }
});

/**
 * 获取预约记录列表
 * GET /api/admin/appointments
 */
app.get('/api/admin/appointments', authenticateToken, async (req, res) => {
    try {
        const data = await fs.readFile(APPOINTMENTS_FILE, 'utf8');
        const appointments = JSON.parse(data);
        appointments.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        
        res.json({
            success: true,
            data: appointments,
            total: appointments.length
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: '服务器错误'
        });
    }
});

/**
 * 更新联系记录状态
 * PUT /api/admin/contacts/:id
 */
app.put('/api/admin/contacts/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        
        const data = await fs.readFile(CONTACTS_FILE, 'utf8');
        const contacts = JSON.parse(data);
        
        const index = contacts.findIndex(c => c.id === id);
        if (index === -1) {
            return res.status(404).json({
                success: false,
                message: '记录不存在'
            });
        }
        
        contacts[index].status = status;
        contacts[index].updatedAt = new Date().toISOString();
        
        await fs.writeFile(CONTACTS_FILE, JSON.stringify(contacts, null, 2));
        
        res.json({
            success: true,
            message: '更新成功',
            data: contacts[index]
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: '服务器错误'
        });
    }
});

/**
 * 更新预约记录状态
 * PUT /api/admin/appointments/:id
 */
app.put('/api/admin/appointments/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        
        const data = await fs.readFile(APPOINTMENTS_FILE, 'utf8');
        const appointments = JSON.parse(data);
        
        const index = appointments.findIndex(a => a.id === id);
        if (index === -1) {
            return res.status(404).json({
                success: false,
                message: '记录不存在'
            });
        }
        
        appointments[index].status = status;
        appointments[index].updatedAt = new Date().toISOString();
        
        await fs.writeFile(APPOINTMENTS_FILE, JSON.stringify(appointments, null, 2));
        
        res.json({
            success: true,
            message: '更新成功',
            data: appointments[index]
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: '服务器错误'
        });
    }
});

/**
 * 删除联系记录
 * DELETE /api/admin/contacts/:id
 */
app.delete('/api/admin/contacts/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        
        const data = await fs.readFile(CONTACTS_FILE, 'utf8');
        const contacts = JSON.parse(data);
        
        const index = contacts.findIndex(c => c.id === id);
        if (index === -1) {
            return res.status(404).json({
                success: false,
                message: '记录不存在'
            });
        }
        
        contacts.splice(index, 1);
        
        await fs.writeFile(CONTACTS_FILE, JSON.stringify(contacts, null, 2));
        
        res.json({
            success: true,
            message: '删除成功'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: '服务器错误'
        });
    }
});

/**
 * 删除预约记录
 * DELETE /api/admin/appointments/:id
 */
app.delete('/api/admin/appointments/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        
        const data = await fs.readFile(APPOINTMENTS_FILE, 'utf8');
        const appointments = JSON.parse(data);
        
        const index = appointments.findIndex(a => a.id === id);
        if (index === -1) {
            return res.status(404).json({
                success: false,
                message: '记录不存在'
            });
        }
        
        appointments.splice(index, 1);
        
        await fs.writeFile(APPOINTMENTS_FILE, JSON.stringify(appointments, null, 2));
        
        res.json({
            success: true,
            message: '删除成功'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: '服务器错误'
        });
    }
});

/**
 * 站点内容管理
 */
app.get('/api/admin/content', authenticateToken, async (req, res) => {
    try {
        const { published, preview, page } = req.query;
        const previewParam = typeof preview === 'string' ? preview.toLowerCase() : preview;
        const publishedParam = typeof published === 'string' ? published.toLowerCase() : published;
        
        const isPreview = previewParam === 'true' || previewParam === '1';
        const isExplicitPublished = publishedParam === 'true' || publishedParam === '1';
        const hasPageParam = typeof page === 'string' && page.length > 0;
        
        let content;
        if (isPreview) {
            // 预览模式：始终返回草稿内容（默认内容 + 草稿内容的合并结果）
            content = await getContentDataMerged();
        } else if (isExplicitPublished || hasPageParam) {
            // 指定 published=true 或者带 page 参数（用于发布状态比较）时，返回已发布内容
            await ensurePublishedContentFile();
            content = await loadJsonFile(PUBLISHED_CONTENT_FILE, { global: {}, pages: {} });
        } else {
            // 默认返回草稿内容（用于后台编辑界面）
            content = await getContentDataMerged();
        }
        
        if (hasPageParam) {
            const response = {
                global: content.global || {},
                page: (content.pages && content.pages[page]) || {},
                pageKey: page
            };
            return res.json({ success: true, data: response });
        }
        
        res.json({ success: true, data: content });
    } catch (error) {
        res.status(500).json({ success: false, message: '无法读取内容配置' });
    }
});

app.put('/api/admin/content/page/:page', authenticateToken, async (req, res) => {
    try {
        const page = req.params.page;
        const payload = req.body;

        if (!payload || typeof payload !== 'object') {
            return res.status(400).json({ success: false, message: '无效的内容数据' });
        }

        const current = await getContentRaw();

        if (page === 'global') {
            current.global = payload;
        } else {
            current.pages = current.pages || {};
            current.pages[page] = payload;
        }

        await fs.writeFile(CONTENT_FILE, JSON.stringify(current, null, 2));

        res.json({ success: true, message: '内容已更新' });
    } catch (error) {
        res.status(500).json({ success: false, message: '更新失败' });
    }
});

app.post('/api/admin/content/page/:page/reset', authenticateToken, async (req, res) => {
    try {
        const page = req.params.page;
        const defaults = await loadJsonFile(CONTENT_DEFAULT_FILE, { global: {}, pages: {} });
        const current = await getContentRaw();

        if (page === 'global') {
            current.global = defaults.global || {};
        } else {
            current.pages = current.pages || {};
            current.pages[page] = defaults.pages ? defaults.pages[page] : {};
        }

        await fs.writeFile(CONTENT_FILE, JSON.stringify(current, null, 2));

        res.json({ success: true, message: '内容已恢复默认' });
    } catch (error) {
        res.status(500).json({ success: false, message: '恢复默认失败' });
    }
});

app.get('/api/admin/content/default/:page', authenticateToken, async (req, res) => {
    try {
        const defaults = await loadJsonFile(CONTENT_DEFAULT_FILE, { global: {}, pages: {} });
        const page = req.params.page;
        const data = page === 'global'
            ? (defaults.global || {})
            : (defaults.pages && defaults.pages[page]) || {};
        res.json({ success: true, data });
    } catch (error) {
        res.status(500).json({ success: false, message: '无法读取默认内容' });
    }
});

/**
 * 按栏目保存内容
 * PUT /api/admin/content/page/:page/section/:section
 */
app.put('/api/admin/content/page/:page/section/:section', authenticateToken, async (req, res) => {
    try {
        const { page, section } = req.params;
        let payload = req.body;

        // 如果 bodyParser 没有解析（可能是字符串），尝试手动解析
        if (typeof payload === 'string') {
            try {
                payload = JSON.parse(payload);
            } catch (e) {
                // 如果解析失败，保持原样（可能是纯字符串）
            }
        }

        // 允许基本类型（字符串、数字等）和对象类型
        // 因为某些 section（如 heroImage）可能是字符串字段
        if (payload === null || payload === undefined) {
            return res.status(400).json({ success: false, message: '无效的内容数据: payload 为空' });
        }

        const current = await getContentRaw();

        if (page === 'global') {
            if (!current.global) current.global = {};
            current.global[section] = payload;
        } else {
            current.pages = current.pages || {};
            if (!current.pages[page]) current.pages[page] = {};
            current.pages[page][section] = payload;
        }

        await fs.writeFile(CONTENT_FILE, JSON.stringify(current, null, 2));

        res.json({ success: true, message: '栏目内容已更新' });
    } catch (error) {
        res.status(500).json({ success: false, message: '更新失败: ' + (error.message || '未知错误') });
    }
});

/**
 * 按栏目恢复默认
 * POST /api/admin/content/page/:page/section/:section/reset
 */
app.post('/api/admin/content/page/:page/section/:section/reset', authenticateToken, async (req, res) => {
    try {
        const { page, section } = req.params;
        const defaults = await loadJsonFile(CONTENT_DEFAULT_FILE, { global: {}, pages: {} });
        const current = await getContentRaw();

        if (page === 'global') {
            if (!current.global) current.global = {};
            if (defaults.global && defaults.global[section]) {
                current.global[section] = defaults.global[section];
            } else {
                delete current.global[section];
            }
        } else {
            current.pages = current.pages || {};
            if (!current.pages[page]) current.pages[page] = {};
            if (defaults.pages && defaults.pages[page] && defaults.pages[page][section]) {
                current.pages[page][section] = defaults.pages[page][section];
            } else {
                delete current.pages[page][section];
            }
        }

        await fs.writeFile(CONTENT_FILE, JSON.stringify(current, null, 2));

        res.json({ success: true, message: '栏目已恢复默认' });
    } catch (error) {
        res.status(500).json({ success: false, message: '恢复默认失败' });
    }
});

// 根据请求动态生成上传文件的URL，适配不同的部署环境
function getUploadUrl(req, filename) {
    // 优先从请求头获取主机信息（支持反向代理）
    const forwardedHost = req.get('x-forwarded-host');
    const forwardedProto = req.get('x-forwarded-proto');
    const origin = req.get('origin');
    
    let protocol = 'http';
    let hostname = WEBSITE_BACKEND_HOST;
    
    if (forwardedHost) {
        // 通过反向代理，使用代理的主机名
        hostname = forwardedHost.split(':')[0];
        protocol = forwardedProto || 'http';
    } else if (origin) {
        // 从 Origin 头获取主机名
        try {
            const originUrl = new URL(origin);
            hostname = originUrl.hostname;
            protocol = originUrl.protocol.replace(':', '');
        } catch (e) {
            // URL解析失败，使用默认值
        }
    } else {
        // 从请求中获取主机名
        protocol = req.protocol || 'http';
        hostname = req.hostname || (req.get('host') ? req.get('host').split(':')[0] : WEBSITE_BACKEND_HOST);
    }
    
    // 使用后端服务器端口（3000）
    return `${protocol}://${hostname}:${WEBSITE_BACKEND_PORT}/uploads/${filename}`;
}

app.post('/api/admin/uploads', authenticateToken, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: '未接收到文件' });
        }
        // 根据请求动态生成URL，适配不同的部署环境
        const fileUrl = getUploadUrl(req, req.file.filename);
        res.json({
            success: true,
            data: {
                url: fileUrl,
                filename: req.file.filename,
                originalname: req.file.originalname
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: '上传失败' });
    }
});

/**
 * ==================== 媒体库API ====================
 */

/**
 * 获取媒体列表
 * GET /api/admin/media
 */
app.get('/api/admin/media', authenticateToken, async (req, res) => {
    try {
        const data = await fs.readFile(MEDIA_FILE, 'utf8');
        const media = JSON.parse(data);
        
        // 支持筛选
        let filteredMedia = media;
        const { category, tags, search } = req.query;
        
        if (category && category !== 'all') {
            filteredMedia = filteredMedia.filter(m => m.category === category);
        }
        
        if (tags) {
            const tagList = tags.split(',');
            filteredMedia = filteredMedia.filter(m => 
                m.tags && tagList.some(tag => m.tags.includes(tag))
            );
        }
        
        if (search) {
            const searchLower = search.toLowerCase();
            filteredMedia = filteredMedia.filter(m => 
                m.filename.toLowerCase().includes(searchLower) ||
                (m.tags && m.tags.some(tag => tag.toLowerCase().includes(searchLower)))
            );
        }
        
        res.json({
            success: true,
            data: filteredMedia,
            total: filteredMedia.length
        });
    } catch (error) {
        res.status(500).json({ success: false, message: '获取媒体列表失败' });
    }
});

/**
 * 上传媒体文件
 * POST /api/admin/media/upload
 */
app.post('/api/admin/media/upload', authenticateToken, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: '未接收到文件' });
        }
        
        // 根据请求动态生成URL，适配不同的部署环境
        const fileUrl = getUploadUrl(req, req.file.filename);
        const fileType = req.file.mimetype.startsWith('image/') ? 'image' : 
                        req.file.mimetype.startsWith('video/') ? 'video' : 'document';
        
        const mediaItem = {
            id: `media_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            filename: req.file.filename,
            originalname: req.file.originalname,
            url: fileUrl,
            type: fileType,
            category: fileType === 'image' ? 'images' : fileType === 'video' ? 'videos' : 'documents',
            size: req.file.size,
            tags: [],
            uploadedAt: new Date().toISOString(),
            uploadedBy: req.user.username
        };
        
        // 如果是图片，尝试获取尺寸
        if (fileType === 'image') {
            // 这里可以添加图片尺寸检测逻辑
            mediaItem.width = null;
            mediaItem.height = null;
        }
        
        // 保存到媒体库
        const mediaData = await fs.readFile(MEDIA_FILE, 'utf8');
        const media = JSON.parse(mediaData);
        media.push(mediaItem);
        await fs.writeFile(MEDIA_FILE, JSON.stringify(media, null, 2));
        
        res.json({
            success: true,
            data: mediaItem
        });
    } catch (error) {
        res.status(500).json({ success: false, message: '上传失败' });
    }
});

/**
 * 删除媒体
 * DELETE /api/admin/media/:id
 */
app.delete('/api/admin/media/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const mediaData = await fs.readFile(MEDIA_FILE, 'utf8');
        const media = JSON.parse(mediaData);
        const filteredMedia = media.filter(m => m.id !== id);
        
        if (filteredMedia.length === media.length) {
            return res.status(404).json({ success: false, message: '媒体不存在' });
        }
        
        await fs.writeFile(MEDIA_FILE, JSON.stringify(filteredMedia, null, 2));
        
        res.json({ success: true, message: '删除成功' });
    } catch (error) {
        res.status(500).json({ success: false, message: '删除失败' });
    }
});

/**
 * 更新媒体信息
 * PUT /api/admin/media/:id
 */
app.put('/api/admin/media/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { tags, category } = req.body;
        
        const mediaData = await fs.readFile(MEDIA_FILE, 'utf8');
        const media = JSON.parse(mediaData);
        const mediaIndex = media.findIndex(m => m.id === id);
        
        if (mediaIndex === -1) {
            return res.status(404).json({ success: false, message: '媒体不存在' });
        }
        
        if (tags !== undefined) media[mediaIndex].tags = tags;
        if (category !== undefined) media[mediaIndex].category = category;
        media[mediaIndex].updatedAt = new Date().toISOString();
        
        await fs.writeFile(MEDIA_FILE, JSON.stringify(media, null, 2));
        
        res.json({ success: true, data: media[mediaIndex] });
    } catch (error) {
        res.status(500).json({ success: false, message: '更新失败' });
    }
});

/**
 * ==================== 发布管理API ====================
 */

/**
 * 发布页面
 * POST /api/admin/publish/page/:page
 */
app.post('/api/admin/publish/page/:page', authenticateToken, async (req, res) => {
    try {
        const { page } = req.params;
        const { publish, scheduledAt } = req.body;
        
        if (publish) {
            // 发布：将草稿内容复制到已发布内容
            const draftContent = await getContentRaw();
            const publishedContent = await loadJsonFile(PUBLISHED_CONTENT_FILE, { global: {}, pages: {} });
            
            if (page === 'global') {
                // 发布全站设置（使用深拷贝）
                publishedContent.global = JSON.parse(JSON.stringify(draftContent.global || {}));
            } else {
                // 发布指定页面（使用深拷贝）
                if (!publishedContent.pages) publishedContent.pages = {};
                publishedContent.pages[page] = JSON.parse(JSON.stringify((draftContent.pages && draftContent.pages[page]) || {}));
            }
            
            // 先保存到管理后端的已发布内容文件
            await fs.writeFile(PUBLISHED_CONTENT_FILE, JSON.stringify(publishedContent, null, 2));
            
            // 同时更新网站后端的已发布内容（如果文件存在）
            const websitePublishedFile = path.join(__dirname, '..', 'shenyunmuye-backend', 'data', 'site-content.published.json');
            try {
                await fs.writeFile(websitePublishedFile, JSON.stringify(publishedContent, null, 2));
            } catch (error) {
                // 静默处理错误，因为管理后端的文件已经更新成功
            }
            
            res.json({
                success: true,
                message: '页面已发布',
                data: {
                    page,
                    published: true,
                    publishedAt: new Date().toISOString(),
                    scheduledAt: scheduledAt || null
                }
            });
        } else {
            // 取消发布（保留已发布内容，但不更新）
            res.json({
                success: true,
                message: '已取消发布（已发布内容保持不变）',
                data: {
                    page,
                    published: false
                }
            });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: '发布失败: ' + error.message });
    }
});

/**
 * 获取发布状态
 * GET /api/admin/publish/page/:page
 */
app.get('/api/admin/publish/page/:page', authenticateToken, async (req, res) => {
    try {
        const { page } = req.params;
        
        // 读取草稿内容和已发布内容，比较是否有差异
        const draftContent = await getContentRaw();
        const publishedContent = await loadJsonFile(PUBLISHED_CONTENT_FILE, { global: {}, pages: {} });
        
        let draftData, publishedData;
        if (page === 'global') {
            draftData = draftContent.global || {};
            publishedData = publishedContent.global || {};
        } else {
            draftData = (draftContent.pages && draftContent.pages[page]) || {};
            publishedData = (publishedContent.pages && publishedContent.pages[page]) || {};
        }
        
        // 简单比较（可以改进为深度比较）
        const hasChanges = JSON.stringify(draftData) !== JSON.stringify(publishedData);
        
        res.json({
            success: true,
            data: {
                page,
                published: !hasChanges, // 如果没有差异，说明已发布
                hasUnpublishedChanges: hasChanges,
                publishedAt: null // 可以添加发布时间记录
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: '获取发布状态失败' });
    }
});

/**
 * ==================== 版本控制API ====================
 */

/**
 * 获取版本列表
 * GET /api/admin/versions/page/:page
 */
app.get('/api/admin/versions/page/:page', authenticateToken, async (req, res) => {
    try {
        const { page } = req.params;
        const { section } = req.query;
        const versionFile = path.join(VERSIONS_DIR, `${page}${section ? `_${section}` : ''}.json`);
        
        try {
            const data = await fs.readFile(versionFile, 'utf8');
            const versions = JSON.parse(data);
            res.json({ success: true, data: versions });
        } catch {
            res.json({ success: true, data: [] });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: '获取版本列表失败' });
    }
});

/**
 * 创建版本
 * POST /api/admin/versions
 */
app.post('/api/admin/versions', authenticateToken, async (req, res) => {
    try {
        const { page, section, content, message } = req.body;
        
        if (!page || !content) {
            return res.status(400).json({ success: false, message: '缺少必要参数' });
        }
        
        const version = {
            id: `v_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            page,
            section: section || null,
            content,
            message: message || '自动保存',
            createdAt: new Date().toISOString(),
            createdBy: req.user.username
        };
        
        const versionFile = path.join(VERSIONS_DIR, `${page}${section ? `_${section}` : ''}.json`);
        let versions = [];
        
        try {
            const data = await fs.readFile(versionFile, 'utf8');
            versions = JSON.parse(data);
        } catch {
            // 文件不存在，创建新文件
        }
        
        versions.unshift(version);
        // 只保留最近50个版本
        versions = versions.slice(0, 50);
        
        await fs.writeFile(versionFile, JSON.stringify(versions, null, 2));
        
        res.json({ success: true, data: version });
    } catch (error) {
        res.status(500).json({ success: false, message: '创建版本失败' });
    }
});

/**
 * 恢复版本
 * POST /api/admin/versions/:versionId/restore
 */
app.post('/api/admin/versions/:versionId/restore', authenticateToken, async (req, res) => {
    try {
        const { versionId } = req.params;
        const { page, section } = req.query;
        
        const versionFile = path.join(VERSIONS_DIR, `${page}${section ? `_${section}` : ''}.json`);
        const data = await fs.readFile(versionFile, 'utf8');
        const versions = JSON.parse(data);
        const version = versions.find(v => v.id === versionId);
        
        if (!version) {
            return res.status(404).json({ success: false, message: '版本不存在' });
        }
        
        // 恢复内容
        if (section) {
            const current = await getContentRaw();
            if (!current.pages) current.pages = {};
            if (!current.pages[page]) current.pages[page] = {};
            current.pages[page][section] = version.content;
            await fs.writeFile(CONTENT_FILE, JSON.stringify(current, null, 2));
        } else {
            const current = await getContentRaw();
            if (page === 'global') {
                current.global = version.content;
            } else {
                if (!current.pages) current.pages = {};
                current.pages[page] = version.content;
            }
            await fs.writeFile(CONTENT_FILE, JSON.stringify(current, null, 2));
        }
        
        res.json({ success: true, message: '版本已恢复', data: version });
    } catch (error) {
        res.status(500).json({ success: false, message: '恢复版本失败' });
    }
});

/**
 * ==================== 草稿API ====================
 */

/**
 * 保存草稿
 * POST /api/admin/drafts
 */
app.post('/api/admin/drafts', authenticateToken, async (req, res) => {
    try {
        const { page, section, content } = req.body;
        
        if (!page || !content) {
            return res.status(400).json({ success: false, message: '缺少必要参数' });
        }
        
        const draftFile = path.join(DRAFTS_DIR, `${page}${section ? `_${section}` : ''}.json`);
        const draft = {
            page,
            section: section || null,
            content,
            lastModified: new Date().toISOString(),
            autoSaved: req.body.autoSaved || false
        };
        
        await fs.writeFile(draftFile, JSON.stringify(draft, null, 2));
        
        res.json({ success: true, data: draft });
    } catch (error) {
        res.status(500).json({ success: false, message: '保存草稿失败' });
    }
});

/**
 * 获取草稿
 * GET /api/admin/drafts/page/:page
 */
app.get('/api/admin/drafts/page/:page', authenticateToken, async (req, res) => {
    try {
        const { page } = req.params;
        const { section } = req.query;
        const draftFile = path.join(DRAFTS_DIR, `${page}${section ? `_${section}` : ''}.json`);
        
        try {
            const data = await fs.readFile(draftFile, 'utf8');
            const draft = JSON.parse(data);
            res.json({ success: true, data: draft });
        } catch {
            res.json({ success: true, data: null });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: '获取草稿失败' });
    }
});

/**
 * 删除草稿
 * DELETE /api/admin/drafts/page/:page
 */
app.delete('/api/admin/drafts/page/:page', authenticateToken, async (req, res) => {
    try {
        const { page } = req.params;
        const { section } = req.query;
        const draftFile = path.join(DRAFTS_DIR, `${page}${section ? `_${section}` : ''}.json`);
        
        try {
            await fs.unlink(draftFile);
        } catch {
            // 文件不存在，忽略
        }
        
        res.json({ success: true, message: '草稿已删除' });
    } catch (error) {
        res.status(500).json({ success: false, message: '删除草稿失败' });
    }
});

/**
 * 健康检查
 * GET /api/admin/health
 */
app.get('/api/admin/health', (req, res) => {
    res.json({
        success: true,
        message: '管理后台API服务运行正常',
        timestamp: new Date().toISOString()
    });
});

// 启动服务器
// 生产环境绑定到0.0.0.0以允许外部访问，开发环境使用localhost
const bindHost = (HOST && HOST !== 'localhost' && HOST !== '127.0.0.1') ? '0.0.0.0' : undefined;

/**
 * ==================== 操作日志API ====================
 */

/**
 * 记录操作日志
 * POST /api/admin/logs
 */
app.post('/api/admin/logs', authenticateToken, async (req, res) => {
    try {
        const { action, page, section, beforeData, afterData, timestamp } = req.body;
        
        if (!action || !page) {
            return res.status(400).json({ success: false, message: '缺少必要参数' });
        }
        
        // 读取现有日志
        let logs = [];
        try {
            const logsData = await fs.readFile(LOGS_FILE, 'utf8');
            logs = JSON.parse(logsData);
        } catch {
            logs = [];
        }
        
        // 生成日志ID
        const logId = crypto.randomBytes(8).toString('hex');
        
        // 获取客户端IP地址
        const xForwardedFor = req.headers['x-forwarded-for'];
        const forwardedIp = xForwardedFor ? (xForwardedFor.split(',')[0] || '').trim() : null;
        const clientIp = forwardedIp || 
                        req.headers['x-real-ip'] || 
                        (req.connection && req.connection.remoteAddress) || 
                        (req.socket && req.socket.remoteAddress) ||
                        req.ip ||
                        'unknown';
        
        // 添加新日志
        const logEntry = {
            id: logId,
            action,
            page,
            section: section || null,
            beforeData: beforeData || null,
            afterData: afterData || null,
            timestamp: timestamp || new Date().toISOString(),
            user: req.user.username || 'unknown',
            ip: clientIp
        };
        
        logs.unshift(logEntry); // 新日志添加到开头
        
        // 只保留最近1000条日志
        if (logs.length > 1000) {
            logs = logs.slice(0, 1000);
        }
        
        // 保存日志
        await fs.writeFile(LOGS_FILE, JSON.stringify(logs, null, 2));
        
        res.json({ success: true, data: logEntry });
    } catch (error) {
        res.status(500).json({ success: false, message: '记录日志失败: ' + error.message });
    }
});

/**
 * 获取操作日志
 * GET /api/admin/logs
 */
app.get('/api/admin/logs', authenticateToken, async (req, res) => {
    try {
        const { page, action, limit = 100 } = req.query;
        
        // 读取日志
        let logs = [];
        try {
            const logsData = await fs.readFile(LOGS_FILE, 'utf8');
            logs = JSON.parse(logsData);
        } catch {
            logs = [];
        }
        
        // 读取归档日志ID列表（用于过滤）
        let archivedIds = new Set();
        try {
            const archiveIndexFile = path.join(LOGS_ARCHIVE_DIR, 'index.json');
            const archiveIndexData = await fs.readFile(archiveIndexFile, 'utf8');
            const archiveIndex = JSON.parse(archiveIndexData);
            archivedIds = new Set(archiveIndex.archivedIds || []);
        } catch {
            // 如果索引文件不存在，说明没有归档的日志
        }
        
        // 过滤掉已归档的日志
        logs = logs.filter(log => !archivedIds.has(log.id));
        
        // 筛选日志
        let filteredLogs = logs;
        if (page) {
            filteredLogs = filteredLogs.filter(log => log.page === page);
        }
        if (action) {
            filteredLogs = filteredLogs.filter(log => log.action === action);
        }
        
        // 限制数量
        filteredLogs = filteredLogs.slice(0, parseInt(limit));
        
        res.json({ success: true, data: filteredLogs });
    } catch (error) {
        res.status(500).json({ success: false, message: '获取日志失败: ' + error.message });
    }
});

/**
 * 归档操作日志
 * POST /api/admin/logs/archive
 */
app.post('/api/admin/logs/archive', authenticateToken, async (req, res) => {
    try {
        const { logIds } = req.body;
        
        if (!logIds || !Array.isArray(logIds) || logIds.length === 0) {
            return res.status(400).json({ success: false, message: '请选择要归档的日志' });
        }
        
        // 读取当前日志
        let logs = [];
        try {
            const logsData = await fs.readFile(LOGS_FILE, 'utf8');
            logs = JSON.parse(logsData);
        } catch {
            logs = [];
        }
        
        // 读取归档索引
        let archiveIndex = { archivedIds: [], archives: [] };
        try {
            const archiveIndexFile = path.join(LOGS_ARCHIVE_DIR, 'index.json');
            const archiveIndexData = await fs.readFile(archiveIndexFile, 'utf8');
            archiveIndex = JSON.parse(archiveIndexData);
        } catch {
            archiveIndex = { archivedIds: [], archives: [] };
        }
        
        // 获取要归档的日志
        const logsToArchive = logs.filter(log => logIds.includes(log.id));
        
        if (logsToArchive.length === 0) {
            return res.status(400).json({ success: false, message: '未找到要归档的日志' });
        }
        
        // 生成归档文件名（使用时间戳）
        const archiveTimestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
        const archiveFileName = `logs-archive-${archiveTimestamp}.json`;
        const archiveFilePath = path.join(LOGS_ARCHIVE_DIR, archiveFileName);
        
        // 保存归档日志到文件
        await fs.writeFile(archiveFilePath, JSON.stringify(logsToArchive, null, 2));
        
        // 更新归档索引
        const archiveEntry = {
            id: crypto.randomBytes(8).toString('hex'),
            fileName: archiveFileName,
            logCount: logsToArchive.length,
            archivedAt: new Date().toISOString(),
            archivedBy: req.user.username || 'unknown',
            logIds: logIds
        };
        
        archiveIndex.archives.unshift(archiveEntry);
        archiveIndex.archivedIds.push(...logIds);
        
        // 保存归档索引
        const archiveIndexFile = path.join(LOGS_ARCHIVE_DIR, 'index.json');
        await fs.writeFile(archiveIndexFile, JSON.stringify(archiveIndex, null, 2));
        
        // 从当前日志中移除已归档的日志
        logs = logs.filter(log => !logIds.includes(log.id));
        await fs.writeFile(LOGS_FILE, JSON.stringify(logs, null, 2));
        
        res.json({ 
            success: true, 
            message: `成功归档 ${logsToArchive.length} 条日志`,
            data: {
                archiveId: archiveEntry.id,
                archiveFileName: archiveFileName,
                logCount: logsToArchive.length
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: '归档失败: ' + error.message });
    }
});

/**
 * 获取归档日志列表
 * GET /api/admin/logs/archives
 */
app.get('/api/admin/logs/archives', authenticateToken, async (req, res) => {
    try {
        let archiveIndex = { archives: [] };
        try {
            const archiveIndexFile = path.join(LOGS_ARCHIVE_DIR, 'index.json');
            const archiveIndexData = await fs.readFile(archiveIndexFile, 'utf8');
            archiveIndex = JSON.parse(archiveIndexData);
        } catch {
            archiveIndex = { archives: [] };
        }
        
        res.json({ success: true, data: archiveIndex.archives || [] });
    } catch (error) {
        res.status(500).json({ success: false, message: '获取归档列表失败: ' + error.message });
    }
});

/**
 * 下载归档日志文件
 * GET /api/admin/logs/archives/:archiveId/download
 */
app.get('/api/admin/logs/archives/:archiveId/download', authenticateToken, async (req, res) => {
    try {
        const { archiveId } = req.params;
        
        // 读取归档索引
        let archiveIndex = { archives: [] };
        try {
            const archiveIndexFile = path.join(LOGS_ARCHIVE_DIR, 'index.json');
            const archiveIndexData = await fs.readFile(archiveIndexFile, 'utf8');
            archiveIndex = JSON.parse(archiveIndexData);
        } catch {
            return res.status(404).json({ success: false, message: '归档索引不存在' });
        }
        
        // 查找归档记录
        const archive = archiveIndex.archives.find(a => a.id === archiveId);
        if (!archive) {
            return res.status(404).json({ success: false, message: '归档记录不存在' });
        }
        
        // 读取归档文件
        const archiveFilePath = path.join(LOGS_ARCHIVE_DIR, archive.fileName);
        const archiveData = await fs.readFile(archiveFilePath, 'utf8');
        
        // 设置响应头，触发下载
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="${archive.fileName}"`);
        res.send(archiveData);
    } catch (error) {
        res.status(500).json({ success: false, message: '下载归档文件失败: ' + error.message });
    }
});

/**
 * 删除归档日志
 * DELETE /api/admin/logs/archives/:archiveId
 */
app.delete('/api/admin/logs/archives/:archiveId', authenticateToken, async (req, res) => {
    try {
        const { archiveId } = req.params;
        
        // 读取归档索引
        let archiveIndex = { archives: [], archivedIds: [] };
        try {
            const archiveIndexFile = path.join(LOGS_ARCHIVE_DIR, 'index.json');
            const archiveIndexData = await fs.readFile(archiveIndexFile, 'utf8');
            archiveIndex = JSON.parse(archiveIndexData);
        } catch {
            return res.status(404).json({ success: false, message: '归档索引不存在' });
        }
        
        // 查找归档记录
        const archiveIndex_pos = archiveIndex.archives.findIndex(a => a.id === archiveId);
        if (archiveIndex_pos === -1) {
            return res.status(404).json({ success: false, message: '归档记录不存在' });
        }
        
        const archive = archiveIndex.archives[archiveIndex_pos];
        
        // 删除归档文件
        try {
            const archiveFilePath = path.join(LOGS_ARCHIVE_DIR, archive.fileName);
            await fs.unlink(archiveFilePath);
        } catch (error) {
            // 如果文件不存在，继续执行（可能已经被手动删除）
        }
        
        // 从归档索引中移除
        archiveIndex.archives.splice(archiveIndex_pos, 1);
        
        // 从archivedIds中移除对应的日志ID（这些日志ID现在可以重新显示在日志列表中）
        if (archive.logIds && Array.isArray(archive.logIds)) {
            archive.logIds.forEach(logId => {
                const idIndex = archiveIndex.archivedIds.indexOf(logId);
                if (idIndex !== -1) {
                    archiveIndex.archivedIds.splice(idIndex, 1);
                }
            });
        }
        
        // 保存更新后的归档索引
        const archiveIndexFile = path.join(LOGS_ARCHIVE_DIR, 'index.json');
        await fs.writeFile(archiveIndexFile, JSON.stringify(archiveIndex, null, 2));
        
        res.json({ 
            success: true, 
            message: '归档已删除',
            data: {
                archiveId: archiveId,
                restoredLogIds: archive.logIds || []
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: '删除归档失败: ' + error.message });
    }
});

/**
 * ==================== 用户日志API ====================
 */

/**
 * 记录用户日志
 * POST /api/admin/users/logs
 */
app.post('/api/admin/users/logs', authenticateToken, async (req, res) => {
    try {
        const { action, details, timestamp } = req.body;
        
        if (!action) {
            return res.status(400).json({ success: false, message: '缺少必要参数' });
        }
        
        const logEntry = await recordUserLog(req, action, details || {});
        
        if (logEntry) {
            res.json({ success: true, data: logEntry });
        } else {
            res.status(500).json({ success: false, message: '记录日志失败' });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: '记录日志失败: ' + error.message });
    }
});

/**
 * 获取用户日志
 * GET /api/admin/users/logs
 */
app.get('/api/admin/users/logs', authenticateToken, async (req, res) => {
    try {
        // 只有管理员可以查看用户日志
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: '权限不足'
            });
        }
        
        const { action, limit = 100 } = req.query;
        
        // 读取用户日志
        let userLogs = [];
        try {
            const userLogsData = await fs.readFile(USER_LOGS_FILE, 'utf8');
            userLogs = JSON.parse(userLogsData);
        } catch {
            userLogs = [];
        }
        
        // 筛选日志
        let filteredLogs = userLogs;
        if (action) {
            filteredLogs = filteredLogs.filter(log => log.action === action);
        }
        
        // 限制数量
        filteredLogs = filteredLogs.slice(0, parseInt(limit));
        
        res.json({ success: true, data: filteredLogs });
    } catch (error) {
        res.status(500).json({ success: false, message: '获取用户日志失败: ' + error.message });
    }
});

/**
 * 批量删除用户日志
 * DELETE /api/admin/users/logs/batch
 * 注意：这个路由必须在 /:logId 路由之前定义，否则会被参数路由匹配
 */
app.delete('/api/admin/users/logs/batch', authenticateToken, async (req, res) => {
    try {
        // 只有管理员可以删除用户日志
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: '权限不足'
            });
        }
        
        const { logIds } = req.body;
        
        if (!logIds || !Array.isArray(logIds) || logIds.length === 0) {
            return res.status(400).json({
                success: false,
                message: '请提供要删除的日志ID列表'
            });
        }
        
        // 读取用户日志
        let userLogs = [];
        try {
            const userLogsData = await fs.readFile(USER_LOGS_FILE, 'utf8');
            userLogs = JSON.parse(userLogsData);
        } catch {
            return res.status(404).json({
                success: false,
                message: '用户日志文件不存在'
            });
        }
        
        // 创建日志ID集合，用于快速查找
        const logIdSet = new Set(logIds);
        
        // 记录删除前的数量
        const beforeCount = userLogs.length;
        
        // 过滤掉要删除的日志
        userLogs = userLogs.filter(log => !logIdSet.has(log.id));
        
        // 记录删除后的数量
        const deletedCount = beforeCount - userLogs.length;
        
        // 保存更新后的日志
        await fs.writeFile(USER_LOGS_FILE, JSON.stringify(userLogs, null, 2));
        
        res.json({
            success: true,
            message: `成功删除 ${deletedCount} 条用户日志`,
            deletedCount
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: '批量删除用户日志失败: ' + error.message
        });
    }
});

/**
 * 删除用户日志
 * DELETE /api/admin/users/logs/:logId
 * 注意：这个路由必须在 /batch 路由之后定义
 */
app.delete('/api/admin/users/logs/:logId', authenticateToken, async (req, res) => {
    try {
        // 只有管理员可以删除用户日志
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: '权限不足'
            });
        }
        
        const { logId } = req.params;
        
        // 读取用户日志
        let userLogs = [];
        try {
            const userLogsData = await fs.readFile(USER_LOGS_FILE, 'utf8');
            userLogs = JSON.parse(userLogsData);
        } catch {
            return res.status(404).json({
                success: false,
                message: '用户日志文件不存在'
            });
        }
        
        // 查找要删除的日志
        const logIndex = userLogs.findIndex(log => log.id === logId);
        if (logIndex === -1) {
            return res.status(404).json({
                success: false,
                message: '用户日志不存在'
            });
        }
        
        // 删除日志
        userLogs.splice(logIndex, 1);
        
        // 保存更新后的日志
        await fs.writeFile(USER_LOGS_FILE, JSON.stringify(userLogs, null, 2));
        
        res.json({
            success: true,
            message: '用户日志删除成功'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: '删除用户日志失败: ' + error.message
        });
    }
});

if (bindHost) {
    app.listen(PORT, bindHost, () => {
        console.log(`管理后台API服务运行在 http://${bindHost}:${PORT}`);
        console.log(`外部访问: http://${HOST}:${PORT}`);
        console.log(`默认管理员账户：用户名 admin，密码 admin123`);
    });
} else {
    app.listen(PORT, () => {
        console.log(`管理后台API服务运行在 http://localhost:${PORT}`);
        console.log(`默认管理员账户：用户名 admin，密码 admin123`);
    });
}