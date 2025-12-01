// 用户管理模块

import { API_BASE_URL } from '../config.js';
import { fetchWithTimeout } from '../utils.js';
import { showSuccess, showError, showConfirm } from '../ui.js';
import { getToken } from './auth.js';

// 加载用户列表
export async function loadUsers() {
    const usersBody = document.getElementById('usersBody');
    const usersCards = document.getElementById('usersCards');
    const usersLoading = document.getElementById('usersLoading');
    const usersTable = document.getElementById('usersTable');
    const usersEmpty = document.getElementById('usersEmpty');
    
    if (!usersBody) return;
    
    try {
        if (usersLoading) usersLoading.style.display = 'block';
        if (usersTable) usersTable.style.display = 'none';
        if (usersCards) usersCards.style.display = 'none';
        if (usersEmpty) usersEmpty.style.display = 'none';
        
        const response = await fetchWithTimeout(`${API_BASE_URL}/users`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getToken()}`
            }
        });
        
        const result = await response.json();
        
        if (result.success && result.data) {
            const users = result.data;
            updateUserStats(users);
            renderUsersList(users);
        } else {
            if (usersEmpty) usersEmpty.style.display = 'block';
        }
    } catch (error) {
        showError('加载用户列表失败：' + error.message);
        if (usersEmpty) usersEmpty.style.display = 'block';
    } finally {
        if (usersLoading) usersLoading.style.display = 'none';
    }
}

// 更新用户统计
function updateUserStats(users) {
    const totalEl = document.getElementById('usersTotal');
    const adminEl = document.getElementById('usersAdmin');
    const normalEl = document.getElementById('usersNormal');
    
    if (totalEl) totalEl.textContent = users.length;
    if (adminEl) adminEl.textContent = users.filter(u => u.role === 'admin').length;
    if (normalEl) normalEl.textContent = users.filter(u => u.role === 'user').length;
}

// 渲染用户列表
function renderUsersList(users) {
    const usersBody = document.getElementById('usersBody');
    const usersCards = document.getElementById('usersCards');
    const usersTable = document.getElementById('usersTable');
    const usersEmpty = document.getElementById('usersEmpty');
    
    if (!usersBody) return;
    
    if (users.length === 0) {
        if (usersEmpty) usersEmpty.style.display = 'block';
        if (usersTable) usersTable.style.display = 'none';
        if (usersCards) usersCards.style.display = 'none';
        return;
    }
    
    // 桌面端表格
    if (usersBody) {
        usersBody.innerHTML = users.map(user => {
            const createdAt = user.createdAt ? new Date(user.createdAt).toLocaleString('zh-CN') : '-';
            const lastLogin = user.lastLogin ? new Date(user.lastLogin).toLocaleString('zh-CN') : '-';
            const roleLabel = user.role === 'admin' ? '管理员' : '普通用户';
            const roleClass = user.role === 'admin' ? 'status-badge status-success' : 'status-badge status-pending';
            
            return `
                <tr>
                    <td>${user.id}</td>
                    <td>${escapeHtml(user.username)}</td>
                    <td><span class="${roleClass}">${roleLabel}</span></td>
                    <td>${createdAt}</td>
                    <td>${lastLogin}</td>
                    <td>
                        <button class="btn-chip" onclick="window.usersModule.editPassword('${user.id}', '${escapeHtml(user.username)}')" style="background: #dbeafe; color: #2563eb; font-size: 12px; margin-right: 8px;">修改密码</button>
                        ${user.role !== 'admin' || users.filter(u => u.role === 'admin').length > 1 ? 
                            `<button class="btn-chip" onclick="window.usersModule.deleteUser('${user.id}', '${escapeHtml(user.username)}')" style="background: #fee2e2; color: #dc2626; font-size: 12px;">删除</button>` 
                            : '<span style="color: #9ca3af; font-size: 12px;">不可删除</span>'
                        }
                    </td>
                </tr>
            `;
        }).join('');
    }
    
    // 移动端卡片
    if (usersCards) {
        usersCards.innerHTML = users.map(user => {
            const createdAt = user.createdAt ? new Date(user.createdAt).toLocaleString('zh-CN') : '-';
            const lastLogin = user.lastLogin ? new Date(user.lastLogin).toLocaleString('zh-CN') : '-';
            const roleLabel = user.role === 'admin' ? '管理员' : '普通用户';
            const roleClass = user.role === 'admin' ? 'status-badge status-success' : 'status-badge status-pending';
            const canDelete = user.role !== 'admin' || users.filter(u => u.role === 'admin').length > 1;
            
            return `
                <div class="mobile-card" style="background: var(--card-bg); border: 1px solid var(--border); border-radius: 12px; padding: 16px; margin-bottom: 12px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                        <div>
                            <div style="font-weight: 600; font-size: 16px; color: #1f2937; margin-bottom: 4px;">${escapeHtml(user.username)}</div>
                            <span class="${roleClass}">${roleLabel}</span>
                        </div>
                        <div style="font-size: 12px; color: #6b7280;">ID: ${user.id}</div>
                    </div>
                    <div style="font-size: 13px; color: #374151; margin-bottom: 12px;">
                        <div style="margin-bottom: 4px;">📅 创建时间：${createdAt}</div>
                        <div>🔐 最后登录：${lastLogin}</div>
                    </div>
                    <div style="display: flex; gap: 8px;">
                        <button class="btn-chip" onclick="window.usersModule.editPassword('${user.id}', '${escapeHtml(user.username)}')" style="flex: 1; background: #dbeafe; color: #2563eb; font-size: 12px;">修改密码</button>
                        ${canDelete ? 
                            `<button class="btn-chip" onclick="window.usersModule.deleteUser('${user.id}', '${escapeHtml(user.username)}')" style="flex: 1; background: #fee2e2; color: #dc2626; font-size: 12px;">删除</button>` 
                            : '<span style="flex: 1; text-align: center; color: #9ca3af; font-size: 12px;">不可删除</span>'
                        }
                    </div>
                </div>
            `;
        }).join('');
    }
    
    // 显示表格或卡片
    const isMobile = window.innerWidth <= 768;
    if (isMobile && usersCards) {
        usersCards.style.display = 'block';
        if (usersTable) usersTable.style.display = 'none';
    } else if (usersTable) {
        usersTable.style.display = 'table';
        if (usersCards) usersCards.style.display = 'none';
    }
}

// 创建用户
export async function createUser() {
    const modal = document.getElementById('userModal');
    const form = document.getElementById('userForm');
    const modalTitle = document.getElementById('userModalTitle');
    
    if (!modal || !form) return;
    
    // 重置表单
    form.reset();
    document.getElementById('userId').value = '';
    if (modalTitle) modalTitle.textContent = '创建用户';
    
    // 确保角色选择框可用且默认选择管理员
    const userRoleSelect = document.getElementById('newUserRole');
    if (userRoleSelect) {
        userRoleSelect.disabled = false;
        userRoleSelect.value = 'admin'; // 默认选择管理员
    }
    
    modal.style.display = 'flex';
    
    // 绑定提交事件
    form.onsubmit = async (e) => {
        e.preventDefault();
        
        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value;
        const role = document.getElementById('newUserRole').value;
        
        if (!username || !password) {
            showError('用户名和密码不能为空');
            return;
        }
        
        try {
            const response = await fetchWithTimeout(`${API_BASE_URL}/users`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${getToken()}`
                },
                body: JSON.stringify({ username, password, role })
            });
            
            const result = await response.json();
            
            if (result.success) {
                showSuccess('用户创建成功');
                closeUserModal();
                loadUsers();
                // 记录用户日志
                recordUserLog('create_user', { username, role });
            } else {
                showError(result.message || '创建用户失败');
            }
        } catch (error) {
            showError('创建用户失败：' + error.message);
        }
    };
}

