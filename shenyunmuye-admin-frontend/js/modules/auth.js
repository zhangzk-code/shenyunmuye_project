// 认证模块

import { API_BASE_URL } from '../config.js';
import { fetchWithTimeout } from '../utils.js';
import { showInfo } from '../ui.js';

let token = null;
let userElements = {
    userName: null,
    userAvatar: null,
    userIP: null,
    userRole: null
};

// 初始化认证模块
export function initAuth() {
    token = localStorage.getItem('admin_token');
    if (!token) {
        window.location.href = 'login.html';
        return;
    }
    
    // 获取用户信息元素
    userElements.userName = document.getElementById('userName');
    userElements.userAvatar = document.getElementById('userAvatar');
    userElements.userIP = document.getElementById('userIP');
    userElements.userRole = document.getElementById('userRole');
    
    // 检查认证状态
    checkAuth();
    
    // 绑定登出按钮
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', logout);
    }
}

// 验证token并获取用户信息
export async function checkAuth() {
    try {
        // 先显示缓存的用户信息，避免等待
        const cachedUser = JSON.parse(localStorage.getItem('admin_user') || '{}');
        updateUserInfo(cachedUser);
        
        // 异步验证token（不阻塞页面）
        const response = await fetchWithTimeout(`${API_BASE_URL}/auth/me`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        }, 3000); // 认证请求3秒超时
        
        const result = await response.json();
        if (!result.success) {
            localStorage.removeItem('admin_token');
            localStorage.removeItem('admin_user');
            window.location.href = 'login.html';
        } else {
            // 更新用户信息（优先使用API返回的数据）
            const user = result.data || JSON.parse(localStorage.getItem('admin_user') || '{}');
            if (result.data) {
                localStorage.setItem('admin_user', JSON.stringify(result.data));
            }
            updateUserInfo(user);
        }
        
        // 获取用户IP
        getUserIP();
    } catch (error) {
        // 如果是超时错误，显示友好提示但不立即跳转
        if (error.message && error.message.includes('超时')) {
            if (userElements.userName) {
                userElements.userName.textContent = '连接超时';
            }
            if (userElements.userIP) {
                userElements.userIP.textContent = 'IP: 获取失败';
            }
        } else {
            localStorage.removeItem('admin_token');
            localStorage.removeItem('admin_user');
            window.location.href = 'login.html';
        }
    }
}

// 更新用户信息显示
function updateUserInfo(user) {
    if (user.username) {
        if (userElements.userName) {
            userElements.userName.textContent = user.username;
        }
        if (userElements.userAvatar) {
            // 使用用户名首字母作为头像
            const firstChar = user.username.charAt(0).toUpperCase();
            userElements.userAvatar.textContent = firstChar;
        }
    }
    if (user.role && userElements.userRole) {
        const roleMap = {
            'admin': '管理员',
            'user': '普通用户',
            'editor': '编辑',
            'viewer': '查看者'
        };
        // 确保角色值转换为中文显示
        const roleText = roleMap[user.role] || user.role;
        userElements.userRole.textContent = roleText;
    }
}

// 获取用户IP地址
async function getUserIP() {
    try {
        // 尝试从后端获取IP（如果后端有提供）
        const response = await fetchWithTimeout(`${API_BASE_URL}/auth/ip`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        }, 2000);
        const result = await response.json();
        if (result.success && result.data && result.data.ip) {
            if (userElements.userIP) {
                userElements.userIP.textContent = `IP: ${result.data.ip}`;
            }
            return;
        }
    } catch (error) {
        // 如果后端没有提供IP接口，使用第三方服务
    }
    
    // 使用第三方服务获取IP（备用方案）
    try {
        const ipResponse = await fetchWithTimeout('https://api.ipify.org?format=json', {
            method: 'GET'
        }, 3000);
        const ipData = await ipResponse.json();
        if (ipData.ip && userElements.userIP) {
            userElements.userIP.textContent = `IP: ${ipData.ip}`;
        }
    } catch (error) {
        if (userElements.userIP) {
            userElements.userIP.textContent = 'IP: 未知';
        }
    }
}

// 登出功能
export async function logout() {
    const { showConfirm } = await import('../ui.js');
    const confirmed = await showConfirm(
        '确认退出登录吗？',
        { title: '退出登录', type: 'warning', confirmText: '退出', cancelText: '取消', confirmColor: 'danger' }
    );
    if (!confirmed) {
        return;
    }

    try {
        // 登出请求不阻塞，即使失败也继续执行
        fetchWithTimeout(`${API_BASE_URL}/auth/logout`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        }, 2000).catch(() => {
            // 忽略登出请求错误，继续执行清理
        });
    } catch (error) {
        // 静默处理错误
    }
    showInfo('正在退出...');
    setTimeout(() => {
        localStorage.removeItem('admin_token');
        localStorage.removeItem('admin_user');
        window.location.href = 'login.html';
    }, 500);
}

// 获取token
export function getToken() {
    return token || localStorage.getItem('admin_token');
}

