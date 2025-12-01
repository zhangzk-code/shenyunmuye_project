const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

const app = express();

// 配置
const PORT = process.env.FIREWALL_BACKEND_PORT || 3002;
const HOST = process.env.FIREWALL_BACKEND_HOST || 'localhost';

// Nginx 配置文件路径
const BLACKLIST_FILE = '/etc/nginx/conf.d/blacklist.conf';
const WHITELIST_FILE = '/etc/nginx/whitelist.conf';
const NGINX_CONFIG = '/etc/nginx/nginx.conf';

// 数据存储目录
const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');

// CORS 配置
const corsOptions = {
    origin: function (origin, callback) {
        const allowedOrigins = [
            'http://localhost:8082',
            'http://127.0.0.1:8082',
            process.env.FIREWALL_FRONTEND_URL
        ].filter(Boolean);
        
        if (!origin || allowedOrigins.includes(origin) || allowedOrigins.length === 0) {
            callback(null, true);
        } else {
            callback(null, true); // 开发环境允许所有来源
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
    exposedHeaders: ['Content-Type', 'Authorization'],
    optionsSuccessStatus: 204
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// 确保数据目录存在
async function ensureDataDir() {
    try {
        await fs.access(DATA_DIR);
    } catch {
        await fs.mkdir(DATA_DIR, { recursive: true });
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
            message: '验证会话时出错'
        });
    }
}

// 读取文件内容（如果不存在返回空数组）
async function readFileSafe(filePath, defaultValue = []) {
    try {
        const content = await fs.readFile(filePath, 'utf8');
        return content.trim() ? JSON.parse(content) : defaultValue;
    } catch {
        return defaultValue;
    }
}

// 读取文本文件（如果不存在返回空字符串）
async function readTextFileSafe(filePath) {
    try {
        return await fs.readFile(filePath, 'utf8');
    } catch {
        return '';
    }
}

// 写入文本文件
async function writeTextFile(filePath, content) {
    try {
        await fs.writeFile(filePath, content, 'utf8');
        return true;
    } catch (error) {
        console.error(`写入文件失败 ${filePath}:`, error);
        return false;
    }
}

// 从黑名单文件中提取 IP 列表（排除注释行）
function extractIPsFromBlacklist(content) {
    const lines = content.split('\n');
    const ips = [];
    
    for (const line of lines) {
        const trimmed = line.trim();
        // 跳过注释和空行
        if (!trimmed || trimmed.startsWith('#')) {
            continue;
        }
        
        // 匹配 deny IP; 格式
        const match = trimmed.match(/^deny\s+([^;]+);/);
        if (match) {
            const ip = match[1].trim();
            // 提取注释（如果有）
            const commentMatch = trimmed.match(/;\s*#\s*(.+)$/);
            const comment = commentMatch ? commentMatch[1].trim() : '';
            ips.push({ ip, comment });
        }
    }
    
    return ips;
}

// 从白名单文件中提取 IP 列表（排除注释行）
function extractIPsFromWhitelist(content) {
    const lines = content.split('\n');
    const ips = [];
    
    for (const line of lines) {
        const trimmed = line.trim();
        // 跳过注释和空行
        if (!trimmed || trimmed.startsWith('#')) {
            continue;
        }
        
        // 每行一个 IP 或 CIDR
        ips.push(trimmed);
    }
    
    return ips;
}

// ==================== 认证相关 API ====================

// 登录
app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({
                success: false,
                message: '用户名和密码不能为空'
            });
        }
        
        const users = await readFileSafe(USERS_FILE);
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
        
        // 生成token
        const token = generateToken();
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24小时后过期
        
        const sessions = await readFileSafe(SESSIONS_FILE);
        
        // 移除该用户的其他会话
        const filteredSessions = sessions.filter(s => s.user.id !== user.id);
        
        filteredSessions.push({
            token,
            user: {
                id: user.id,
                username: user.username,
                role: user.role
            },
            expiresAt: expiresAt.toISOString(),
            createdAt: new Date().toISOString()
        });
        
        await fs.writeFile(SESSIONS_FILE, JSON.stringify(filteredSessions, null, 2));
        
        res.json({
            success: true,
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
        console.error('登录错误:', error);
        res.status(500).json({
            success: false,
            message: '登录失败'
        });
    }
});

