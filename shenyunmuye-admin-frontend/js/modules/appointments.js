// 预约记录模块

import { API_BASE_URL } from '../config.js';
import { fetchWithTimeout } from '../utils.js';
import { getAppointmentStatusText } from '../config.js';
import { showSuccess, showError, showConfirm } from '../ui.js';
import { getToken } from './auth.js';

// 更新预约记录状态
export async function updateAppointmentStatus(id, status) {
    try {
        const response = await fetchWithTimeout(`${API_BASE_URL}/appointments/${id}`, {
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
            loadAppointments();
        } else {
            showError('更新失败：' + result.message);
        }
    } catch (error) {
        showError('更新失败：' + error.message);
    }
}

// 删除预约记录
export async function deleteAppointment(id, name) {
    try {
        // 显示确认对话框
        const confirmed = await showConfirm(
            `确定要删除预约记录 "${name || id.substring(0, 8)}" 吗？此操作不可恢复。`,
            {
                title: '删除预约记录',
                type: 'danger',
                confirmText: '删除',
                cancelText: '取消',
                confirmColor: 'danger'
            }
        );
        
        if (!confirmed) {
            return;
        }
        
        const response = await fetchWithTimeout(`${API_BASE_URL}/appointments/${id}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${getToken()}`
            }
        });
        
        const result = await response.json();
        
        if (result.success) {
            showSuccess('删除成功');
            loadAppointments();
        } else {
            showError('删除失败：' + result.message);
        }
    } catch (error) {
        showError('删除失败：' + error.message);
    }
}

// 加载预约记录
export async function loadAppointments(showToast = false) {
    const loading = document.getElementById('appointmentsLoading');
    const table = document.getElementById('appointmentsTable');
    const cards = document.getElementById('appointmentsCards');
    const empty = document.getElementById('appointmentsEmpty');
    const body = document.getElementById('appointmentsBody');
    
    try {
        loading.style.display = 'block';
        loading.textContent = '加载中...';
        table.style.display = 'none';
        if (cards) cards.style.display = 'none';
        empty.style.display = 'none';
        
        const response = await fetchWithTimeout(`${API_BASE_URL}/appointments`, {
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
            const pending = result.data.filter(a => a.status === 'pending').length;
            const confirmed = result.data.filter(a => a.status === 'confirmed').length;
            
            document.getElementById('appointmentsTotal').textContent = total;
            document.getElementById('appointmentsPending').textContent = pending;
            document.getElementById('appointmentsConfirmed').textContent = confirmed;
            
            // 渲染表格和卡片
            result.data.forEach(appointment => {
                // 桌面端表格行
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${appointment.id.substring(0, 8)}...</td>
                    <td>${appointment.name}</td>
                    <td>${appointment.phone}</td>
                    <td>${appointment.city || '-'}</td>
                    <td>${appointment.area || '-'}</td>
                    <td style="max-width: 300px; white-space: normal; word-wrap: break-word; word-break: break-all;">${appointment.description || '-'}</td>
                    <td>${new Date(appointment.createdAt).toLocaleString('zh-CN')}</td>
                    <td><span class="status-badge status-${appointment.status}">${getAppointmentStatusText(appointment.status)}</span></td>
                    <td>
                        <div class="table-actions">
                            <button class="btn-small btn-update" onclick="window.appointmentsModule.updateAppointmentStatus('${appointment.id}', 'contacted')">已联系</button>
                            <button class="btn-small btn-update" onclick="window.appointmentsModule.updateAppointmentStatus('${appointment.id}', 'confirmed')">已确认</button>
                            <button class="btn-small btn-update" onclick="window.appointmentsModule.updateAppointmentStatus('${appointment.id}', 'completed')">已完成</button>
                            <button class="btn-small btn-danger" onclick="window.appointmentsModule.deleteAppointment('${appointment.id}', '${appointment.name.replace(/'/g, "\\'")}')" title="删除记录">删除</button>
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
                            <div class="record-card-id">ID: ${appointment.id.substring(0, 8)}...</div>
                            <span class="status-badge status-${appointment.status}">${getAppointmentStatusText(appointment.status)}</span>
                        </div>
                        <div class="record-card-body">
                            <div class="record-field">
                                <div class="record-field-label">姓名</div>
                                <div class="record-field-value">${appointment.name}</div>
                            </div>
                            <div class="record-field">
                                <div class="record-field-label">电话</div>
                                <div class="record-field-value">${appointment.phone}</div>
                            </div>
                            ${appointment.city ? `
                            <div class="record-field">
                                <div class="record-field-label">城市</div>
                                <div class="record-field-value">${appointment.city}</div>
                            </div>
                            ` : ''}
                            ${appointment.area ? `
                            <div class="record-field">
                                <div class="record-field-label">房屋面积</div>
                                <div class="record-field-value">${appointment.area}</div>
                            </div>
                            ` : ''}
                            <div class="record-field">
                                <div class="record-field-label">需求描述</div>
                                <div class="record-field-value">${appointment.description || '-'}</div>
                            </div>
                            <div class="record-field">
                                <div class="record-field-label">提交时间</div>
                                <div class="record-field-value">${new Date(appointment.createdAt).toLocaleString('zh-CN')}</div>
                            </div>
                        </div>
                        <div class="record-card-footer">
                            <div class="record-actions">
                                <button class="btn-small btn-update" onclick="window.appointmentsModule.updateAppointmentStatus('${appointment.id}', 'contacted')" style="flex: 1;">已联系</button>
                                <button class="btn-small btn-update" onclick="window.appointmentsModule.updateAppointmentStatus('${appointment.id}', 'confirmed')" style="flex: 1;">已确认</button>
                                <button class="btn-small btn-update" onclick="window.appointmentsModule.updateAppointmentStatus('${appointment.id}', 'completed')" style="flex: 1;">已完成</button>
                                <button class="btn-small btn-danger" onclick="window.appointmentsModule.deleteAppointment('${appointment.id}', '${appointment.name.replace(/'/g, "\\'")}')" style="flex: 1;" title="删除记录">删除</button>
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
            document.getElementById('appointmentsTotal').textContent = '0';
            document.getElementById('appointmentsPending').textContent = '0';
            document.getElementById('appointmentsConfirmed').textContent = '0';
        }
        // 加载成功提示（仅在用户主动刷新时显示）
        if (showToast) {
            showSuccess('预约记录已刷新');
        }
    } catch (error) {
        loading.style.display = 'block';
        loading.textContent = '加载失败：' + (error.message || '网络错误，请检查后端服务是否正常运行');
        showError('加载预约记录失败：' + (error.message || '网络错误'));
    }
}

// 导出模块对象供全局使用
window.appointmentsModule = {
    loadAppointments,
    updateAppointmentStatus,
    deleteAppointment
};

// 直接导出到全局，供HTML中的onclick使用
window.loadAppointments = loadAppointments;

