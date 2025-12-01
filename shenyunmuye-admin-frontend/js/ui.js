// UI组件模块 - Toast提示、确认框等

// Toast 提示框
export function showToast(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icons = {
        success: '✓',
        error: '✕',
        warning: '⚠',
        info: 'ℹ'
    };
    
    const titles = {
        success: '成功',
        error: '错误',
        warning: '警告',
        info: '提示'
    };

    toast.innerHTML = `
        <span class="toast-icon">${icons[type] || icons.info}</span>
        <div class="toast-content">
            <div class="toast-title">${titles[type] || titles.info}</div>
            <div class="toast-message">${message}</div>
        </div>
        <button class="toast-close" onclick="this.parentElement.remove()">×</button>
    `;

    container.appendChild(toast);

    // 自动移除
    if (duration > 0) {
        setTimeout(() => {
            toast.classList.add('hiding');
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }

    return toast;
}

// 确认对话框
export function showConfirm(message, options = {}) {
    return new Promise((resolve) => {
        const {
            title = '确认操作',
            type = 'warning',
            confirmText = '确认',
            cancelText = '取消',
            confirmColor = 'primary'
        } = options;

        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        
        const icons = {
            warning: '⚠',
            danger: '✕',
            info: 'ℹ'
        };

        overlay.innerHTML = `
            <div class="modal">
                <div class="modal-header">
                    <div class="modal-icon ${type}">${icons[type] || icons.warning}</div>
                    <h3 class="modal-title">${title}</h3>
                </div>
                <div class="modal-body">${message}</div>
                <div class="modal-actions">
                    <button class="modal-btn modal-btn-secondary" data-action="cancel">${cancelText}</button>
                    <button class="modal-btn modal-btn-${confirmColor}" data-action="confirm">${confirmText}</button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        const handleAction = (action) => {
            overlay.style.animation = 'fadeIn 0.2s ease-out reverse';
            setTimeout(() => {
                overlay.remove();
                resolve(action === 'confirm');
            }, 200);
        };

        overlay.querySelector('[data-action="confirm"]').addEventListener('click', () => handleAction('confirm'));
        overlay.querySelector('[data-action="cancel"]').addEventListener('click', () => handleAction('cancel'));
        
        // 点击遮罩层关闭
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                handleAction('cancel');
            }
        });

        // ESC 键关闭
        const escHandler = (e) => {
            if (e.key === 'Escape') {
                handleAction('cancel');
                document.removeEventListener('keydown', escHandler);
            }
        };
        document.addEventListener('keydown', escHandler);
    });
}

// 简化的提示函数
export function showSuccess(message) {
    return showToast(message, 'success');
}

export function showError(message) {
    return showToast(message, 'error', 5000);
}

export function showWarning(message) {
    return showToast(message, 'warning');
}

export function showInfo(message) {
    return showToast(message, 'info');
}

