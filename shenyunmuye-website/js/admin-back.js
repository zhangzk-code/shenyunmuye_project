/**
 * 管理后台返回功能
 * 在所有页面中自动检测并显示返回管理后台按钮
 */
(function() {
    // 等待DOM加载完成
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initAdminBack);
    } else {
        initAdminBack();
    }
    
    function initAdminBack() {
        // 查找nav-utils容器
        const navUtils = document.querySelector('.nav-utils');
        if (!navUtils) return;
        
        // 检查是否已经存在返回按钮
        if (document.getElementById('backToAdminBtn')) return;
        
        // 创建返回管理后台按钮
        const backToAdminBtn = document.createElement('a');
        backToAdminBtn.id = 'backToAdminBtn';
        backToAdminBtn.className = 'admin-back-btn';
        backToAdminBtn.href = '#';
        backToAdminBtn.textContent = '管理后台';
        backToAdminBtn.title = '返回管理后台';
        backToAdminBtn.style.cssText = 'display: none; padding: 5px 15px; background: #4f46e5; color: white; text-decoration: none; border-radius: 4px; font-size: 13px; margin-right: 10px; transition: background 0.3s;';
        
        // 悬停效果
        backToAdminBtn.addEventListener('mouseenter', () => {
            backToAdminBtn.style.background = '#4338ca';
        });
        backToAdminBtn.addEventListener('mouseleave', () => {
            backToAdminBtn.style.background = '#4f46e5';
        });
        
        // 插入到nav-utils的开头
        navUtils.insertBefore(backToAdminBtn, navUtils.firstChild);
        
        // 检查sessionStorage中是否有管理后台URL
        const adminBackUrl = sessionStorage.getItem('admin_back_url');
        if (adminBackUrl) {
            backToAdminBtn.style.display = 'inline-block';
            backToAdminBtn.href = adminBackUrl;
            backToAdminBtn.addEventListener('click', (e) => {
                e.preventDefault();
                window.location.href = adminBackUrl;
            });
            return;
        }
        
        // 检查localStorage中是否有管理后台token
        const adminToken = localStorage.getItem('admin_token');
        if (adminToken) {
            // 如果有token，尝试构建管理后台URL
            const hostname = window.location.hostname;
            let adminUrl;
            if (hostname === 'localhost' || hostname === '127.0.0.1') {
                adminUrl = 'http://localhost:8081/admin.html';
            } else if (hostname === '152.32.209.245') {
                adminUrl = 'http://152.32.209.245:8081/admin.html';
            } else {
                adminUrl = `${window.location.protocol}//${hostname}:8081/admin.html`;
            }
            backToAdminBtn.style.display = 'inline-block';
            backToAdminBtn.href = adminUrl;
            backToAdminBtn.addEventListener('click', (e) => {
                e.preventDefault();
                window.location.href = adminUrl;
            });
        }
    }
})();

