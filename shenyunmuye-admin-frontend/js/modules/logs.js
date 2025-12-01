// 操作日志模块

import { API_BASE_URL, PAGE_LABELS, SECTION_LABELS, FIELD_LABELS } from '../config.js';
import { fetchWithTimeout, formatLabel, escapeHtml } from '../utils.js';
import { showSuccess, showError, showConfirm } from '../ui.js';
import { getToken } from './auth.js';

// 加载日志
export async function loadLogs() {
    const logsList = document.getElementById('logsList');
    if (!logsList) return;
    
    try {
        logsList.innerHTML = '<div class="loading" style="text-align: center; padding: 40px; color: #374151;">加载中...</div>';
        
        const pageFilter = document.getElementById('logsPageFilter')?.value || '';
        const typeFilter = document.getElementById('logsTypeFilter')?.value || '';
        
        const params = new URLSearchParams();
        if (pageFilter) params.append('page', pageFilter);
        if (typeFilter) params.append('action', typeFilter);
        
        const response = await fetchWithTimeout(`${API_BASE_URL}/logs?${params.toString()}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getToken()}`
            }
        });
        const result = await response.json();
        
        if (result.success && result.data && result.data.length > 0) {
            renderLogsList(result.data);
        } else {
            logsList.innerHTML = '<div class="empty" style="text-align: center; padding: 40px; color: #374151;">暂无操作日志</div>';
        }
    } catch (error) {
        logsList.innerHTML = `<div class="empty" style="text-align: center; padding: 40px; color: #ef4444;">加载失败: ${error.message}</div>`;
    }
}

