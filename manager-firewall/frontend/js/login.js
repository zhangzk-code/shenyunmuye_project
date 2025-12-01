// 登录页面逻辑

const loginForm = document.getElementById('loginForm');
const submitBtn = document.getElementById('submitBtn');
const formError = document.getElementById('formError');

// 检查是否已登录
const token = localStorage.getItem('firewall_token');
if (token) {
    // 验证token是否有效
    fetch(`${API_BASE_URL}/auth/me`, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            window.location.href = 'index.html';
        } else {
            localStorage.removeItem('firewall_token');
        }
    })
    .catch(() => {
        localStorage.removeItem('firewall_token');
    });
}

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;

    // 清除错误信息
    formError.classList.remove('show');
    formError.textContent = '';
    document.getElementById('username').classList.remove('error');
    document.getElementById('password').classList.remove('error');

    // 验证输入
    if (!username) {
        showError('username', '请输入用户名');
        return;
    }
    if (!password) {
        showError('password', '请输入密码');
        return;
    }

    // 禁用提交按钮
    submitBtn.disabled = true;
    submitBtn.textContent = '登录中...';

    try {
        const response = await fetch(`${API_BASE_URL}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (data.success) {
            // 保存token和用户信息
            localStorage.setItem('firewall_token', data.data.token);
            localStorage.setItem('firewall_user', JSON.stringify(data.data.user));
            
            // 跳转到管理页面
            window.location.href = 'index.html';
        } else {
            showFormError(data.message || '登录失败');
            submitBtn.disabled = false;
            submitBtn.textContent = '登录';
        }
    } catch (error) {
        console.error('登录错误:', error);
        showFormError('网络错误，请稍后重试');
        submitBtn.disabled = false;
        submitBtn.textContent = '登录';
    }
});

function showError(field, message) {
    const input = document.getElementById(field);
    const errorEl = document.getElementById(field + 'Error');
    input.classList.add('error');
    if (errorEl) {
        errorEl.textContent = message;
        errorEl.classList.add('show');
    }
}

function showFormError(message) {
    formError.textContent = message;
    formError.classList.add('show');
}