// 删除用户
export async function deleteUser(userId, username) {
    const confirmed = await showConfirm(`确定要删除用户 "${username}" 吗？此操作不可恢复。`);
    if (!confirmed) return;
    
    try {
        const response = await fetchWithTimeout(`${API_BASE_URL}/users/${userId}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getToken()}`
            }
        });
        
        const result = await response.json();
        
        if (result.success) {
            showSuccess('用户删除成功');
            loadUsers();
            // 记录用户日志
            recordUserLog('delete_user', { username });
        } else {
            showError(result.message || '删除用户失败');
        }
    } catch (error) {
        showError('删除用户失败：' + error.message);
    }
}

// 修改密码
export async function editPassword(userId, username) {
    const modal = document.getElementById('passwordModal');
    const form = document.getElementById('passwordForm');
    
    if (!modal || !form) return;
    
    // 重置表单
    form.reset();
    document.getElementById('passwordUserId').value = userId;
    
    modal.style.display = 'flex';
    
    // 绑定提交事件
    form.onsubmit = async (e) => {
        e.preventDefault();
        
        const newPassword = document.getElementById('newPassword').value;
        
        if (!newPassword) {
            showError('新密码不能为空');
            return;
        }
        
        if (newPassword.length < 6) {
            showError('密码长度至少6位');
            return;
        }
        
        try {
            const response = await fetchWithTimeout(`${API_BASE_URL}/users/${userId}/password`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${getToken()}`
                },
                body: JSON.stringify({ password: newPassword })
            });
            
            const result = await response.json();
            
            if (result.success) {
                showSuccess('密码修改成功');
                closePasswordModal();
                // 记录用户日志
                recordUserLog('change_password', { username, targetUserId: userId });
            } else {
                showError(result.message || '修改密码失败');
            }
        } catch (error) {
            showError('修改密码失败：' + error.message);
        }
    };
}

// 关闭用户模态框
export function closeUserModal() {
    const modal = document.getElementById('userModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// 关闭密码模态框
export function closePasswordModal() {
    const modal = document.getElementById('passwordModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// 加载用户日志
export async function loadUserLogs() {
    const userLogsList = document.getElementById('userLogsList');
    const userLogsLoading = document.getElementById('userLogsLoading');
    const userLogsEmpty = document.getElementById('userLogsEmpty');
    
    if (!userLogsList) return;
    
    try {
        if (userLogsLoading) userLogsLoading.style.display = 'block';
        if (userLogsList) userLogsList.style.display = 'none';
        if (userLogsEmpty) userLogsEmpty.style.display = 'none';
        
        const response = await fetchWithTimeout(`${API_BASE_URL}/users/logs`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getToken()}`
            }
        });
        
        const result = await response.json();
        
        if (result.success && result.data && result.data.length > 0) {
            renderUserLogsList(result.data);
        } else {
            if (userLogsEmpty) userLogsEmpty.style.display = 'block';
        }
    } catch (error) {
        showError('加载用户日志失败：' + error.message);
        if (userLogsEmpty) userLogsEmpty.style.display = 'block';
    } finally {
        if (userLogsLoading) userLogsLoading.style.display = 'none';
    }
}