// 渲染日志列表
function renderLogsList(logs) {
    const logsList = document.getElementById('logsList');
    if (!logsList) return;
    
    const ACTION_LABELS = {
        'save': '保存草稿',
        'publish': '发布',
        'reset': '恢复默认'
    };
    
    logsList.innerHTML = logs.map(log => {
        const date = new Date(log.timestamp);
        const dateStr = date.toLocaleString('zh-CN', { 
            year: 'numeric', 
            month: '2-digit', 
            day: '2-digit', 
            hour: '2-digit', 
            minute: '2-digit',
            second: '2-digit'
        });
        
        const pageLabel = PAGE_LABELS[log.page] || log.page;
        const actionLabel = ACTION_LABELS[log.action] || log.action;
        // 获取section的中文标签
        let sectionLabel = '';
        if (log.section) {
            sectionLabel = SECTION_LABELS[log.page]?.[log.section] || formatLabel(log.section, [log.page, log.section], log.page, log.section, FIELD_LABELS);
        }
        
        return `
            <div class="log-item" style="background: var(--card-bg); border: 1px solid var(--border); border-radius: 12px; padding: 20px; margin-bottom: 16px;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
                    <div style="flex: 1;">
                        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px; flex-wrap: wrap;">
                            <input type="checkbox" class="log-checkbox" data-log-id="${log.id}" style="margin-right: 8px; cursor: pointer;">
                            <span style="font-weight: 600; font-size: 16px; color: #1f2937;">${actionLabel}</span>
                            <span style="font-size: 13px; color: #374151;">${pageLabel}${sectionLabel ? ' - ' + sectionLabel : ''}</span>
                        </div>
                        <div style="display: flex; gap: 16px; flex-wrap: wrap; font-size: 12px; color: #374151;">
                            <span>📅 ${dateStr}</span>
                            ${log.user ? `<span>👤 ${log.user}</span>` : ''}
                            ${log.ip ? `<span>🌐 ${log.ip}</span>` : ''}
                        </div>
                    </div>
                </div>
                <div style="margin-top: 16px;">
                    <button class="btn-chip" onclick="window.logsModule.toggleLogDetails('${log.id}')" style="background: #dbeafe; color: #2563eb; font-size: 12px;">
                        查看详情
                    </button>
                </div>
                <div id="log-details-${log.id}" style="display: none; margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--border);">
                    <div class="log-details-grid">
                        <div>
                            <strong style="color: #1f2937; font-size: 13px; display: block; margin-bottom: 8px;">修改前：</strong>
                            <pre id="log-before-${log.id}" style="background: #f8fafc; padding: 12px; border-radius: 8px; font-size: 12px; overflow-x: auto; margin: 0; max-height: 400px; overflow-y: auto; border: 2px solid #e2e8f0; word-wrap: break-word; white-space: pre-wrap;">${JSON.stringify(log.beforeData || {}, null, 2)}</pre>
                        </div>
                        <div>
                            <strong style="color: #1f2937; font-size: 13px; display: block; margin-bottom: 8px;">修改后：</strong>
                            <pre id="log-after-${log.id}" style="background: #f0fdf4; padding: 12px; border-radius: 8px; font-size: 12px; overflow-x: auto; margin: 0; max-height: 400px; overflow-y: auto; border: 2px solid #86efac; word-wrap: break-word; white-space: pre-wrap;">${JSON.stringify(log.afterData || {}, null, 2)}</pre>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    // 渲染完成后初始化全选功能
    setTimeout(() => {
        initSelectAll();
        // 为所有复选框添加事件监听器，更新全选状态
        const checkboxes = document.querySelectorAll('.log-checkbox');
        checkboxes.forEach(cb => {
            cb.addEventListener('change', updateSelectAllState);
        });
        updateSelectAllState(); // 初始化全选状态
    }, 100);
}

// 切换日志详情
export function toggleLogDetails(logId) {
    const detailsEl = document.getElementById(`log-details-${logId}`);
    if (detailsEl) {
        const isVisible = detailsEl.style.display !== 'none';
        detailsEl.style.display = isVisible ? 'none' : 'block';
        
        // 如果展开，高亮差异
        if (!isVisible) {
            setTimeout(() => {
                highlightDifferences(logId);
            }, 100);
        }
    }
}

// 高亮显示差异
function highlightDifferences(logId) {
    const beforeEl = document.getElementById(`log-before-${logId}`);
    const afterEl = document.getElementById(`log-after-${logId}`);
    
    if (!beforeEl || !afterEl) return;
    
    // 如果已经高亮过，不再重复处理
    if (beforeEl.dataset.highlighted === 'true') return;
    
    const beforeText = beforeEl.textContent;
    const afterText = afterEl.textContent;
    
    // 如果内容完全相同，不需要高亮
    if (beforeText === afterText) {
        return;
    }
    
    // 简单的行级差异高亮
    const beforeLines = beforeText.split('\n');
    const afterLines = afterText.split('\n');
    
    // 标记不同的行
    beforeEl.innerHTML = beforeLines.map((line, index) => {
        const afterLine = afterLines[index];
        const isDifferent = line !== afterLine || index >= afterLines.length;
        if (isDifferent) {
            return `<span style="background: #fee2e2; padding: 2px 4px; border-radius: 3px; display: block; width: 100%;">${escapeHtml(line || '')}</span>`;
        }
        return escapeHtml(line);
    }).join('\n');
    
    afterEl.innerHTML = afterLines.map((line, index) => {
        const beforeLine = beforeLines[index];
        const isDifferent = line !== beforeLine || index >= beforeLines.length;
        if (isDifferent) {
            return `<span style="background: #dcfce7; padding: 2px 4px; border-radius: 3px; display: block; width: 100%;">${escapeHtml(line || '')}</span>`;
        }
        return escapeHtml(line);
    }).join('\n');
    
    // 标记已处理
    beforeEl.dataset.highlighted = 'true';
    afterEl.dataset.highlighted = 'true';
}

// 归档选中的日志
export async function archiveSelectedLogs() {
    const checkboxes = document.querySelectorAll('.log-checkbox:checked');
    if (checkboxes.length === 0) {
        showError('请先选择要归档的日志');
        return;
    }
    
    const logIds = Array.from(checkboxes).map(cb => cb.dataset.logId);
    
    const confirmed = await showConfirm(`确定要归档选中的 ${logIds.length} 条日志吗？`);
    if (!confirmed) return;
    
    try {
        const response = await fetchWithTimeout(`${API_BASE_URL}/logs/archive`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getToken()}`
            },
            body: JSON.stringify({ logIds })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showSuccess(result.message || `成功归档 ${logIds.length} 条日志`);
            loadLogs(); // 重新加载日志列表
        } else {
            showError(result.message || '归档失败');
        }
    } catch (error) {
        showError('归档失败：' + error.message);
    }
}

