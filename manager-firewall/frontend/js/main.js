// 主应用逻辑

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    initAuth();
    initTabs();
    initWhitelist();
    initBlacklist();
    initNginx();
    initModal();
});

// 标签页切换
function initTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabName = btn.dataset.tab;
            
            // 更新按钮状态
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // 更新内容显示
            tabContents.forEach(content => {
                content.classList.remove('active');
            });
            document.getElementById(`${tabName}-tab`).classList.add('active');
            
            // 加载对应数据
            if (tabName === 'whitelist') {
                loadWhitelist();
            } else if (tabName === 'blacklist') {
                loadBlacklist();
            }
        });
    });
}

// 白名单管理
let currentListType = null;

function initWhitelist() {
    loadWhitelist();
    
    document.getElementById('addWhitelistBtn').addEventListener('click', () => {
        currentListType = 'whitelist';
        showAddModal('添加白名单 IP', false);
    });
}

async function loadWhitelist() {
    const tbody = document.getElementById('whitelistTableBody');
    tbody.innerHTML = '<tr><td colspan="2" class="loading">加载中...</td></tr>';
    
    try {
        const response = await fetch(`${API_BASE_URL}/whitelist`, {
            headers: getAuthHeaders()
        });
        
        const result = await response.json();
        
        if (result.success) {
            if (result.data.length === 0) {
                tbody.innerHTML = '<tr><td colspan="2" class="loading">暂无数据</td></tr>';
            } else {
                tbody.innerHTML = result.data.map(ip => `
                    <tr>
                        <td>${escapeHtml(ip)}</td>
                        <td>
                            <button class="btn-danger" onclick="deleteWhitelist('${escapeHtml(ip)}')">删除</button>
                        </td>
                    </tr>
                `).join('');
            }
        } else {
            tbody.innerHTML = '<tr><td colspan="2" class="loading">加载失败</td></tr>';
        }
    } catch (error) {
        console.error('加载白名单失败:', error);
        tbody.innerHTML = '<tr><td colspan="2" class="loading">加载失败</td></tr>';
    }
}

window.deleteWhitelist = async function(ip) {
    if (!confirm(`确认删除白名单 IP: ${ip}？`)) {
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/whitelist/${encodeURIComponent(ip)}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });
        
        const result = await response.json();
        
        if (result.success) {
            alert('删除成功');
            loadWhitelist();
        } else {
            alert('删除失败: ' + result.message);
        }
    } catch (error) {
        console.error('删除白名单失败:', error);
        alert('删除失败');
    }
};

// 黑名单管理
function initBlacklist() {
    loadBlacklist();
    
    document.getElementById('addBlacklistBtn').addEventListener('click', () => {
        currentListType = 'blacklist';
        showAddModal('添加黑名单 IP', true);
    });
}

async function loadBlacklist() {
    const tbody = document.getElementById('blacklistTableBody');
    tbody.innerHTML = '<tr><td colspan="3" class="loading">加载中...</td></tr>';
    
    try {
        const response = await fetch(`${API_BASE_URL}/blacklist`, {
            headers: getAuthHeaders()
        });
        
        const result = await response.json();
        
        if (result.success) {
            if (result.data.length === 0) {
                tbody.innerHTML = '<tr><td colspan="3" class="loading">暂无数据</td></tr>';
            } else {
                tbody.innerHTML = result.data.map(item => `
                    <tr>
                        <td>${escapeHtml(item.ip)}</td>
                        <td>${escapeHtml(item.comment || '')}</td>
                        <td>
                            <button class="btn-danger" onclick="deleteBlacklist('${escapeHtml(item.ip)}')">删除</button>
                        </td>
                    </tr>
                `).join('');
            }
        } else {
            tbody.innerHTML = '<tr><td colspan="3" class="loading">加载失败</td></tr>';
        }
    } catch (error) {
        console.error('加载黑名单失败:', error);
        tbody.innerHTML = '<tr><td colspan="3" class="loading">加载失败</td></tr>';
    }
}