// 渲染用户日志列表
function renderUserLogsList(logs) {
    const userLogsList = document.getElementById('userLogsList');
    const userLogsEmpty = document.getElementById('userLogsEmpty');
    
    if (!userLogsList) return;
    
    const ACTION_LABELS = {
        'create_user': '创建用户',
        'delete_user': '删除用户',
        'change_password': '修改密码',
        'login': '登录',
        'logout': '登出'
    };
    
    // 详情字段翻译映射
    const DETAIL_LABELS = {
        'username': '用户名',
        'role': '角色',
        'targetUserId': '目标用户ID',
        'isSelf': '是否为自己',
        'admin': '管理员',
        'user': '普通用户',
        'true': '是',
        'false': '否'
    };
    
    // 将详情对象翻译成中文
    function translateDetails(details) {
        if (!details || typeof details !== 'object') {
            return details;
        }
        
        const translated = {};
        for (const [key, value] of Object.entries(details)) {
            const translatedKey = DETAIL_LABELS[key] || key;
            let translatedValue = value;
            
            // 翻译值
            if (typeof value === 'string') {
                translatedValue = DETAIL_LABELS[value] || value;
            } else if (typeof value === 'boolean') {
                translatedValue = value ? '是' : '否';
            } else if (typeof value === 'object' && value !== null) {
                translatedValue = translateDetails(value);
            }
            
            translated[translatedKey] = translatedValue;
        }
        
        return translated;
    }
    
    userLogsList.innerHTML = logs.map(log => {
        const date = new Date(log.timestamp);
        const dateStr = date.toLocaleString('zh-CN', { 
            year: 'numeric', 
            month: '2-digit', 
            day: '2-digit', 
            hour: '2-digit', 
            minute: '2-digit',
            second: '2-digit'
        });
        
        const actionLabel = ACTION_LABELS[log.action] || log.action;
        
        // 翻译详情
        let detailsText = '';
        if (log.details) {
            const translatedDetails = translateDetails(log.details);
            detailsText = JSON.stringify(translatedDetails, null, 2);
        }
        
        return `
            <div class="log-item" style="background: var(--card-bg); border: 1px solid var(--border); border-radius: 12px; padding: 20px; margin-bottom: 16px;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
                    <div style="flex: 1;">
                        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px; flex-wrap: wrap;">
                            <input type="checkbox" class="user-log-checkbox" data-log-id="${log.id}" style="cursor: pointer; margin-right: 8px;">
                            <span style="font-weight: 600; font-size: 16px; color: #1f2937;">${actionLabel}</span>
                        </div>
                        <div style="display: flex; gap: 16px; flex-wrap: wrap; font-size: 12px; color: #374151;">
                            <span>📅 ${dateStr}</span>
                            ${log.user ? `<span>👤 ${log.user}</span>` : ''}
                            ${log.ip ? `<span>🌐 ${log.ip}</span>` : ''}
                        </div>
                    </div>
                </div>
                ${detailsText ? `
                    <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--border);">
                        <strong style="color: #1f2937; font-size: 13px; display: block; margin-bottom: 8px;">操作详情：</strong>
                        <pre style="background: #f8fafc; padding: 12px; border-radius: 8px; font-size: 12px; overflow-x: auto; margin: 0; max-height: 200px; overflow-y: auto; border: 1px solid #e2e8f0; word-wrap: break-word; white-space: pre-wrap;">${escapeHtml(detailsText)}</pre>
                    </div>
                ` : ''}
                <div style="margin-top: 16px; display: flex; gap: 8px; justify-content: flex-end;">
                    <button class="btn-chip" onclick="window.usersModule.deleteUserLog('${log.id}')" style="background: #fee2e2; color: #dc2626; font-size: 12px;">
                        🗑️ 删除
                    </button>
                </div>
            </div>
        `;
    }).join('');
    
    userLogsList.style.display = 'block';
    if (userLogsEmpty) userLogsEmpty.style.display = 'none';
    
    // 初始化全选功能
    setTimeout(() => {
        initUserLogSelectAll();
        // 为所有复选框添加事件监听器，更新全选状态
        const checkboxes = document.querySelectorAll('.user-log-checkbox');
        checkboxes.forEach(cb => {
            cb.addEventListener('change', updateUserLogSelectAllState);
        });
        updateUserLogSelectAllState(); // 初始化全选状态
    }, 100);
}