// 登出
app.post('/api/auth/logout', authenticateToken, async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        const token = authHeader && authHeader.replace('Bearer ', '');
        
        if (token) {
            const sessions = await readFileSafe(SESSIONS_FILE);
            const filteredSessions = sessions.filter(s => s.token !== token);
            await fs.writeFile(SESSIONS_FILE, JSON.stringify(filteredSessions, null, 2));
        }
        
        res.json({
            success: true,
            message: '已退出登录'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: '登出失败'
        });
    }
});

// 获取当前用户信息
app.get('/api/auth/me', authenticateToken, async (req, res) => {
    res.json({
        success: true,
        data: req.user
    });
});

// ==================== 白名单管理 API ====================

// 获取白名单列表
app.get('/api/whitelist', authenticateToken, async (req, res) => {
    try {
        const content = await readTextFileSafe(WHITELIST_FILE);
        const ips = extractIPsFromWhitelist(content);
        
        res.json({
            success: true,
            data: ips
        });
    } catch (error) {
        console.error('获取白名单错误:', error);
        res.status(500).json({
            success: false,
            message: '获取白名单失败'
        });
    }
});

// 添加白名单 IP
app.post('/api/whitelist', authenticateToken, async (req, res) => {
    try {
        const { ip } = req.body;
        
        if (!ip || !ip.trim()) {
            return res.status(400).json({
                success: false,
                message: 'IP 地址不能为空'
            });
        }
        
        const content = await readTextFileSafe(WHITELIST_FILE);
        const existingIPs = extractIPsFromWhitelist(content);
        
        // 检查是否已存在
        if (existingIPs.includes(ip.trim())) {
            return res.status(400).json({
                success: false,
                message: '该 IP 已在白名单中'
            });
        }
        
        // 添加 IP（保留原有内容和格式）
        const newContent = content.trim() ? `${content.trim()}\n${ip.trim()}` : ip.trim();
        const success = await writeTextFile(WHITELIST_FILE, newContent);
        
        if (!success) {
            return res.status(500).json({
                success: false,
                message: '添加白名单失败'
            });
        }
        
        res.json({
            success: true,
            message: '已添加白名单 IP'
        });
    } catch (error) {
        console.error('添加白名单错误:', error);
        res.status(500).json({
            success: false,
            message: '添加白名单失败'
        });
    }
});

// 删除白名单 IP
app.delete('/api/whitelist/:ip', authenticateToken, async (req, res) => {
    try {
        const ipToDelete = decodeURIComponent(req.params.ip);
        
        const content = await readTextFileSafe(WHITELIST_FILE);
        const lines = content.split('\n');
        const filteredLines = lines.filter(line => {
            const trimmed = line.trim();
            // 保留注释和空行，删除匹配的 IP
            if (!trimmed || trimmed.startsWith('#')) {
                return true;
            }
            return trimmed !== ipToDelete;
        });
        
        const newContent = filteredLines.join('\n');
        const success = await writeTextFile(WHITELIST_FILE, newContent);
        
        if (!success) {
            return res.status(500).json({
                success: false,
                message: '删除白名单失败'
            });
        }
        
        res.json({
            success: true,
            message: '已删除白名单 IP'
        });
    } catch (error) {
        console.error('删除白名单错误:', error);
        res.status(500).json({
            success: false,
            message: '删除白名单失败'
        });
    }
});

// ==================== 黑名单管理 API ====================

// 获取黑名单列表
app.get('/api/blacklist', authenticateToken, async (req, res) => {
    try {
        const content = await readTextFileSafe(BLACKLIST_FILE);
        const ips = extractIPsFromBlacklist(content);
        
        res.json({
            success: true,
            data: ips
        });
    } catch (error) {
        console.error('获取黑名单错误:', error);
        res.status(500).json({
            success: false,
            message: '获取黑名单失败'
        });
    }
});

