// 联系记录模块

import { API_BASE_URL } from '../config.js';
import { fetchWithTimeout } from '../utils.js';
import { getStatusText } from '../config.js';
import { showSuccess, showError, showConfirm } from '../ui.js';
import { getToken } from './auth.js';

// 更新联系记录状态
export async function updateContactStatus(id, status) {
    try {
        const response = await fetchWithTimeout(`${API_BASE_URL}/contacts/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getToken()}`
            },
            body: JSON.stringify({ status })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showSuccess('更新成功');
            loadContacts();
        } else {
            showError('更新失败：' + result.message);
        }
    } catch (error) {
        showError('更新失败：' + error.message);
    }
}

// 删除联系记录
export async function deleteContact(id, name) {
    try {
        // 显示确认对话框
        const confirmed = await showConfirm(
            `确定要删除联系记录 "${name || id.substring(0, 8)}" 吗？此操作不可恢复。`,
            {
                title: '删除联系记录',
                type: 'danger',
                confirmText: '删除',
                cancelText: '取消',
                confirmColor: 'danger'
            }
        );
        
        if (!confirmed) {
            return;
        }
        
        const response = await fetchWithTimeout(`${API_BASE_URL}/contacts/${id}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${getToken()}`
            }
        });
        
        const result = await response.json();
        
        if (result.success) {
            showSuccess('删除成功');
            loadContacts();
        } else {
            showError('删除失败：' + result.message);
        }
    } catch (error) {
        showError('删除失败：' + error.message);
    }
}

// 加载联系记录
export async function loadContacts(showToast = false) {
    const loading = document.getElementById('contactsLoading');
    const table = document.getElementById('contactsTable');
    const cards = document.getElementById('contactsCards');
    const empty = document.getElementById('contactsEmpty');
    const body = document.getElementById('contactsBody');
    
    try {
        loading.style.display = 'block';
        loading.textContent = '加载中...';
        table.style.display = 'none';
        if (cards) cards.style.display = 'none';
        empty.style.display = 'none';
        
        const response = await fetchWithTimeout(`${API_BASE_URL}/contacts`, {
            headers: {
                'Authorization': `Bearer ${getToken()}`
            }
        });
        const result = await response.json();
        
        loading.style.display = 'none';
        
        if (result.success && result.data.length > 0) {
            table.style.display = 'table';
            if (cards) cards.style.display = 'block';
            empty.style.display = 'none';
            body.innerHTML = '';
            if (cards) cards.innerHTML = '';
            
            // 统计数据
            const total = result.data.length;
            const pending = result.data.filter(c => c.status === 'pending').length;
            const processed = result.data.filter(c => c.status === 'processed').length;
            
            document.getElementById('contactsTotal').textContent = total;
            document.getElementById('contactsPending').textContent = pending;
            document.getElementById('contactsProcessed').textContent = processed;
            
            // 渲染表格和卡片
            result.data.forEach(contact => {
                // 桌面端表格行
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${contact.id.substring(0, 8)}...</td>
                    <td>${contact.name}</td>
                    <td>${contact.phone}</td>
                    <td>${contact.email || '-'}</td>
                    <td>${contact.city || '-'}</td>
                    <td style="max-width: 300px; white-space: normal; word-wrap: break-word; word-break: break-all;">${contact.message || '-'}</td>
                    <td>${new Date(contact.createdAt).toLocaleString('zh-CN')}</td>
                    <td><span class="status-badge status-${contact.status}">${getStatusText(contact.status)}</span></td>
                    <td>
                        <div class="table-actions">
                            <button class="btn-small btn-update" onclick="window.contactsModule.updateContactStatus('${contact.id}', 'processed')">已处理</button>
                            <button class="btn-small btn-update" onclick="window.contactsModule.updateContactStatus('${contact.id}', 'archived')">归档</button>
                            <button class="btn-small btn-danger" onclick="window.contactsModule.deleteContact('${contact.id}', '${contact.name.replace(/'/g, "\\'")}')" title="删除记录">删除</button>
                        </div>
                    </td>
                `;
                body.appendChild(row);
                
                // 移动端卡片
                if (cards) {
                    const card = document.createElement('div');
                    card.className = 'record-card';
                    card.innerHTML = `
                        <div class="record-card-header">
                            <div class="record-card-id">ID: ${contact.id.substring(0, 8)}...</div>
                            <span class="status-badge status-${contact.status}">${getStatusText(contact.status)}</span>
                        </div>
                        <div class="record-card-body">
                            <div class="record-field">
                                <div class="record-field-label">姓名</div>
                                <div class="record-field-value">${contact.name}</div>
                            </div>
                            <div class="record-field">
                                <div class="record-field-label">电话</div>
                                <div class="record-field-value">${contact.phone}</div>
                            </div>
                            ${contact.email ? `
                            <div class="record-field">
                                <div class="record-field-label">邮箱</div>
                                <div class="record-field-value">${contact.email}</div>
                            </div>
                            ` : ''}
                            ${contact.city ? `
                            <div class="record-field">
                                <div class="record-field-label">城市</div>
                                <div class="record-field-value">${contact.city}</div>
                            </div>
                            ` : ''}
                            <div class="record-field">
                                <div class="record-field-label">留言内容</div>
                                <div class="record-field-value">${contact.message || '-'}</div>
                            </div>
                            <div class="record-field">
                                <div class="record-field-label">提交时间</div>
                                <div class="record-field-value">${new Date(contact.createdAt).toLocaleString('zh-CN')}</div>
                            </div>
                        </div>
                        <div class="record-card-footer">
                            <div class="record-actions">
                                <button class="btn-small btn-update" onclick="window.contactsModule.updateContactStatus('${contact.id}', 'processed')" style="flex: 1;">已处理</button>
                                <button class="btn-small btn-update" onclick="window.contactsModule.updateContactStatus('${contact.id}', 'archived')" style="flex: 1;">归档</button>
                                <button class="btn-small btn-danger" onclick="window.contactsModule.deleteContact('${contact.id}', '${contact.name.replace(/'/g, "\\'")}')" style="flex: 1;" title="删除记录">删除</button>
                            </div>
                        </div>
                    `;
                    cards.appendChild(card);
                }
            });
        } else {
            // 没有数据时，隐藏表格和卡片，显示空状态，并清空内容和统计数据
            table.style.display = 'none';
            if (cards) cards.style.display = 'none';
            empty.style.display = 'block';
            body.innerHTML = '';
            if (cards) cards.innerHTML = '';
            
            // 清空统计数据
            document.getElementById('contactsTotal').textContent = '0';
            document.getElementById('contactsPending').textContent = '0';
            document.getElementById('contactsProcessed').textContent = '0';
        }
        // 加载成功提示（仅在用户主动刷新时显示）
        if (showToast) {
            showSuccess('联系记录已刷新');
        }
    } catch (error) {
        loading.style.display = 'block';
        loading.textContent = '加载失败：' + (error.message || '网络错误，请检查后端服务是否正常运行');
        showError('加载联系记录失败：' + (error.message || '网络错误'));
    }
}

// 导出模块对象供全局使用
window.contactsModule = {
    loadContacts,
    updateContactStatus,
    deleteContact
};

// 直接导出到全局，供HTML中的onclick使用
window.loadContacts = loadContacts;