// 记录用户日志
async function recordUserLog(action, details = {}) {
    try {
        await fetchWithTimeout(`${API_BASE_URL}/users/logs`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getToken()}`
            },
            body: JSON.stringify({
                action,
                details,
                timestamp: new Date().toISOString()
            })
        });
    } catch (error) {
        // 日志记录失败不影响主操作
    }
}

// HTML转义
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 初始化用户管理模块
export function initUsersModule() {
    // 绑定创建用户按钮
    const createUserBtn = document.getElementById('createUserBtn');
    if (createUserBtn) {
        createUserBtn.addEventListener('click', createUser);
    }
    
    // 绑定刷新用户日志按钮
    const refreshUserLogsBtn = document.getElementById('refreshUserLogsBtn');
    if (refreshUserLogsBtn) {
        refreshUserLogsBtn.addEventListener('click', loadUserLogs);
    }
    
    // 绑定批量删除用户日志按钮
    const deleteSelectedUserLogsBtn = document.getElementById('deleteSelectedUserLogsBtn');
    if (deleteSelectedUserLogsBtn) {
        deleteSelectedUserLogsBtn.addEventListener('click', deleteSelectedUserLogs);
    }
    
    // 点击模态框外部关闭
    const userModal = document.getElementById('userModal');
    const passwordModal = document.getElementById('passwordModal');
    
    if (userModal) {
        userModal.addEventListener('click', (e) => {
            if (e.target === userModal) {
                closeUserModal();
            }
        });
    }
    
    if (passwordModal) {
        passwordModal.addEventListener('click', (e) => {
            if (e.target === passwordModal) {
                closePasswordModal();
            }
        });
    }
}

// 删除用户日志
export async function deleteUserLog(logId) {
    const confirmed = await showConfirm('确定要删除这条用户日志吗？此操作不可恢复。');
    if (!confirmed) return;
    
    try {
        const response = await fetchWithTimeout(`${API_BASE_URL}/users/logs/${logId}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getToken()}`
            }
        });
        
        // 检查响应状态
        if (!response.ok) {
            const errorText = await response.text();
            try {
                const errorJson = JSON.parse(errorText);
                throw new Error(errorJson.message || '删除失败');
            } catch {
                throw new Error(`删除失败: ${response.status} ${response.statusText}`);
            }
        }
        
        const result = await response.json();
        
        if (result.success) {
            showSuccess('用户日志删除成功');
            loadUserLogs(); // 重新加载日志列表
        } else {
            showError(result.message || '删除用户日志失败');
        }
    } catch (error) {
        showError('删除用户日志失败：' + error.message);
    }
}

// 批量删除用户日志
export async function deleteSelectedUserLogs() {
    const checkboxes = document.querySelectorAll('.user-log-checkbox:checked');
    if (checkboxes.length === 0) {
        showError('请先选择要删除的用户日志');
        return;
    }
    
    const logIds = Array.from(checkboxes).map(cb => cb.dataset.logId);
    
    const confirmed = await showConfirm(`确定要删除选中的 ${logIds.length} 条用户日志吗？此操作不可恢复。`);
    if (!confirmed) return;
    
    try {
        const response = await fetchWithTimeout(`${API_BASE_URL}/users/logs/batch`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getToken()}`
            },
            body: JSON.stringify({ logIds })
        });
        
        // 检查响应状态
        if (!response.ok) {
            const errorText = await response.text();
            try {
                const errorJson = JSON.parse(errorText);
                throw new Error(errorJson.message || '批量删除失败');
            } catch {
                throw new Error(`批量删除失败: ${response.status} ${response.statusText}`);
            }
        }
        
        const result = await response.json();
        
        if (result.success) {
            showSuccess(`成功删除 ${result.deletedCount || logIds.length} 条用户日志`);
            loadUserLogs(); // 重新加载日志列表
        } else {
            showError(result.message || '批量删除用户日志失败');
        }
    } catch (error) {
        showError('批量删除用户日志失败：' + error.message);
    }
}

