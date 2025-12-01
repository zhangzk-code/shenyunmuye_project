// 认证模块

let token = null;
let user = null;

// 初始化认证
function initAuth() {
    token = localStorage.getItem('firewall_token');
    user = JSON.parse(localStorage.getItem('firewall_user') || '{}');
    
    if (!token) {
        window.location.href = 'login.html';
        return;
    }
    
    // 更新用户信息显示
    updateUserInfo();
    
    // 验证token
    checkAuth();
    
    // 绑定登出按钮
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', logout);
    }
}

// 验证token并获取用户信息
async function checkAuth() {
    try {
        const response = await fetch(`${API_BASE_URL}/auth/me`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        const result = await response.json();
        if (!result.success) {
            localStorage.removeItem('firewall_token');
            localStorage.removeItem('firewall_user');
            window.location.href = 'login.html';
        } else {
            user = result.data;
            localStorage.setItem('firewall_user', JSON.stringify(user));
            updateUserInfo();
        }
    } catch (error) {
        console.error('验证认证失败:', error);
        localStorage.removeItem('firewall_token');
        localStorage.removeItem('firewall_user');
        window.location.href = 'login.html';
    }
}

// 更新用户信息显示
function updateUserInfo() {
    const userNameEl = document.getElementById('userName');
    if (userNameEl && user.username) {
        userNameEl.textContent = user.username;
    }
}

// 登出功能
async function logout() {
    if (!confirm('确认退出登录吗？')) {
        return;
    }

    try {
        await fetch(`${API_BASE_URL}/auth/logout`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
    } catch (error) {
        // 忽略登出请求错误
    }
    
    localStorage.removeItem('firewall_token');
    localStorage.removeItem('firewall_user');
    window.location.href = 'login.html';
}

// 获取token
function getToken() {
    return token || localStorage.getItem('firewall_token');
}

// 获取认证请求头
function getAuthHeaders() {
    return {
        'Authorization': `Bearer ${getToken()}`,
        'Content-Type': 'application/json'
    };
}

// 将函数暴露到全局作用域
window.getAuthHeaders = getAuthHeaders;
window.getToken = getToken;

