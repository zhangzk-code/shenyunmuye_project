const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs').promises;
const path = require('path');

// 数据存储目录（需在使用前定义）
const DATA_DIR = path.join(__dirname, 'data');
const UPLOAD_DIR = path.join(__dirname, 'uploads');
const CONTACTS_FILE = path.join(DATA_DIR, 'contacts.json');
const APPOINTMENTS_FILE = path.join(DATA_DIR, 'appointments.json');
const CONTENT_DEFAULT_FILE = path.join(DATA_DIR, 'site-content.default.json');
const CONTENT_FILE = path.join(DATA_DIR, 'site-content.json');
const PUBLISHED_CONTENT_FILE = path.join(DATA_DIR, 'site-content.published.json'); // 已发布内容

const app = express();
// 使用环境变量或配置文件中的端口，如果没有则使用默认值3000
const PORT = process.env.WEBSITE_BACKEND_PORT || 3000;
const HOST = process.env.WEBSITE_BACKEND_HOST || 'localhost';

// 中间件
app.use(cors({
    origin: '*', // 允许所有来源
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use('/uploads', express.static(UPLOAD_DIR));
// 注意：前后端分离，不提供前端静态文件服务

// 请求日志中间件（已禁用调试日志）
app.use((req, res, next) => {
    next();
});

// 确保数据目录存在
async function ensureDataDir() {
    try {
        await fs.access(DATA_DIR);
    } catch {
        await fs.mkdir(DATA_DIR, { recursive: true });
    }
    
    // 初始化文件
    try {
        await fs.access(CONTACTS_FILE);
    } catch {
        await fs.writeFile(CONTACTS_FILE, JSON.stringify([], null, 2));
    }
    
    try {
        await fs.access(APPOINTMENTS_FILE);
    } catch {
        await fs.writeFile(APPOINTMENTS_FILE, JSON.stringify([], null, 2));
    }

    try {
        await fs.access(UPLOAD_DIR);
    } catch {
        await fs.mkdir(UPLOAD_DIR, { recursive: true });
    }
}

// 初始化
ensureDataDir();

// 确保已发布内容文件在启动时已初始化
(async () => {
    try {
        await ensureContentFile();
        // 验证已发布内容文件是否存在
        try {
            await fs.access(PUBLISHED_CONTENT_FILE);
        } catch {
        }
    } catch (error) {
    }
})();
async function loadJsonFile(filePath, fallback = {}) {
    try {
        const data = await fs.readFile(filePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        return JSON.parse(JSON.stringify(fallback));
    }
}

async function ensureContentFile() {
    // 确保草稿文件存在（用于预览）
    try {
        await fs.access(CONTENT_FILE);
    } catch {
        const defaults = await loadJsonFile(CONTENT_DEFAULT_FILE, { global: {}, pages: {} });
        await fs.writeFile(CONTENT_FILE, JSON.stringify(defaults, null, 2));
    }
    
    // 确保已发布内容文件存在（网站显示用）
    // 首次初始化：从默认内容创建已发布内容文件
    try {
        await fs.access(PUBLISHED_CONTENT_FILE);
    } catch {
        // 如果已发布内容文件不存在，使用默认内容创建
        const defaults = await loadJsonFile(CONTENT_DEFAULT_FILE, { global: {}, pages: {} });
        await fs.writeFile(PUBLISHED_CONTENT_FILE, JSON.stringify(defaults, null, 2));
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

async function getMergedContent(useDraft = false) {
    await ensureContentFile();
    const defaults = await loadJsonFile(CONTENT_DEFAULT_FILE, { global: {}, pages: {} });
    
    // 如果使用草稿（预览模式），读取草稿内容；否则读取已发布内容
    let stored;
    if (useDraft) {
        // 预览模式：读取草稿内容
        stored = await loadJsonFile(CONTENT_FILE, {});
    } else {
        // 正常模式：只读取已发布内容（网站显示）
        try {
            // 直接读取已发布内容文件，不使用loadJsonFile（避免fallback）
            const publishedData = await fs.readFile(PUBLISHED_CONTENT_FILE, 'utf8');
            stored = JSON.parse(publishedData);
            
            // 验证已发布内容是否有效
            if (!stored || (typeof stored !== 'object')) {
                stored = {};
            } else if (!stored.global && !stored.pages) {
                stored = {};
            }
        } catch (error) {
            // 如果已发布内容文件不存在或读取失败，使用默认内容（绝不读取草稿）
            // 确保已发布内容文件存在（从默认内容创建）
            try {
                await fs.writeFile(PUBLISHED_CONTENT_FILE, JSON.stringify(defaults, null, 2));
            } catch (writeError) {
                // 静默处理创建失败
            }
            stored = {};
        }
    }
    
    return deepMerge(defaults, stored);
}

/**
 * 站点内容（前台读取 - 只读取已发布内容）
 * GET /api/content?page=home
 * GET /api/content?page=home&preview=true (预览模式，读取草稿内容)
 */
app.get('/api/content', async (req, res) => {
    try {
        const pageKey = req.query.page;
        // 检查preview参数（支持多种格式：'true', '1', true等）
        const previewParam = req.query.preview;
        const preview = previewParam === 'true' || previewParam === '1' || previewParam === true;
        
        
        // 预览模式读取草稿，否则读取已发布内容
        const content = await getMergedContent(preview);
        const response = {
            global: content.global || {}
        };

        if (pageKey) {
            response.page = (content.pages && content.pages[pageKey]) || {};
            response.pageKey = pageKey;
        } else {
            response.pages = content.pages || {};
        }

        res.json({
            success: true,
            data: response
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: '无法加载站点内容'
        });
    }
});


// ==================== API 接口 ====================

/**
 * 提交联系表单
 * POST /api/contact
 */
app.post('/api/contact', async (req, res) => {
    try {
        
        const { name, phone, email, city, message } = req.body;
        
        // 验证必填字段
        if (!name || !phone || !message) {
            return res.status(400).json({
                success: false,
                message: '姓名、电话和留言内容为必填项'
            });
        }
        
        // 验证手机号格式
        const phoneRegex = /^1[3-9]\d{9}$/;
        if (!phoneRegex.test(phone)) {
            return res.status(400).json({
                success: false,
                message: '请输入正确的手机号码（11位数字）'
            });
        }
        
        // 读取现有数据
        const data = await fs.readFile(CONTACTS_FILE, 'utf8');
        const contacts = JSON.parse(data);
        
        // 添加新记录
        const newContact = {
            id: Date.now().toString(),
            name,
            phone,
            email: email || '',
            city: city || '',
            message,
            createdAt: new Date().toISOString(),
            status: 'pending' // pending, processed, archived
        };
        
        contacts.push(newContact);
        
        // 保存数据
        await fs.writeFile(CONTACTS_FILE, JSON.stringify(contacts, null, 2));
        
        res.json({
            success: true,
            message: '提交成功，我们会尽快与您联系！',
            data: {
                id: newContact.id
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: '服务器错误，请稍后重试'
        });
    }
});

/**
 * 提交预约设计表单
 * POST /api/appointment
 */
app.post('/api/appointment', async (req, res) => {
    try {
        
        const { name, phone, city, area, description } = req.body;
        
        // 验证必填字段
        if (!name || !phone) {
            return res.status(400).json({
                success: false,
                message: '姓名和电话为必填项'
            });
        }
        
        // 验证手机号格式
        const phoneRegex = /^1[3-9]\d{9}$/;
        if (!phoneRegex.test(phone)) {
            return res.status(400).json({
                success: false,
                message: '请输入正确的手机号码（11位数字）'
            });
        }
        
        // 读取现有数据
        const data = await fs.readFile(APPOINTMENTS_FILE, 'utf8');
        const appointments = JSON.parse(data);
        
        // 添加新记录
        const newAppointment = {
            id: Date.now().toString(),
            name,
            phone,
            city: city || '',
            area: area || '',
            description: description || '',
            createdAt: new Date().toISOString(),
            status: 'pending' // pending, contacted, confirmed, completed
        };
        
        appointments.push(newAppointment);
        
        // 保存数据
        await fs.writeFile(APPOINTMENTS_FILE, JSON.stringify(appointments, null, 2));
        
        
        res.json({
            success: true,
            message: '预约提交成功，我们的设计师会尽快与您联系！',
            data: {
                id: newAppointment.id
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: '服务器错误，请稍后重试',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * 获取联系记录列表（管理后台）
 * GET /api/admin/contacts
 */
app.get('/api/admin/contacts', async (req, res) => {
    try {
        const data = await fs.readFile(CONTACTS_FILE, 'utf8');
        const contacts = JSON.parse(data);
        
        // 按时间倒序排列
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
 * 获取预约记录列表（管理后台）
 * GET /api/admin/appointments
 */
app.get('/api/admin/appointments', async (req, res) => {
    try {
        const data = await fs.readFile(APPOINTMENTS_FILE, 'utf8');
        const appointments = JSON.parse(data);
        
        // 按时间倒序排列
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
 * 更新联系记录状态（管理后台）
 * PUT /api/admin/contacts/:id
 */
app.put('/api/admin/contacts/:id', async (req, res) => {
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
 * 更新预约记录状态（管理后台）
 * PUT /api/admin/appointments/:id
 */
app.put('/api/admin/appointments/:id', async (req, res) => {
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
 * 发布页面内容（将草稿内容复制到已发布内容）
 * POST /api/admin/content/publish/:page
 */
app.post('/api/admin/content/publish/:page', async (req, res) => {
    try {
        const { page } = req.params;
        
        // 读取草稿内容
        const draftContent = await loadJsonFile(CONTENT_FILE, { global: {}, pages: {} });
        
        // 读取已发布内容
        let publishedContent = {};
        try {
            const publishedData = await fs.readFile(PUBLISHED_CONTENT_FILE, 'utf8');
            publishedContent = JSON.parse(publishedData);
        } catch (error) {
            // 如果已发布内容文件不存在，创建空结构
            publishedContent = { global: {}, pages: {} };
        }
        
        // 将草稿内容复制到已发布内容
        if (page === 'global') {
            publishedContent.global = JSON.parse(JSON.stringify(draftContent.global || {}));
        } else {
            if (!publishedContent.pages) {
                publishedContent.pages = {};
            }
            publishedContent.pages[page] = JSON.parse(JSON.stringify((draftContent.pages && draftContent.pages[page]) || {}));
        }
        
        // 保存已发布内容
        await fs.writeFile(PUBLISHED_CONTENT_FILE, JSON.stringify(publishedContent, null, 2));
        
        res.json({
            success: true,
            message: `"${page}"页面已成功发布`
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: '发布失败: ' + error.message
        });
    }
});

/**
 * 健康检查
 * GET /api/health
 */
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        message: 'API服务运行正常',
        timestamp: new Date().toISOString()
    });
});

// 启动服务器
// 生产环境绑定到0.0.0.0以允许外部访问，开发环境使用localhost
const bindHost = (HOST && HOST !== 'localhost' && HOST !== '127.0.0.1') ? '0.0.0.0' : undefined;

if (bindHost) {
    app.listen(PORT, bindHost, () => {
        console.log(`服务器运行在 http://${bindHost}:${PORT}`);
        console.log(`外部访问: http://${HOST}:${PORT}`);
        console.log(`API文档: http://${HOST}:${PORT}/api/health`);
    });
} else {
    app.listen(PORT, () => {
        console.log(`服务器运行在 http://localhost:${PORT}`);
        console.log(`API文档: http://localhost:${PORT}/api/health`);
    });
}