// 添加黑名单 IP
app.post('/api/blacklist', authenticateToken, async (req, res) => {
    try {
        const { ip, comment } = req.body;
        
        if (!ip || !ip.trim()) {
            return res.status(400).json({
                success: false,
                message: 'IP 地址不能为空'
            });
        }
        
        const content = await readTextFileSafe(BLACKLIST_FILE);
        const existingIPs = extractIPsFromBlacklist(content);
        
        // 检查是否已存在
        if (existingIPs.some(item => item.ip === ip.trim())) {
            return res.status(400).json({
                success: false,
                message: '该 IP 已在黑名单中'
            });
        }
        
        // 添加 IP（保留原有内容和格式）
        const timestamp = new Date().toISOString();
        const commentText = comment ? ` # ${comment} - ${timestamp}` : ` # 手动添加 - ${timestamp}`;
        const newLine = `deny ${ip.trim()};${commentText}`;
        const newContent = content.trim() ? `${content.trim()}\n${newLine}` : newLine;
        
        const success = await writeTextFile(BLACKLIST_FILE, newContent);
        
        if (!success) {
            return res.status(500).json({
                success: false,
                message: '添加黑名单失败'
            });
        }
        
        res.json({
            success: true,
            message: '已添加黑名单 IP'
        });
    } catch (error) {
        console.error('添加黑名单错误:', error);
        res.status(500).json({
            success: false,
            message: '添加黑名单失败'
        });
    }
});

// 删除黑名单 IP
app.delete('/api/blacklist/:ip', authenticateToken, async (req, res) => {
    try {
        const ipToDelete = decodeURIComponent(req.params.ip);
        
        const content = await readTextFileSafe(BLACKLIST_FILE);
        const lines = content.split('\n');
        const filteredLines = lines.filter(line => {
            const trimmed = line.trim();
            // 保留注释和空行
            if (!trimmed || trimmed.startsWith('#')) {
                return true;
            }
            // 删除匹配的 IP
            const match = trimmed.match(/^deny\s+([^;]+);/);
            if (match && match[1].trim() === ipToDelete) {
                return false;
            }
            return true;
        });
        
        const newContent = filteredLines.join('\n');
        const success = await writeTextFile(BLACKLIST_FILE, newContent);
        
        if (!success) {
            return res.status(500).json({
                success: false,
                message: '删除黑名单失败'
            });
        }
        
        res.json({
            success: true,
            message: '已删除黑名单 IP'
        });
    } catch (error) {
        console.error('删除黑名单错误:', error);
        res.status(500).json({
            success: false,
            message: '删除黑名单失败'
        });
    }
});

// ==================== Nginx 配置管理 API ====================

// 重载 Nginx 配置
app.post('/api/nginx/reload', authenticateToken, async (req, res) => {
    try {
        // 先测试配置
        try {
            await execAsync('nginx -t');
        } catch (error) {
            return res.status(400).json({
                success: false,
                message: 'Nginx 配置测试失败，请检查配置',
                error: error.stderr || error.message
            });
        }
        
        // 重载配置
        try {
            await execAsync('systemctl reload nginx || nginx -s reload');
            res.json({
                success: true,
                message: 'Nginx 配置已重载'
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: '重载 Nginx 配置失败',
                error: error.stderr || error.message
            });
        }
    } catch (error) {
        console.error('重载 Nginx 错误:', error);
        res.status(500).json({
            success: false,
            message: '重载 Nginx 配置失败'
        });
    }
});

// 测试 Nginx 配置
app.get('/api/nginx/test', authenticateToken, async (req, res) => {
    try {
        const { stdout, stderr } = await execAsync('nginx -t');
        res.json({
            success: true,
            message: 'Nginx 配置测试通过',
            output: stdout || stderr
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: 'Nginx 配置测试失败',
            error: error.stderr || error.message
        });
    }
});

// 健康检查
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        message: '服务运行正常'
    });
});

// 启动服务器
async function startServer() {
    await ensureDataDir();
    
    app.listen(PORT, HOST, () => {
        console.log(`防火墙管理后端服务已启动`);
        console.log(`监听地址: http://${HOST}:${PORT}`);
        console.log(`默认管理员账号: admin / admin123`);
    });
}

startServer().catch(console.error);