window.deleteBlacklist = async function(ip) {
    if (!confirm(`确认删除黑名单 IP: ${ip}？`)) {
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/blacklist/${encodeURIComponent(ip)}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });
        
        const result = await response.json();
        
        if (result.success) {
            alert('删除成功');
            loadBlacklist();
        } else {
            alert('删除失败: ' + result.message);
        }
    } catch (error) {
        console.error('删除黑名单失败:', error);
        alert('删除失败');
    }
};

// Nginx 配置管理
function initNginx() {
    document.getElementById('testNginxBtn').addEventListener('click', testNginx);
    document.getElementById('reloadNginxBtn').addEventListener('click', reloadNginx);
}

async function testNginx() {
    const resultBox = document.getElementById('nginxResult');
    resultBox.textContent = '测试中...';
    resultBox.className = 'result-box';
    
    try {
        const response = await fetch(`${API_BASE_URL}/nginx/test`, {
            headers: getAuthHeaders()
        });
        
        const result = await response.json();
        
        if (result.success) {
            resultBox.textContent = result.output || result.message;
            resultBox.classList.add('success');
        } else {
            resultBox.textContent = result.error || result.message;
            resultBox.classList.add('error');
        }
    } catch (error) {
        resultBox.textContent = '测试失败: ' + error.message;
        resultBox.classList.add('error');
    }
}

async function reloadNginx() {
    if (!confirm('确认重载 Nginx 配置？这将使所有更改立即生效。')) {
        return;
    }
    
    const resultBox = document.getElementById('nginxResult');
    resultBox.textContent = '重载中...';
    resultBox.className = 'result-box';
    
    try {
        const response = await fetch(`${API_BASE_URL}/nginx/reload`, {
            method: 'POST',
            headers: getAuthHeaders()
        });
        
        const result = await response.json();
        
        if (result.success) {
            resultBox.textContent = result.message;
            resultBox.classList.add('success');
        } else {
            resultBox.textContent = result.error || result.message;
            resultBox.classList.add('error');
        }
    } catch (error) {
        resultBox.textContent = '重载失败: ' + error.message;
        resultBox.classList.add('error');
    }
}

// 模态框管理
function initModal() {
    const modal = document.getElementById('addIPModal');
    const closeBtn = document.getElementById('closeModalBtn');
    const cancelBtn = document.getElementById('cancelBtn');
    const form = document.getElementById('addIPForm');
    
    closeBtn.addEventListener('click', () => {
        modal.classList.remove('show');
    });
    
    cancelBtn.addEventListener('click', () => {
        modal.classList.remove('show');
    });
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.remove('show');
        }
    });
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const ip = document.getElementById('ipAddress').value.trim();
        const comment = document.getElementById('ipComment').value.trim();
        
        if (!ip) {
            alert('请输入 IP 地址');
            return;
        }
        
        try {
            const url = currentListType === 'whitelist' 
                ? `${API_BASE_URL}/whitelist`
                : `${API_BASE_URL}/blacklist`;
            
            const body = currentListType === 'whitelist'
                ? { ip }
                : { ip, comment };
            
            const response = await fetch(url, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify(body)
            });
            
            const result = await response.json();
            
            if (result.success) {
                alert('添加成功');
                modal.classList.remove('show');
                form.reset();
                
                if (currentListType === 'whitelist') {
                    loadWhitelist();
                } else {
                    loadBlacklist();
                }
            } else {
                alert('添加失败: ' + result.message);
            }
        } catch (error) {
            console.error('添加失败:', error);
            alert('添加失败');
        }
    });
}

function showAddModal(title, showComment) {
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('commentGroup').style.display = showComment ? 'block' : 'none';
    document.getElementById('addIPForm').reset();
    document.getElementById('addIPModal').classList.add('show');
}

// 工具函数
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