// 打开归档列表模态框
export async function openArchivesModal() {
    const modal = document.getElementById('archivesModal');
    if (!modal) return;
    
    modal.style.display = 'flex';
    await loadArchivesList();
}

// 关闭归档列表模态框
export function closeArchivesModal() {
    const modal = document.getElementById('archivesModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// 加载归档列表
async function loadArchivesList() {
    const archivesList = document.getElementById('archivesList');
    if (!archivesList) return;
    
    try {
        archivesList.innerHTML = '<div style="text-align: center; padding: 40px; color: #374151;">加载中...</div>';
        
        const response = await fetchWithTimeout(`${API_BASE_URL}/logs/archives`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getToken()}`
            }
        });
        
        const result = await response.json();
        
        if (result.success && result.data && result.data.length > 0) {
            renderArchivesList(result.data);
        } else {
            archivesList.innerHTML = '<div style="text-align: center; padding: 40px; color: #374151;">暂无归档记录</div>';
        }
    } catch (error) {
        archivesList.innerHTML = `<div style="text-align: center; padding: 40px; color: #ef4444;">加载失败: ${error.message}</div>`;
    }
}

// 渲染归档列表
function renderArchivesList(archives) {
    const archivesList = document.getElementById('archivesList');
    if (!archivesList) return;
    
    archivesList.innerHTML = archives.map(archive => {
        const date = new Date(archive.archivedAt);
        const dateStr = date.toLocaleString('zh-CN', { 
            year: 'numeric', 
            month: '2-digit', 
            day: '2-digit', 
            hour: '2-digit', 
            minute: '2-digit',
            second: '2-digit'
        });
        
        return `
            <div class="archive-item" style="background: var(--card-bg); border: 1px solid var(--border); border-radius: 12px; padding: 20px; margin-bottom: 16px;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
                    <div style="flex: 1;">
                        <div style="font-weight: 600; font-size: 16px; color: #1f2937; margin-bottom: 8px;">
                            ${archive.fileName}
                        </div>
                        <div style="display: flex; gap: 16px; flex-wrap: wrap; font-size: 12px; color: #374151;">
                            <span>📦 ${archive.logCount} 条日志</span>
                            <span>📅 ${dateStr}</span>
                            ${archive.archivedBy ? `<span>👤 ${archive.archivedBy}</span>` : ''}
                        </div>
                    </div>
                </div>
                <div style="display: flex; gap: 8px; margin-top: 16px;">
                    <button class="btn-chip" onclick="window.logsModule.downloadArchive('${archive.id}')" style="background: #dbeafe; color: #2563eb; font-size: 12px;">
                        📥 下载
                    </button>
                    <button class="btn-chip" onclick="window.logsModule.deleteArchive('${archive.id}')" style="background: #fee2e2; color: #dc2626; font-size: 12px;">
                        🗑️ 删除
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

// 下载归档文件
export async function downloadArchive(archiveId) {
    try {
        const response = await fetchWithTimeout(`${API_BASE_URL}/logs/archives/${archiveId}/download`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${getToken()}`
            }
        });
        
        if (!response.ok) {
            const result = await response.json();
            throw new Error(result.message || '下载失败');
        }
        
        // 获取文件名
        const contentDisposition = response.headers.get('Content-Disposition');
        let filename = 'logs-archive.json';
        if (contentDisposition) {
            const filenameMatch = contentDisposition.match(/filename="?(.+)"?/);
            if (filenameMatch) {
                filename = filenameMatch[1];
            }
        }
        
        // 下载文件
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        
        showSuccess('下载成功');
    } catch (error) {
        showError('下载失败：' + error.message);
    }
}

// 删除归档
export async function deleteArchive(archiveId) {
    const confirmed = await showConfirm('确定要删除这个归档吗？删除后无法恢复。');
    if (!confirmed) return;
    
    try {
        const response = await fetchWithTimeout(`${API_BASE_URL}/logs/archives/${archiveId}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getToken()}`
            }
        });
        
        const result = await response.json();
        
        if (result.success) {
            showSuccess('删除成功');
            loadArchivesList(); // 重新加载归档列表
        } else {
            showError(result.message || '删除失败');
        }
    } catch (error) {
        showError('删除失败：' + error.message);
    }
}

// 初始化全选功能
function initSelectAll() {
    const selectAllCheckbox = document.querySelector('.log-select-all');
    if (!selectAllCheckbox) return;
    
    // 移除旧的事件监听器（如果存在）
    const newSelectAllCheckbox = selectAllCheckbox.cloneNode(true);
    selectAllCheckbox.parentNode.replaceChild(newSelectAllCheckbox, selectAllCheckbox);
    
    newSelectAllCheckbox.addEventListener('change', (e) => {
        const checkboxes = document.querySelectorAll('.log-checkbox');
        checkboxes.forEach(cb => {
            cb.checked = e.target.checked;
        });
    });
}

// 使用事件委托监听单个复选框的变化，更新全选状态
function updateSelectAllState() {
    const selectAllCheckbox = document.querySelector('.log-select-all');
    if (!selectAllCheckbox) return;
    
    const checkboxes = document.querySelectorAll('.log-checkbox');
    const checkedCount = document.querySelectorAll('.log-checkbox:checked').length;
    selectAllCheckbox.checked = checkedCount === checkboxes.length && checkboxes.length > 0;
    selectAllCheckbox.indeterminate = checkedCount > 0 && checkedCount < checkboxes.length;
}

// 初始化日志模块事件
export function initLogsModule() {
    const logsRefreshBtn = document.getElementById('logsRefreshBtn');
    if (logsRefreshBtn) {
        logsRefreshBtn.addEventListener('click', () => {
            loadLogs();
        });
    }
    
    const logsPageFilter = document.getElementById('logsPageFilter');
    const logsTypeFilter = document.getElementById('logsTypeFilter');
    if (logsPageFilter) {
        logsPageFilter.addEventListener('change', () => {
            loadLogs();
        });
    }
    if (logsTypeFilter) {
        logsTypeFilter.addEventListener('change', () => {
            loadLogs();
        });
    }
    
    // 绑定归档按钮
    const logsArchiveBtn = document.getElementById('logsArchiveBtn');
    if (logsArchiveBtn) {
        logsArchiveBtn.addEventListener('click', () => {
            archiveSelectedLogs();
        });
    }
    
    // 绑定查看归档按钮
    const logsArchivesBtn = document.getElementById('logsArchivesBtn');
    if (logsArchivesBtn) {
        logsArchivesBtn.addEventListener('click', () => {
            openArchivesModal();
        });
    }
    
    // 初始化全选功能（首次加载）
    initSelectAll();
}

// 导出模块对象供全局使用
window.logsModule = {
    loadLogs,
    toggleLogDetails,
    archiveSelectedLogs,
    openArchivesModal,
    closeArchivesModal,
    downloadArchive,
    deleteArchive
};

// 为了兼容 HTML 中的 onclick 属性，也直接导出到 window
window.closeArchivesModal = closeArchivesModal;