// 初始化用户日志全选功能
function initUserLogSelectAll() {
    const selectAllCheckbox = document.querySelector('.user-log-select-all');
    if (!selectAllCheckbox) return;
    
    // 移除旧的事件监听器（如果存在）
    const newSelectAllCheckbox = selectAllCheckbox.cloneNode(true);
    selectAllCheckbox.parentNode.replaceChild(newSelectAllCheckbox, selectAllCheckbox);
    
    newSelectAllCheckbox.addEventListener('change', (e) => {
        const checkboxes = document.querySelectorAll('.user-log-checkbox');
        checkboxes.forEach(cb => {
            cb.checked = e.target.checked;
        });
    });
}

// 更新用户日志全选状态
function updateUserLogSelectAllState() {
    const selectAllCheckbox = document.querySelector('.user-log-select-all');
    if (!selectAllCheckbox) return;
    
    const checkboxes = document.querySelectorAll('.user-log-checkbox');
    const checkedCount = document.querySelectorAll('.user-log-checkbox:checked').length;
    selectAllCheckbox.checked = checkedCount === checkboxes.length && checkboxes.length > 0;
    selectAllCheckbox.indeterminate = checkedCount > 0 && checkedCount < checkboxes.length;
}

// 导出模块对象供全局使用
window.usersModule = {
    loadUsers,
    createUser,
    deleteUser,
    editPassword,
    closeUserModal,
    closePasswordModal,
    loadUserLogs,
    deleteUserLog,
    deleteSelectedUserLogs
};

// 为了兼容 HTML 中的 onclick 属性，也直接导出到 window
window.closeUserModal = closeUserModal;
window.closePasswordModal = closePasswordModal;

