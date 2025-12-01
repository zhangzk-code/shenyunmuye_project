// 主入口文件 - 初始化所有模块

import { initAuth, getToken } from './modules/auth.js';
import { loadContacts } from './modules/contacts.js';
import { loadAppointments } from './modules/appointments.js';
import { initLogsModule } from './modules/logs.js';
import { initHelpModule } from './modules/help.js';
import { initCMSModule } from './modules/cms.js';
import { initUsersModule, loadUsers, loadUserLogs } from './modules/users.js';
import { getWebsiteUrl } from './config.js';
import { PreviewManager } from '../cms/preview/preview.js';

// 导出函数到全局，供HTML中的onclick使用
window.loadContacts = loadContacts;
window.loadAppointments = loadAppointments;

// 初始化应用
export function initApp() {
    // 初始化认证
    initAuth();
    
    // 初始化标签切换
    initTabSwitching();
    
    // 加载当前激活标签的内容
    loadActiveTabContent();
    
    // 初始化快捷操作
    initQuickActions();
    
    // 初始化日志模块
    initLogsModule();
    
    // 初始化帮助模块
    initHelpModule();
    
    // 初始化CMS模块
    initCMS();
    
    // 初始化用户管理模块
    initUsersModule();
}

// 初始化CMS模块
function initCMS() {
    // 初始化预览管理器
    const previewContainer = document.getElementById('previewContainer');
    if (previewContainer) {
        const previewManager = new PreviewManager('previewContainer');
        window.previewManager = previewManager; // 导出到全局供cms模块使用
    }
    
    // 初始化CMS模块
    initCMSModule();
}

// 加载当前激活标签的内容
function loadActiveTabContent() {
    const activeTab = document.querySelector('.nav-item[data-tab].active');
    if (activeTab) {
        const tabName = activeTab.dataset.tab;
        if (tabName === 'contacts') {
            loadContacts();
        } else if (tabName === 'appointments') {
            loadAppointments();
        } else if (tabName === 'logs') {
            // 动态导入日志模块
            import('./modules/logs.js').then(module => {
                if (module.loadLogs) {
                    module.loadLogs();
                }
            });
        } else if (tabName === 'content') {
            // 动态导入CMS模块
            import('./modules/cms.js').then(module => {
                if (module.loadSiteContent && !window.siteContentCache) {
                    module.loadSiteContent();
                }
            });
        } else if (tabName === 'users') {
            // 加载用户列表和用户日志
            loadUsers();
            loadUserLogs();
        }
    }
}

// 滚动到标签页顶部
function scrollToTabTop(tabElement) {
    if (!tabElement) return;
    
    // 等待DOM渲染完成后再滚动
    setTimeout(() => {
        // 获取标签页的第一个子元素（通常是content-card或content-management-wrapper）
        const firstChild = tabElement.firstElementChild;
        if (firstChild) {
            // 使用scrollIntoView滚动到第一个子元素
            firstChild.scrollIntoView({
                behavior: 'smooth',
                block: 'start',
                inline: 'nearest'
            });
        } else {
            // 如果没有子元素，直接滚动到标签页本身
            tabElement.scrollIntoView({
                behavior: 'smooth',
                block: 'start',
                inline: 'nearest'
            });
        }
    }, 100);
}

// 初始化标签切换
function initTabSwitching() {
    const tabButtons = document.querySelectorAll('.nav-item[data-tab]');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabName = btn.dataset.tab;
            tabButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            tabContents.forEach(content => content.classList.remove('active'));
            const target = document.getElementById(`${tabName}Tab`);
            if (target) {
                target.classList.add('active');
                // 滚动到标签页顶部
                scrollToTabTop(target);
            }
            
            // 根据标签加载相应内容
            if (tabName === 'contacts') {
                loadContacts();
            } else if (tabName === 'appointments') {
                loadAppointments();
            } else if (tabName === 'logs') {
                // 动态导入日志模块
                import('./modules/logs.js').then(module => {
                    if (module.loadLogs) {
                        module.loadLogs();
                    }
                });
            } else if (tabName === 'content') {
                // 动态导入CMS模块
                import('./modules/cms.js').then(module => {
                    if (module.loadSiteContent && !window.siteContentCache) {
                        module.loadSiteContent();
                    }
                });
            } else if (tabName === 'users') {
                // 加载用户列表和用户日志
                loadUsers();
                loadUserLogs();
            }
        });
    });
}

// 初始化快捷操作
function initQuickActions() {
    // 返回官网（新标签页）
    const goToWebsiteBtn = document.getElementById('goToWebsiteBtn');
    if (goToWebsiteBtn) {
        goToWebsiteBtn.addEventListener('click', () => {
            const websiteUrl = getWebsiteUrl();
            sessionStorage.setItem('admin_back_url', window.location.href);
            window.open(websiteUrl, '_blank');
        });
    }
    
    // 打开官网（当前标签页）
    const goToWebsiteSameTabBtn = document.getElementById('goToWebsiteSameTabBtn');
    if (goToWebsiteSameTabBtn) {
        goToWebsiteSameTabBtn.addEventListener('click', () => {
            const websiteUrl = getWebsiteUrl();
            sessionStorage.setItem('admin_back_url', window.location.href);
            window.location.href = websiteUrl;
        });
    }
}

// 页面加载完成后初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}

