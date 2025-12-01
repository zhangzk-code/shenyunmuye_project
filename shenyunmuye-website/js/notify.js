/**
 * 自定义提示框组件
 * 提供美观且一致的提示框，替代原生 alert
 */

// 创建提示框容器（如果不存在）
function ensureNotifyContainer() {
    let container = document.getElementById('notifyContainer');
    if (!container) {
        container = document.createElement('div');
        container.id = 'notifyContainer';
        container.className = 'notify-container';
        document.body.appendChild(container);
    }
    return container;
}

/**
 * 显示提示框
 * @param {string} message - 提示消息
 * @param {string} type - 类型：'success', 'error', 'warning', 'info'
 * @param {Object} options - 配置选项
 * @param {string} options.title - 标题
 * @param {number} options.duration - 自动关闭时间（毫秒），0表示不自动关闭
 * @param {boolean} options.showClose - 是否显示关闭按钮
 */
function showNotify(message, type = 'info', options = {}) {
    const {
        title = '',
        duration = 3000,
        showClose = true
    } = options;

    const container = ensureNotifyContainer();
    
    // 创建提示框元素
    const notify = document.createElement('div');
    notify.className = `notify notify-${type}`;
    
    // 图标映射
    const icons = {
        success: '✓',
        error: '✕',
        warning: '⚠',
        info: 'ℹ'
    };
    
    // 标题映射
    const titles = {
        success: '成功',
        error: '错误',
        warning: '警告',
        info: '提示'
    };
    
    // 构建HTML
    notify.innerHTML = `
        <div class="notify-content">
            <div class="notify-icon">${icons[type] || icons.info}</div>
            <div class="notify-body">
                ${title ? `<div class="notify-title">${title || titles[type]}</div>` : ''}
                <div class="notify-message">${message}</div>
            </div>
            ${showClose ? '<button class="notify-close" onclick="this.closest(\'.notify\').remove()">×</button>' : ''}
        </div>
    `;
    
    // 添加到容器
    container.appendChild(notify);
    
    // 触发动画
    requestAnimationFrame(() => {
        notify.classList.add('notify-show');
    });
    
    // 自动关闭
    if (duration > 0) {
        setTimeout(() => {
            notify.classList.remove('notify-show');
            setTimeout(() => {
                if (notify.parentNode) {
                    notify.remove();
                }
            }, 300);
        }, duration);
    }
    
    return notify;
}

/**
 * 显示成功提示
 */
function showSuccess(message, options = {}) {
    return showNotify(message, 'success', { title: '成功', ...options });
}

/**
 * 显示错误提示
 */
function showError(message, options = {}) {
    return showNotify(message, 'error', { title: '错误', duration: 5000, ...options });
}

/**
 * 显示警告提示
 */
function showWarning(message, options = {}) {
    return showNotify(message, 'warning', { title: '警告', duration: 4000, ...options });
}

/**
 * 显示信息提示
 */
function showInfo(message, options = {}) {
    return showNotify(message, 'info', { title: '提示', ...options });
}

// 导出到全局
window.showNotify = showNotify;
window.showSuccess = showSuccess;
window.showError = showError;
window.showWarning = showWarning;
window.showInfo = showInfo;

