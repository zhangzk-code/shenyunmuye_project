// API配置
// 如果前端和后端在同一域名下，使用相对路径
// 否则使用配置的API地址

// 引入配置文件（如果在Node.js环境中）
let config;
try {
  config = require('../../config.js');
} catch (e) {
  // 浏览器环境中忽略
  config = null;
}

const getApiBaseUrl = () => {
    const hostname = window.location.hostname;
    const protocol = window.location.protocol;
    const port = window.location.port || (protocol === 'https:' ? '443' : '80');
    
    // 检查是否在开发环境（localhost）
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return 'http://localhost:3000/api';
    }
    
    // 生产环境：使用当前主机名和默认端口
    // 如果当前访问的是80端口（默认HTTP），后端API使用3000端口
    // 如果当前访问的是其他端口，后端API也使用3000端口
    const backendPort = '3000';
    return `${protocol}//${hostname}:${backendPort}/api`;
};

const API_BASE_URL = getApiBaseUrl();

// 检查API是否可用
async function checkApiAvailable() {
    // 如果是file://协议，说明是直接打开HTML文件
    if (window.location.protocol === 'file:') {
        // 使用配置文件中的端口，如果没有则使用默认值3000
        const backendPort = (config && config.websiteBackend.port) || 3000;
        return {
            available: false,
            message: `请通过服务器访问（http://152.32.209.245:${backendPort}），不能直接打开HTML文件`
        };
    }
    
    try {
        // 使用AbortController实现超时（兼容性更好）
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        
        const response = await fetch(`${API_BASE_URL}/health`, {
            method: 'GET',
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (response.ok) {
            return { available: true };
        } else {
            return {
                available: false,
                message: '服务器响应异常，请检查服务器状态'
            };
        }
    } catch (error) {
        if (error.name === 'AbortError') {
            return {
                available: false,
                message: '连接超时，请确保后端服务已启动（运行 npm start）'
            };
        }
        return {
            available: false,
            message: '无法连接到服务器，请确保后端服务已启动（运行 npm start）'
        };
    }
}

/**
 * 发送联系表单
 * @param {Object} formData - 表单数据
 * @returns {Promise}
 */
async function submitContactForm(formData) {
    // 先检查API是否可用
    const apiCheck = await checkApiAvailable();
    if (!apiCheck.available) {
        throw new Error(apiCheck.message);
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/contact`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(formData)
        });
        
        // 如果响应不是JSON格式，可能是服务器错误
        let result;
        try {
            result = await response.json();
        } catch (e) {
            throw new Error('服务器返回了无效的响应，请检查服务器是否正常运行');
        }
        
        if (!response.ok) {
            throw new Error(result.message || '提交失败');
        }
        
        return result;
    } catch (error) {
        
        // 提供更友好的错误信息
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
            throw new Error('无法连接到服务器，请确保后端服务已启动（运行 npm start）');
        }
        
        if (error.name === 'AbortError') {
            throw new Error('请求超时，请检查网络连接');
        }
        
        throw error;
    }
}

/**
 * 发送预约设计表单
 * @param {Object} formData - 表单数据
 * @returns {Promise}
 */
async function submitAppointmentForm(formData) {
    // 先检查API是否可用
    const apiCheck = await checkApiAvailable();
    if (!apiCheck.available) {
        throw new Error(apiCheck.message);
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/appointment`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(formData)
        });
        
        // 如果响应不是JSON格式，可能是服务器错误
        let result;
        try {
            result = await response.json();
        } catch (e) {
            throw new Error('服务器返回了无效的响应，请检查服务器是否正常运行');
        }
        
        if (!response.ok) {
            throw new Error(result.message || '提交失败');
        }
        
        return result;
    } catch (error) {
        
        // 提供更友好的错误信息
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
            throw new Error('无法连接到服务器，请确保后端服务已启动（运行 npm start）');
        }
        
        if (error.name === 'AbortError') {
            throw new Error('请求超时，请检查网络连接');
        }
        
        throw error;
    }
}

/**
 * 健康检查
 * @returns {Promise}
 */
async function checkApiHealth() {
    try {
        const response = await fetch(`${API_BASE_URL}/health`);
        const result = await response.json();
        return result;
    } catch (error) {
        return { success: false };
    }
}

// 导出函数（如果在模块环境中）
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        submitContactForm,
        submitAppointmentForm,
        checkApiHealth
    };
}

