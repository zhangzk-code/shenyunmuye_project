// 内容管理模块 (CMS) - 核心模块

import { API_BASE_URL, PAGE_LABELS, SECTION_LABELS, SECTION_ICONS, FIELD_LABELS } from '../config.js';
import { fetchWithTimeout, deepEqual, getValueByPath, setValueByPath, formatLabel, escapeHtml } from '../utils.js';
import { showSuccess, showError, showInfo, showConfirm } from '../ui.js';
import { getToken } from './auth.js';

// CMS模块状态变量
let siteContentCache = null;
let editingContent = {};
let defaultContentCache = {};
let currentSections = [];
let sectionDirtyFlags = {}; // 记录每个栏目是否有未保存的修改
let crossPageChanges = {}; // 记录跨页面的修改
let currentContentPage = 'global';
let currentSection = null;
let currentSubsection = null;

// DOM元素引用
let contentEditor = null;
let contentSidebarNav = null;
let contentSidebar = null;
let currentPageTitle = null;
let mobileMenuToggle = null;

// 图片字段正则
const imageKeyRegex = /(image|banner|icon|logo|photo|qr)$/i;

// 深度克隆
function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj || {}));
}

// 标记栏目为已修改
function markSectionDirty(sectionKey) {
    sectionDirtyFlags[sectionKey] = true;
}

// 初始化CMS模块
function initCMSModule() {
    // 获取DOM元素
    contentEditor = document.getElementById('contentEditor');
    contentSidebarNav = document.getElementById('contentSidebarNav');
    contentSidebar = document.getElementById('contentSidebar');
    currentPageTitle = document.getElementById('currentPageTitle');
    mobileMenuToggle = document.getElementById('mobileMenuToggle');
    
    // 关闭侧边栏的函数
    function closeMobileSidebar() {
        if (contentSidebar) {
            contentSidebar.classList.remove('mobile-open');
        }
        if (mobileMenuToggle) {
            mobileMenuToggle.style.display = 'block';
        }
    }
    
    // 打开侧边栏的函数
    function openMobileSidebar() {
        if (contentSidebar) {
            contentSidebar.classList.add('mobile-open');
        }
        if (mobileMenuToggle) {
            mobileMenuToggle.style.display = 'none';
        }
    }
    
    // 绑定移动端菜单切换
    if (mobileMenuToggle) {
        mobileMenuToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            openMobileSidebar();
        });
    }
    
    // 绑定关闭侧边栏按钮
    const closeSidebarBtn = document.getElementById('closeSidebarBtn');
    if (closeSidebarBtn) {
        closeSidebarBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            closeMobileSidebar();
        });
    }
    
    // 点击遮罩层（侧边栏外部）关闭侧边栏
    // 使用事件委托，监听整个文档的点击事件
    document.addEventListener('click', (e) => {
        // 只在移动端且侧边栏打开时处理
        if (window.innerWidth <= 1024 && contentSidebar && contentSidebar.classList.contains('mobile-open')) {
            // 如果点击的不是侧边栏内部元素，则关闭
            if (!contentSidebar.contains(e.target) && e.target !== mobileMenuToggle) {
                closeMobileSidebar();
            }
        }
    });
    
    // 绑定刷新按钮
    const refreshContentBtn = document.getElementById('refreshContentBtn');
    if (refreshContentBtn) {
        refreshContentBtn.addEventListener('click', () => {
            loadSiteContent(true);
        });
    }
    
    // 绑定CMS工具栏
    bindCMSToolbar();
    
    // 加载站点内容（这会触发侧边栏和编辑器的渲染）
    loadSiteContent();
    
    // 定期检查发布状态
    checkPublishStatus();
    setInterval(checkPublishStatus, 30000); // 每30秒检查一次
}

// 加载站点内容
async function loadSiteContent(showStatus = false) {
    if (!contentEditor) return;
    try {
        // 并行加载当前内容和默认内容
        const [contentResponse, defaultResponse] = await Promise.all([
            fetchWithTimeout(`${API_BASE_URL}/content`, {
                headers: { 'Authorization': `Bearer ${getToken()}` }
            }),
            fetchWithTimeout(`${API_BASE_URL}/content/default/${currentContentPage}`, {
                headers: { 'Authorization': `Bearer ${getToken()}` }
            })
        ]);
        
        const result = await contentResponse.json();
        if (!result.success) throw new Error(result.message || '加载失败');
        siteContentCache = result.data || {};

        const defaultResult = await defaultResponse.json();
        if (defaultResult.success) {
            defaultContentCache = defaultResult.data || {};
        }

        setCurrentContentPage(currentContentPage);
        
        // 如果是指定显示状态（刷新按钮点击），显示成功提示
        if (showStatus) {
            showSuccess('内容已刷新');
        }
    } catch (error) {
        showError('内容加载失败：' + (error.message || '网络错误'));
    }
}

// 设置当前内容页面
function setCurrentContentPage(page) {
    currentContentPage = page;
    const base = page === 'global'
        ? (siteContentCache?.global || {})
        : ((siteContentCache?.pages && siteContentCache.pages[page]) || {});
    editingContent = deepClone(base);
    
    // 确保联系我们页面的 service 栏目包含 showConsultation 和 showCustomerService 字段
    if (page === 'contact' && editingContent.service && typeof editingContent.service === 'object') {
        if (!editingContent.service.hasOwnProperty('showConsultation')) {
            editingContent.service.showConsultation = true;
        }
        if (!editingContent.service.hasOwnProperty('showCustomerService')) {
            editingContent.service.showCustomerService = true;
        }
    }
    
    sectionDirtyFlags = {}; // 重置所有栏目的修改标记
    currentSubsection = null;
    
    // 定义需要隐藏的栏目
    const HIDDEN_SECTIONS = {
        global: ['nav', 'languages'],
        home: ['hero', 'cta', 'qrCards'],
        products: ['categories']
    };
    
    const hiddenKeys = HIDDEN_SECTIONS[page] || [];
    const availableSections = Object.keys(base).filter(key => 
        base[key] !== null && 
        base[key] !== undefined &&
        !hiddenKeys.includes(key)
    );
    
    // 如果是首页，默认选中"产品系列标签"
    if (page === 'home' && availableSections.includes('productSeries')) {
        currentSection = 'productSeries';
    } else if (availableSections.length > 0) {
        currentSection = availableSections[0];
    } else {
        currentSection = null;
    }
    
    renderContentSidebar();
    renderContentEditor();
    
    // 滚动到栏目顶部
    if (currentSection) {
        scrollToSection(currentSection);
    }
}

// 渲染左侧导航菜单
function renderContentSidebar() {
    if (!contentSidebarNav) return;
    contentSidebarNav.innerHTML = '';
    
    // 更新页面标题
    if (currentPageTitle) {
        currentPageTitle.textContent = PAGE_LABELS[currentContentPage] || '站点内容管理';
    }

    // 遍历所有页面，生成一级菜单
    Object.keys(PAGE_LABELS).forEach(pageKey => {
        const pageItem = document.createElement('div');
        pageItem.className = `nav-page-item ${pageKey === currentContentPage ? 'expanded' : ''}`;
        
        const pageBtn = document.createElement('button');
        pageBtn.className = `nav-page-btn ${pageKey === currentContentPage ? 'active' : ''}`;
        pageBtn.innerHTML = `
            <span>${PAGE_LABELS[pageKey]}</span>
            <span class="arrow">▶</span>
        `;
        pageBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (currentContentPage !== pageKey) {
                setCurrentContentPage(pageKey);
            } else {
                pageItem.classList.toggle('expanded');
                pageBtn.classList.toggle('expanded');
            }
        });
        pageItem.appendChild(pageBtn);

        // 如果是当前页面，生成二级菜单（栏目）
        if (pageKey === currentContentPage) {
            const sectionList = document.createElement('div');
            sectionList.className = 'nav-section-list';
            
            const pageData = pageKey === 'global'
                ? (siteContentCache?.global || {})
                : ((siteContentCache?.pages && siteContentCache.pages[pageKey]) || {});
            
            const HIDDEN_SECTIONS = {
                global: ['nav', 'languages'],
                home: ['hero', 'cta', 'qrCards'],
                products: ['categories']
            };
            
            const hiddenKeys = HIDDEN_SECTIONS[pageKey] || [];
            const labels = SECTION_LABELS[pageKey] || {};
            const sections = Object.keys(pageData).filter(key => 
                pageData[key] !== null && 
                pageData[key] !== undefined &&
                !hiddenKeys.includes(key)
            );

            sections.forEach(sectionKey => {
                const sectionItem = document.createElement('div');
                sectionItem.className = 'nav-section-item';
                
                const sectionBtn = document.createElement('button');
                sectionBtn.className = `nav-section-btn ${currentSection === sectionKey ? 'active' : ''}`;
                sectionBtn.innerHTML = `<span>${labels[sectionKey] || formatLabel(sectionKey, [], pageKey, sectionKey, FIELD_LABELS)}</span>`;
                sectionBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    navigateToSection(sectionKey);
                });
                sectionItem.appendChild(sectionBtn);
                sectionList.appendChild(sectionItem);
                
                // 如果是重点案例，添加子级菜单
                if (sectionKey === 'featured' && pageKey === 'cases') {
                    const subsectionList = document.createElement('div');
                    subsectionList.className = 'nav-category-list';
                    subsectionList.style.cssText = 'margin-top: 8px; padding-left: 16px; display: flex; flex-direction: column; gap: 4px;';
                    
                    const featuredData = pageData.featured || {};
                    const smallArray = featuredData.small || [];
                    const largeArray = featuredData.large || [];
                    
                    // Small区域
                    const smallItem = document.createElement('button');
                    smallItem.className = `nav-category-btn ${currentSubsection === 'small' ? 'active' : ''}`;
                    smallItem.setAttribute('data-subsection', 'small');
                    smallItem.style.cssText = 'padding: 8px 12px; border: none; background: transparent; text-align: left; cursor: pointer; border-radius: 6px; font-size: 13px; color: #374151; transition: all 0.2s;';
                    if (currentSubsection === 'small') {
                        smallItem.style.background = 'var(--primary)';
                        smallItem.style.color = '#fff';
                    }
                    smallItem.innerHTML = `<span>Small区域 (${smallArray.length})</span>`;
                    smallItem.addEventListener('click', (e) => {
                        e.stopPropagation();
                        navigateToFeaturedSubsection('small');
                    });
                    subsectionList.appendChild(smallItem);
                    
                    // Large区域
                    const largeItem = document.createElement('button');
                    largeItem.className = `nav-category-btn ${currentSubsection === 'large' ? 'active' : ''}`;
                    largeItem.setAttribute('data-subsection', 'large');
                    largeItem.style.cssText = 'padding: 8px 12px; border: none; background: transparent; text-align: left; cursor: pointer; border-radius: 6px; font-size: 13px; color: #374151; transition: all 0.2s;';
                    if (currentSubsection === 'large') {
                        largeItem.style.background = 'var(--primary)';
                        largeItem.style.color = '#fff';
                    }
                    largeItem.innerHTML = `<span>Large区域 (${largeArray.length})</span>`;
                    largeItem.addEventListener('click', (e) => {
                        e.stopPropagation();
                        navigateToFeaturedSubsection('large');
                    });
                    subsectionList.appendChild(largeItem);
                    
                    if (currentSection === 'featured') {
                        sectionItem.appendChild(subsectionList);
                    }
                }
                
                // 如果是产品列表，添加分类导航
                if (sectionKey === 'productCards' && pageKey === 'products') {
                    const categoryList = document.createElement('div');
                    categoryList.className = 'nav-category-list';
                    categoryList.style.cssText = 'margin-top: 8px; padding-left: 16px; display: flex; flex-direction: column; gap: 4px;';
                    
                    const filters = (pageData.filters || []);
                    const productCards = (pageData.productCards || []);
                    
                    const categoryCounts = {};
                    productCards.forEach(card => {
                        const cat = card.category || 'all';
                        categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
                    });
                    
                    filters.forEach(filter => {
                        const category = filter.category || 'all';
                        if (category === 'all') return;
                        const categoryLabel = filter.label || category;
                        const count = categoryCounts[category] || 0;
                        
                        const categoryItem = document.createElement('button');
                        categoryItem.className = `nav-category-btn ${currentSubsection === category ? 'active' : ''}`;
                        categoryItem.setAttribute('data-category', category);
                        categoryItem.style.cssText = 'padding: 8px 12px; border: none; background: transparent; text-align: left; cursor: pointer; border-radius: 6px; font-size: 13px; color: #374151; transition: all 0.2s;';
                        if (currentSubsection === category) {
                            categoryItem.style.background = 'var(--primary)';
                            categoryItem.style.color = '#fff';
                        }
                        categoryItem.innerHTML = `<span>${categoryLabel} (${count})</span>`;
                        categoryItem.addEventListener('click', (e) => {
                            e.stopPropagation();
                            if (currentContentPage !== 'products') {
                                setCurrentContentPage('products');
                                setTimeout(() => {
                                    navigateToSection('productCards');
                                    setTimeout(() => {
                                        navigateToCategory(category);
                                    }, 100);
                                }, 100);
                            } else if (currentSection !== 'productCards') {
                                navigateToSection('productCards');
                                setTimeout(() => {
                                    navigateToCategory(category);
                                }, 100);
                            } else {
                                navigateToCategory(category);
                            }
                        });
                        categoryList.appendChild(categoryItem);
                    });
                    
                    if (currentSection === 'productCards') {
                        sectionItem.appendChild(categoryList);
                    }
                }
            });
            
            pageItem.appendChild(sectionList);
        }

        contentSidebarNav.appendChild(pageItem);
    });
}

// 滚动到指定栏目顶部
function scrollToSection(sectionKey) {
    if (!contentEditor) return;
    
    // 等待DOM渲染完成后再滚动
    setTimeout(() => {
        const sectionCard = document.getElementById(`section-${sectionKey}`);
        if (sectionCard) {
            // 滚动到栏目卡片顶部，使用平滑滚动
            sectionCard.scrollIntoView({ 
                behavior: 'smooth', 
                block: 'start',
                inline: 'nearest'
            });
        } else {
            // 如果找不到栏目卡片，滚动到编辑器顶部
            contentEditor.scrollIntoView({ 
                behavior: 'smooth', 
                block: 'start',
                inline: 'nearest'
            });
        }
    }, 50);
}

// 导航到指定栏目
// shouldScroll: 是否滚动到栏目顶部，默认为true（导航切换时滚动，删除/增加按钮操作时不滚动）
function navigateToSection(sectionKey, shouldScroll = true) {
    currentSection = sectionKey;
    
    if (sectionKey === 'featured' && currentContentPage === 'cases') {
        if (!currentSubsection || (currentSubsection !== 'small' && currentSubsection !== 'large')) {
            currentSubsection = 'small';
        }
    } else if (sectionKey === 'productCards' && currentContentPage === 'products') {
        // 保持当前分类选择
    } else {
        currentSubsection = null;
    }
    
    // 更新导航高亮
    document.querySelectorAll('.nav-section-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    const sectionBtn = Array.from(document.querySelectorAll('.nav-section-btn')).find(btn => 
        btn.textContent.includes(SECTION_LABELS[currentContentPage]?.[sectionKey] || formatLabel(sectionKey, [], currentContentPage, sectionKey, FIELD_LABELS))
    );
    if (sectionBtn) sectionBtn.classList.add('active');
    
    if (sectionKey === 'productCards' && currentContentPage === 'products') {
        renderContentSidebar();
    }
    
    if (sectionKey === 'featured' && currentContentPage === 'cases') {
        renderContentSidebar();
    }
    
    renderContentEditor();
    
    // 只有在导航切换时才滚动，删除/增加按钮操作时不滚动
    if (shouldScroll) {
        scrollToSection(sectionKey);
    }
    
    // 移动端延迟关闭侧边栏，给用户更好的体验（仅在导航切换时）
    if (shouldScroll && window.innerWidth <= 1024 && contentSidebar) {
        // 延迟300ms关闭，让用户能看到内容已切换
        setTimeout(() => {
            if (contentSidebar && contentSidebar.classList.contains('mobile-open')) {
                contentSidebar.classList.remove('mobile-open');
                if (mobileMenuToggle) {
                    mobileMenuToggle.style.display = 'block';
                }
            }
        }, 300);
    }
}

// 导航到指定分类
function navigateToCategory(category) {
    currentSubsection = category;
    
    document.querySelectorAll('.nav-category-btn').forEach(btn => {
        btn.classList.remove('active');
        btn.style.background = 'transparent';
        btn.style.color = 'var(--text-light)';
    });
    
    const categoryBtn = Array.from(document.querySelectorAll('.nav-category-btn')).find(btn => 
        btn.getAttribute('data-category') === category
    );
    if (categoryBtn) {
        categoryBtn.classList.add('active');
        categoryBtn.style.background = 'var(--primary)';
        categoryBtn.style.color = '#fff';
    }
    
    renderContentEditor();
    
    // 滚动到栏目顶部
    if (currentSection) {
        scrollToSection(currentSection);
    }
    
    // 移动端延迟关闭侧边栏，给用户更好的体验
    if (window.innerWidth <= 1024 && contentSidebar) {
        setTimeout(() => {
            if (contentSidebar && contentSidebar.classList.contains('mobile-open')) {
                contentSidebar.classList.remove('mobile-open');
                if (mobileMenuToggle) {
                    mobileMenuToggle.style.display = 'block';
                }
            }
        }, 300);
    }
}

// 导航到重点案例的子级菜单
function navigateToFeaturedSubsection(subsection) {
    currentSubsection = subsection;
    
    document.querySelectorAll('.nav-category-btn[data-subsection]').forEach(btn => {
        btn.classList.remove('active');
        btn.style.background = 'transparent';
        btn.style.color = 'var(--text-light)';
    });
    
    const subsectionBtn = Array.from(document.querySelectorAll('.nav-category-btn[data-subsection]')).find(btn => 
        btn.getAttribute('data-subsection') === subsection
    );
    if (subsectionBtn) {
        subsectionBtn.classList.add('active');
        subsectionBtn.style.background = 'var(--primary)';
        subsectionBtn.style.color = '#fff';
    }
    
    renderContentEditor();
    
    // 滚动到栏目顶部
    if (currentSection) {
        scrollToSection(currentSection);
    }
    
    // 移动端延迟关闭侧边栏，给用户更好的体验
    if (window.innerWidth <= 1024 && contentSidebar) {
        setTimeout(() => {
            if (contentSidebar && contentSidebar.classList.contains('mobile-open')) {
                contentSidebar.classList.remove('mobile-open');
                if (mobileMenuToggle) {
                    mobileMenuToggle.style.display = 'block';
                }
            }
        }, 300);
    }
}

// 渲染内容编辑器
function renderContentEditor() {
    if (!contentEditor) return;
    contentEditor.innerHTML = '';

    const labels = SECTION_LABELS[currentContentPage] || {};
    const pageData = currentContentPage === 'global'
        ? (siteContentCache?.global || {})
        : ((siteContentCache?.pages && siteContentCache.pages[currentContentPage]) || {});
    
    const HIDDEN_SECTIONS = {
        global: ['nav', 'languages'],
        home: ['hero', 'cta'],
        products: ['categories']
    };
    
    const hiddenKeys = HIDDEN_SECTIONS[currentContentPage] || [];
    
    currentSections = Object.keys(pageData).filter(key => 
        pageData[key] !== null && 
        pageData[key] !== undefined &&
        !hiddenKeys.includes(key)
    );

    if (currentSections.length === 0) {
        const emptyMsg = document.createElement('div');
        emptyMsg.className = 'section-card';
        emptyMsg.innerHTML = '<p style="text-align: center; color: #374151; padding: 40px;">暂无可用栏目</p>';
        contentEditor.appendChild(emptyMsg);
        return;
    }
    
    if (!currentSection || !currentSections.includes(currentSection)) {
        currentSection = currentSections[0];
        document.querySelectorAll('.nav-section-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.textContent.includes(labels[currentSection] || formatLabel(currentSection, [], currentContentPage, currentSection, FIELD_LABELS))) {
                btn.classList.add('active');
            }
        });
    }
    
    const sectionKey = currentSection;
    const sectionData = editingContent[sectionKey];
    
    const sectionHint = document.getElementById('currentSectionHint');
    if (sectionHint) {
        sectionHint.textContent = `当前编辑：${labels[sectionKey] || formatLabel(sectionKey, [], currentContentPage, sectionKey, FIELD_LABELS)}`;
    }
    
    if (!sectionData) {
        const emptyMsg = document.createElement('div');
        emptyMsg.className = 'section-card';
        emptyMsg.innerHTML = '<p style="text-align: center; color: #374151; padding: 40px;">栏目数据为空</p>';
        contentEditor.appendChild(emptyMsg);
        return;
    }
    
    // 创建栏目卡片
    const sectionCard = document.createElement('div');
    sectionCard.className = 'section-card';
    sectionCard.id = `section-${sectionKey}`;
    
    const sectionHeader = document.createElement('div');
    sectionHeader.className = 'section-card-header';
    const sectionIcon = SECTION_ICONS[sectionKey] || '📋';
    const sectionTitle = labels[sectionKey] || formatLabel(sectionKey, [], currentContentPage, sectionKey, FIELD_LABELS);
    sectionHeader.innerHTML = `
        <h3>
            <span class="section-icon">${sectionIcon}</span>
            <span class="section-title">${sectionTitle}</span>
        </h3>
        <button class="section-reset-btn" data-section="${sectionKey}" type="button" title="恢复默认值">
            <span>🔄</span>
            <span>恢复默认</span>
        </button>
    `;
    sectionCard.appendChild(sectionHeader);
    
    // 绑定恢复默认按钮
    const resetBtn = sectionHeader.querySelector('.section-reset-btn');
    if (resetBtn) {
        resetBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const btn = e.currentTarget;
            btn.disabled = true;
            btn.style.opacity = '0.6';
            try {
                await resetSection(sectionKey);
            } finally {
                btn.disabled = false;
                btn.style.opacity = '1';
            }
        });
    }

    const sectionBody = document.createElement('div');
    sectionBody.className = 'section-card-body';
    
    // 递归渲染所有字段
    renderSectionFieldsFlat(sectionBody, sectionData, [sectionKey], sectionKey);
    
    sectionCard.appendChild(sectionBody);
    contentEditor.appendChild(sectionCard);
}

// 更新栏目卡片
function updateSectionCard(sectionKey, sectionData) {
    const sectionCard = document.getElementById(`section-${sectionKey}`);
    if (!sectionCard) return;

    const sectionBody = sectionCard.querySelector('.section-card-body');
    if (sectionBody) {
        sectionBody.innerHTML = '';
        renderSectionFieldsFlat(sectionBody, sectionData, [sectionKey], sectionKey);
    }
    
    editingContent[sectionKey] = deepClone(sectionData);
    
    sectionDirtyFlags[sectionKey] = false;
    Object.keys(sectionDirtyFlags).forEach(key => {
        if (key.startsWith(`${sectionKey}-`)) {
            sectionDirtyFlags[key] = false;
        }
    });
}

// 平铺渲染字段
function renderSectionFieldsFlat(parent, data, path, sectionKey) {
    if (data === null || data === undefined) {
        return;
    }
    
    if (typeof data !== 'object') {
        parent.appendChild(createPrimitiveField(formatLabel(path[path.length - 1] || '值', path, currentContentPage, currentSection, FIELD_LABELS), data, path, sectionKey));
        return;
    }
    
    if (Array.isArray(data)) {
        renderArrayFields(parent, data, path, formatLabel(path[path.length - 1] || '数组', path, currentContentPage, currentSection, FIELD_LABELS), sectionKey);
        return;
    }
    
    // 如果是重点案例且选择了子级菜单，只显示对应的字段
    if (sectionKey === 'featured' && currentSubsection && (currentSubsection === 'small' || currentSubsection === 'large') && path.length === 1 && path[0] === 'featured') {
        const subsectionData = data[currentSubsection];
        if (subsectionData !== undefined) {
            const subsectionPath = [...path, currentSubsection];
            if (Array.isArray(subsectionData)) {
                renderArrayFields(parent, subsectionData, subsectionPath, currentSubsection === 'small' ? 'Small区域' : 'Large区域', sectionKey);
            } else {
                renderSectionFieldsFlat(parent, subsectionData, subsectionPath, sectionKey);
            }
        }
        return;
    }
    
    const HIDDEN_FIELDS = {
        'global.footer': ['columns']
    };
    
    const isFooterColumnsLinks = path.length >= 3 && 
                                path[path.length - 1] === 'links' && 
                                path[path.length - 2] !== undefined && 
                                path[path.length - 3] === 'footer' && 
                                path[path.length - 2] !== 'columns' && 
                                path.includes('columns');
    
    const pathString = path.join('.');
    const hiddenFields = HIDDEN_FIELDS[pathString] || [];
    
    Object.keys(data).forEach(key => {
        if (hiddenFields.includes(key)) {
            return;
        }
        
        const isFooterColumnsLinksCheck = path.length >= 3 && 
                                        path[path.length - 3] === 'footer' && 
                                        path.includes('columns') && 
                                        path[path.length - 1] !== 'columns' && 
                                        key === 'links';
        if (isFooterColumnsLinksCheck) {
            return;
        }
        
        const isFooterColumnsTag = path.length >= 3 && 
                                  path[path.length - 3] === 'footer' && 
                                  path.includes('columns') && 
                                  path[path.length - 1] !== 'columns' && 
                                  key === 'tag';
        if (isFooterColumnsTag) {
            return;
        }
        
        const isFiltersCategory = path.length >= 2 && 
                                 path[path.length - 2] === 'filters' && 
                                 key === 'category';
        if (isFiltersCategory) {
            return;
        }
        
        const isProductCardsCategory = path.length >= 2 && 
                                      path[path.length - 2] === 'productCards' && 
                                      key === 'category';
        if (isProductCardsCategory) {
            return;
        }
        
        const isProductCardsDetailedDescription = path.length >= 2 && 
                                                 path[path.length - 2] === 'productCards' && 
                                                 key === 'detailedDescription';
        if (isProductCardsDetailedDescription) {
            return;
        }
        
        const isAdvantagesIcon = path.length >= 2 && 
                                path[path.length - 2] === 'advantages' && 
                                key === 'icon';
        if (isAdvantagesIcon) {
            return;
        }
        
        const isFooterColumnsLabel = path.length >= 3 && 
                                    path[path.length - 3] === 'footer' && 
                                    path.includes('columns') && 
                                    path[path.length - 1] !== 'columns' && 
                                    key === 'label';
        if (isFooterColumnsLabel) {
            return;
        }
        
        const value = data[key];
        const fieldPath = [...path, key];
        const label = formatLabel(key, fieldPath, currentContentPage, currentSection, FIELD_LABELS);
        
        const isFloatingSidebarItems = path.length >= 1 && 
            path[path.length - 1] === 'floatingSidebar' && 
            key === 'items';
        if (isFloatingSidebarItems) {
            return;
        }
        
        const isContactServiceOnline = (path.length >= 2 && 
            path[path.length - 2] === 'service' && 
            path[path.length - 1] === 'online' &&
            (path.includes('contact') || currentContentPage === 'contact')) ||
            (path.length >= 1 && path[path.length - 1] === 'online' && currentContentPage === 'contact' && currentSection === 'service');
        if (isContactServiceOnline) {
            return;
        }
        
        const isOnlineItemField = path.length >= 3 && 
            path.includes('online') && 
            (key === 'icon' || key === 'title' || key === 'subtitle') &&
            (path.includes('contact') || currentContentPage === 'contact');
        if (isOnlineItemField) {
            return;
        }
        
        const isMapLink = key === 'mapLink' && 
            (path.includes('contact') || currentContentPage === 'contact' || 
             path.includes('company'));
        if (isMapLink) {
            return;
        }

        if (value === null || value === undefined) {
            parent.appendChild(createPrimitiveField(label, '', fieldPath, sectionKey));
        } else if (typeof value === 'object' && !Array.isArray(value)) {
            renderSectionFieldsFlat(parent, value, fieldPath, sectionKey);
        } else if (Array.isArray(value)) {
            renderArrayFields(parent, value, fieldPath, label, sectionKey);
        } else if (key === 'images' && typeof value === 'string') {
            const imagesArray = value ? [value] : [];
            renderArrayFields(parent, imagesArray, fieldPath, label, sectionKey);
        } else {
            const field = createPrimitiveField(label, value, fieldPath, sectionKey);
            parent.appendChild(field);
        }
    });
}

// 判断是否为图片字段
function isImageField(path) {
    const key = path[path.length - 1];
    return typeof key === 'string' && imageKeyRegex.test(key);
}

// 规范化图片URL
function normalizeImageUrl(imageUrl) {
    if (!imageUrl || typeof imageUrl !== 'string') return '';
    
    const url = imageUrl.trim();
    if (!url) return '';
    
    // 如果已经是完整的URL，直接返回
    if (url.startsWith('http://') || url.startsWith('https://')) {
        return url;
    }
    
    // 检测哈希文件名（32位十六进制字符 + 扩展名）
    // 例如：08eefd6b0e0c23aaf87c331ad8477f0.jpg, 25ab3a05d4529ecf553bc4e1edba795.jpg
    const hashFilenamePattern = /[0-9a-f]{32}\.(jpg|jpeg|png|gif|webp|svg|bmp|ico)$/i;
    const imageExtensions = /\.(jpg|jpeg|png|gif|webp|svg|bmp|ico)$/i;
    
    // 提取文件名（路径的最后一部分）
    const filename = url.split('/').pop().split('\\').pop();
    
    // 处理路径：将 images/ 转换为 uploads/，或确保 uploads/ 路径正确
    let normalizedPath = url;
    let useBackendServer = false; // 标记是否使用后端服务器（3000端口）
    
    // 如果文件名是哈希格式，无论路径如何，都应该是上传的图片
    if (hashFilenamePattern.test(filename)) {
        useBackendServer = true;
        // 如果路径包含 images/，需要转换为 uploads/
        if (url.startsWith('/images/')) {
            normalizedPath = url.replace(/^\/images\//, '/uploads/');
        } else if (url.startsWith('images/')) {
            normalizedPath = '/uploads/' + url.substring('images/'.length);
        } else if (url.includes('/images/')) {
            const imagesIndex = url.indexOf('/images/');
            normalizedPath = '/uploads/' + url.substring(imagesIndex + '/images/'.length);
        } else if (url.startsWith('/uploads/')) {
            normalizedPath = url;
        } else if (url.startsWith('uploads/')) {
            normalizedPath = '/' + url;
        } else {
            // 如果只有文件名，添加 /uploads/ 前缀
            normalizedPath = `/uploads/${url}`;
        }
    } else if (url.startsWith('/uploads/') || url.startsWith('uploads/')) {
        // 已经是 uploads/ 路径，确保格式正确，使用后端服务器
        useBackendServer = true;
        normalizedPath = url.startsWith('/') ? url : `/${url}`;
    } else if (imageExtensions.test(url) && !url.includes('/') && !url.includes('\\')) {
        // 如果只有文件名（非哈希格式），假设是上传的图片，使用后端服务器
        useBackendServer = true;
        normalizedPath = `/uploads/${url}`;
    } else if (url.startsWith('images/') || url.startsWith('/images/')) {
        // 静态图片资源，保持原路径，使用当前访问端口
        normalizedPath = url.startsWith('/') ? url : `/${url}`;
    } else {
        // 其他相对路径，确保以 / 开头，使用当前访问端口
        normalizedPath = url.startsWith('/') ? url : `/${url}`;
    }
    
    // 对于上传的图片（/uploads/ 路径），使用后端服务器（3000端口）
    // 对于静态图片（/images/ 路径），使用前端网站端口（8080端口）
    const hostname = window.location.hostname;
    const protocol = window.location.protocol;
    
    if (useBackendServer) {
        // 上传图片使用后端服务器（3000端口）
        const backendPort = (hostname === 'localhost' || hostname === '127.0.0.1') ? '3000' : '3000';
        return `${protocol}//${hostname}:${backendPort}${normalizedPath}`;
    } else {
        // 静态图片使用前端网站端口（8080端口）
        const frontendPort = (hostname === 'localhost' || hostname === '127.0.0.1') ? '8080' : '8080';
        return `${protocol}//${hostname}:${frontendPort}${normalizedPath}`;
    }
}

// 更新图片预览
function updateImagePreview(imageUrl, row) {
    const previewImg = row?.querySelector('.image-preview');
    if (!previewImg) return;
    
    if (imageUrl && typeof imageUrl === 'string' && imageUrl.trim()) {
        const normalizedUrl = normalizeImageUrl(imageUrl);
        previewImg.src = normalizedUrl;
        previewImg.style.display = 'block';
        
        previewImg.onload = () => {
            previewImg.style.display = 'block';
        };
        
        previewImg.onerror = () => {
            previewImg.style.display = 'none';
            const errorMsg = previewImg.parentElement?.querySelector('.image-error');
            if (errorMsg) {
                errorMsg.textContent = '图片加载失败，请检查URL是否正确';
            }
        };
    } else {
        previewImg.style.display = 'none';
    }
}

// 显示图片放大模态框
function showImageModal(imageUrl) {
    if (!imageUrl || !imageUrl.trim()) return;
    
    const normalizedUrl = normalizeImageUrl(imageUrl);
    
    const modal = document.createElement('div');
    modal.className = 'image-modal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.9);
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
    `;
    
    const img = document.createElement('img');
    img.src = normalizedUrl;
    img.style.cssText = `
        max-width: 90%;
        max-height: 90%;
        object-fit: contain;
        border-radius: 8px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
    `;
    
    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '✕';
    closeBtn.style.cssText = `
        position: absolute;
        top: 20px;
        right: 20px;
        width: 40px;
        height: 40px;
        border: none;
        background: rgba(255, 255, 255, 0.2);
        color: white;
        font-size: 24px;
        border-radius: 50%;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background 0.2s;
    `;
    closeBtn.onmouseover = () => closeBtn.style.background = 'rgba(255, 255, 255, 0.3)';
    closeBtn.onmouseout = () => closeBtn.style.background = 'rgba(255, 255, 255, 0.2)';
    
    const closeModal = () => {
        document.body.removeChild(modal);
    };
    
    closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        closeModal();
    });
    modal.addEventListener('click', closeModal);
    img.addEventListener('click', (e) => e.stopPropagation());
    
    modal.appendChild(img);
    modal.appendChild(closeBtn);
    document.body.appendChild(modal);
}

// 上传图片
async function uploadImage(file, path, inputEl, sectionKey) {
    try {
        const formData = new FormData();
        formData.append('file', file);
        const statusEl = document.getElementById(`status-${sectionKey}`);
        if (statusEl) statusEl.textContent = '上传中...';
        const response = await fetchWithTimeout(`${API_BASE_URL}/uploads`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${getToken()}` },
            body: formData
        }, 30000);
        const result = await response.json();
        if (!result.success) throw new Error(result.message || '上传失败');
        const url = result.data?.url;
        inputEl.value = url || '';
        setValueByPath(editingContent, path, url);
        markSectionDirty(sectionKey);
        
        const row = inputEl.closest('.field-row');
        if (row) {
            const previewContainer = row.querySelector('.image-preview-container');
            if (previewContainer) {
                const inputEvent = new Event('input', { bubbles: true });
                inputEl.dispatchEvent(inputEvent);
            } else {
                updateImagePreview(url, row);
            }
        }
        
        if (statusEl) statusEl.textContent = '图片上传成功，请保存';
    } catch (error) {
        showError(error.message || '上传图片失败');
    }
}

function renderArrayFields(parent, array, path, label, sectionKey) {
    // 简化数组显示：直接渲染数组项，不创建额外的容器和按钮
    if (!Array.isArray(array)) {
        parent.appendChild(createPrimitiveField(label, array, path, sectionKey));
        return;
    }
    
    // 如果是产品列表且选择了分类，进行筛选
    let displayArray = array;
    if (sectionKey === 'productCards' && currentSubsection) {
        displayArray = array.filter(item => {
            const itemCategory = item.category || 'all';
            return itemCategory === currentSubsection || (currentSubsection === 'all' && !itemCategory);
        });
    }
    
    // 检查是否是页脚描述数组（需要特殊处理）
    const isFooterDescription = path.length >= 2 && path[path.length - 1] === 'description' && path[path.length - 2] === 'footer';
    
    // 检查是否是页脚columns数组（需要特殊处理）
    const isFooterColumns = path.length >= 2 && path[path.length - 1] === 'columns' && path[path.length - 2] === 'footer';
    
    // 如果是页脚描述数组，添加操作提示
    if (isFooterDescription) {
        const footerDescriptionNotice = document.createElement('div');
        footerDescriptionNotice.className = 'logo-field-notice';
        footerDescriptionNotice.innerHTML = `
            <div class="notice-icon">ℹ️</div>
            <div class="notice-content">
                <strong>操作说明：</strong>
                <p><strong>添加描述：</strong>点击下方的"+ 添加页脚描述"按钮可以添加新的描述项。</p>
                <p><strong>删除描述：</strong>点击每个描述项下方的"删除"按钮可以删除该描述项。</p>
                <p><strong>显示位置：</strong>这些描述内容将显示在网站页脚的第一列（"关于申允木业"部分）中，每个描述项会以段落形式显示。</p>
                <p><strong>保存提示：</strong>修改后请点击"保存"按钮保存草稿，然后点击"发布"按钮后网站才会显示最新内容。</p>
            </div>
        `;
        parent.appendChild(footerDescriptionNotice);
    }
    
    // 检查是否是产品系列标签数组（需要特殊处理）
    const isProductSeries = path.length >= 1 && path[path.length - 1] === 'productSeries';
    
    // 检查是否是产品画廊数组（需要特殊处理）
    const isProductGallery = path.length >= 1 && path[path.length - 1] === 'productGallery';
    
    // 检查是否是精选案例数组（需要特殊处理）
    const isCases = path.length >= 1 && path[path.length - 1] === 'cases';
    
    // 检查是否是案例网格数组（需要特殊处理）
    const isCasesGrid = path.length >= 1 && path[path.length - 1] === 'casesGrid';
    
    // 检查是否是筛选标签数组（需要特殊处理）
    const isFilters = path.length >= 1 && path[path.length - 1] === 'filters';
    
    // 检查是否是产品列表数组（需要特殊处理）
    const isProductCards = path.length >= 1 && path[path.length - 1] === 'productCards';
    
    // 检查是否是服务流程数组（需要特殊处理）
    const isProcess = path.length >= 1 && path[path.length - 1] === 'process';
    
    // 检查是否是服务优势数组（需要特殊处理）
    const isAdvantages = path.length >= 1 && path[path.length - 1] === 'advantages';
    
    // 检查是否是品牌故事的段落数组（需要特殊处理）
    const isParagraphs = path.length >= 2 && path[path.length - 1] === 'paragraphs' && path[path.length - 2] === 'story';
    
    // 检查是否是发展历程的时间线数组（需要特殊处理）
    const isTimeline = path.length >= 1 && path[path.length - 1] === 'timeline';
    
    // 检查是否是营业时间数组（需要特殊处理）
    const isHours = path.length >= 2 && path[path.length - 1] === 'hours' && path[path.length - 2] === 'service';
    
    // 检查是否是联系我们页面的 online 数组（需要隐藏）
    const isContactServiceOnline = (path.length >= 2 && 
        path[path.length - 2] === 'service' && 
        path[path.length - 1] === 'online' &&
        (path.includes('contact') || currentContentPage === 'contact')) ||
        (path.length >= 1 && path[path.length - 1] === 'online' && currentContentPage === 'contact' && currentSection === 'service');
    
    // 检查是否是重点案例的small或large数组（需要特殊处理）
    const isFeaturedSmall = path.length >= 2 && path[path.length - 1] === 'small' && path[path.length - 2] === 'featured';
    const isFeaturedLarge = path.length >= 2 && path[path.length - 1] === 'large' && path[path.length - 2] === 'featured';
    const isFeaturedSubsection = isFeaturedSmall || isFeaturedLarge;
    
    // 检查是否是 images 数组（需要特殊样式和处理）
    const isImagesArray = path.length >= 1 && path[path.length - 1] === 'images';
    const isCasesImagesArray = path.length >= 2 && 
                             path[path.length - 1] === 'images' && 
                             (path[path.length - 2] === 'small' || path[path.length - 2] === 'large' || path[path.length - 2] === 'casesGrid');
    
    // 为数组添加一个简单的标题（页脚描述数组、页脚columns数组、产品系列标签数组、产品画廊数组、精选案例数组、案例网格数组、筛选标签数组、产品列表数组、服务流程数组、服务优势数组、段落数组、时间线数组、营业时间数组、online数组和重点案例的small/large数组不显示标题）
    if (array.length > 0 && !isFooterDescription && !isFooterColumns && !isProductSeries && !isProductGallery && !isCases && !isCasesGrid && !isFilters && !isProductCards && !isProcess && !isAdvantages && !isParagraphs && !isTimeline && !isHours && !isContactServiceOnline && !isFeaturedSubsection) {
        const arrayLabel = document.createElement('div');
        
        // 如果是 images 数组，使用增强的视觉效果
        if (isImagesArray) {
            arrayLabel.style.cssText = 'display: flex; align-items: center; gap: 8px; font-size: 16px; font-weight: 600; color: #1f2937; margin-bottom: 16px; margin-top: 20px; padding: 12px 16px; background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); border: 2px solid #0ea5e9; border-radius: 10px; box-shadow: 0 2px 8px rgba(14, 165, 233, 0.15);';
            arrayLabel.innerHTML = `<span style="font-size: 20px;">🖼️</span><span>${label} (${array.length}项)</span>`;
        } else {
            arrayLabel.style.cssText = 'font-size: 14px; font-weight: 500; color: #374151; margin-bottom: 12px; margin-top: 16px;';
        arrayLabel.textContent = `${label} (${array.length}项)`;
        }
        
        parent.appendChild(arrayLabel);
    }
    
    // 创建数组项容器
    const arrayContainer = document.createElement('div');
    arrayContainer.className = 'array-items-container';
    if (isFooterDescription || isFooterColumns) {
        arrayContainer.style.cssText = 'margin-top: 12px;';
    }
    
    // 直接渲染数组项（使用筛选后的数组）
    displayArray.forEach((item, displayIndex) => {
        // 计算原始数组中的索引
        const originalIndex = array.indexOf(item);
        const index = originalIndex >= 0 ? originalIndex : displayIndex;
        const itemPath = [...path, index];
        
        // 为每个数组项添加分隔线（除了第一项）
        // 对于 casesGrid，使用更明显的分隔线
        if (displayIndex > 0) {
            const divider = document.createElement('div');
            if (isCasesGrid) {
                divider.style.cssText = 'height: 2px; background: linear-gradient(to right, transparent, #cbd5e1, transparent); margin: 32px 0; border-radius: 1px;';
            } else {
            divider.style.cssText = 'height: 1px; background: linear-gradient(to right, transparent, var(--border), transparent); margin: 24px 0;';
            }
            arrayContainer.appendChild(divider);
        }
        
        // 如果是images数组，特殊处理（包括所有images数组，不仅仅是cases）
        if (isImagesArray) {
            const imageRow = document.createElement('div');
            imageRow.className = 'field-row';
            
            const imageLabel = document.createElement('label');
            imageLabel.textContent = `图片 ${index + 1}`;
            imageRow.appendChild(imageLabel);
            
            const imageInput = document.createElement('input');
            imageInput.type = 'text';
            imageInput.value = item || '';
            imageInput.placeholder = '请输入图片路径';
            imageInput.className = 'form-input';
            imageInput.addEventListener('blur', () => {
                setValueByPath(editingContent, itemPath, imageInput.value);
                markSectionDirty(sectionKey);
            });
            imageInput.addEventListener('input', () => {
                setValueByPath(editingContent, itemPath, imageInput.value);
                if (imageInput.value) {
                    updateImagePreview(imageInput.value, imageRow);
                }
            });
            imageRow.appendChild(imageInput);
            
            // 图片预览容器（始终显示，即使没有图片也显示占位符）
                const previewContainer = document.createElement('div');
                previewContainer.className = 'image-preview-container';
            previewContainer.style.cssText = 'margin-top: 12px; margin-bottom: 12px;';
            
            const updatePreview = () => {
                const value = imageInput.value.trim();
                previewContainer.innerHTML = '';
                if (value) {
                const previewImg = document.createElement('img');
                previewImg.className = 'image-preview';
                previewImg.alt = '图片预览';
                    const normalizedUrl = normalizeImageUrl(value);
                previewImg.src = normalizedUrl;
                    previewImg.style.cssText = 'max-width: 200px; max-height: 200px; border-radius: 8px; border: 2px solid #e2e8f0; cursor: pointer; transition: all 0.2s;';
                previewImg.onerror = () => {
                    previewImg.style.display = 'none';
                        const errorPlaceholder = document.createElement('div');
                        errorPlaceholder.style.cssText = 'width: 200px; height: 150px; background: #f3f4f6; border: 2px dashed #d1d5db; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #9ca3af; font-size: 14px;';
                        errorPlaceholder.textContent = '图片加载失败';
                        previewContainer.appendChild(errorPlaceholder);
                    };
                    previewImg.addEventListener('mouseenter', () => {
                        previewImg.style.borderColor = '#0ea5e9';
                        previewImg.style.transform = 'scale(1.02)';
                    });
                    previewImg.addEventListener('mouseleave', () => {
                        previewImg.style.borderColor = '#e2e8f0';
                        previewImg.style.transform = 'scale(1)';
                    });
                previewImg.addEventListener('click', () => {
                    if (imageInput.value && imageInput.value.trim()) {
                        showImageModal(imageInput.value);
                    }
                });
                previewContainer.appendChild(previewImg);
                }
                // 没有图片时不显示任何内容（不显示占位符）
            };
            
            // 初始化预览
            updatePreview();
            imageRow.appendChild(previewContainer);
            
            // 更新 input 事件监听器
            imageInput.removeEventListener('input', () => {});
            imageInput.addEventListener('input', () => {
                setValueByPath(editingContent, itemPath, imageInput.value);
                updatePreview();
            });
            
            // 操作按钮容器
            const actionControls = document.createElement('div');
            actionControls.style.cssText = 'display: flex; align-items: center; gap: 12px; margin-top: 12px;';
            
            // 上传按钮
            const uploadBtn = document.createElement('button');
            uploadBtn.type = 'button';
            uploadBtn.className = 'btn-chip';
            uploadBtn.style.cssText = 'display: flex; align-items: center; gap: 6px; padding: 8px 16px; background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%); color: #fff; border: none; border-radius: 8px; cursor: pointer; font-size: 13px; font-weight: 500; transition: all 0.2s; box-shadow: 0 2px 4px rgba(14, 165, 233, 0.2);';
            uploadBtn.innerHTML = '<span>📤</span><span>上传图片</span>';
            uploadBtn.addEventListener('mouseenter', () => {
                uploadBtn.style.background = 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)';
                uploadBtn.style.transform = 'translateY(-1px)';
                uploadBtn.style.boxShadow = '0 4px 8px rgba(14, 165, 233, 0.3)';
            });
            uploadBtn.addEventListener('mouseleave', () => {
                uploadBtn.style.background = 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)';
                uploadBtn.style.transform = 'translateY(0)';
                uploadBtn.style.boxShadow = '0 2px 4px rgba(14, 165, 233, 0.2)';
            });
            
            const fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.accept = 'image/*';
            fileInput.style.display = 'none';
            fileInput.addEventListener('change', () => {
                if (fileInput.files && fileInput.files[0]) {
                    uploadImage(fileInput.files[0], itemPath, imageInput, sectionKey).then(() => {
                        // 上传成功后，立即更新预览
                        updatePreview();
                    }).catch(err => {
                        // 上传失败，静默处理
                    });
                }
            });
            uploadBtn.addEventListener('click', () => fileInput.click());
            actionControls.appendChild(uploadBtn);
            actionControls.appendChild(fileInput);
            
            // 删除按钮（参考页脚信息的样式）
            const deleteBtn = document.createElement('button');
            deleteBtn.type = 'button';
            deleteBtn.className = 'btn-chip';
            deleteBtn.style.cssText = 'display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; padding: 0; background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%); color: #dc2626; font-size: 14px; white-space: nowrap; border: 1px solid #fca5a5; border-radius: 8px; cursor: pointer; transition: all 0.2s ease; flex-shrink: 0;';
            deleteBtn.innerHTML = '✕';
            deleteBtn.title = '删除此图片';
            deleteBtn.addEventListener('mouseenter', () => {
                deleteBtn.style.background = 'linear-gradient(135deg, #fecaca 0%, #fca5a5 100%)';
                deleteBtn.style.transform = 'scale(1.05)';
            });
            deleteBtn.addEventListener('mouseleave', () => {
                deleteBtn.style.background = 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)';
                deleteBtn.style.transform = 'scale(1)';
            });
            deleteBtn.addEventListener('click', () => {
                // 直接删除，不需要确认提示框
                const currentArray = getValueByPath(editingContent, path);
                if (Array.isArray(currentArray)) {
                    currentArray.splice(index, 1);
                    setValueByPath(editingContent, path, currentArray);
                    markSectionDirty(sectionKey);
                    // 重新渲染整个栏目（不滚动）
                    navigateToSection(sectionKey, false);
                }
            });
            actionControls.appendChild(deleteBtn);
            
            imageRow.appendChild(actionControls);
            
            arrayContainer.appendChild(imageRow);
            return;
        }
        
        // 如果是段落数组，特殊处理
        if (isParagraphs) {
            const paragraphContainer = document.createElement('div');
            paragraphContainer.style.cssText = 'padding: 16px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; margin-bottom: 16px;';
            
            // 添加段落标题（段落1、段落2等）
            const paragraphTitle = document.createElement('div');
            paragraphTitle.style.cssText = 'font-weight: 600; font-size: 16px; color: #1f2937; margin-bottom: 12px;';
            paragraphTitle.textContent = `段落${index + 1}`;
            paragraphContainer.appendChild(paragraphTitle);
            
            // 创建文本输入框（使用 textarea，因为段落可能很长）
            const paragraphInput = document.createElement('textarea');
            paragraphInput.value = item || '';
            paragraphInput.placeholder = '请输入段落内容';
            paragraphInput.className = 'form-input';
            paragraphInput.style.cssText = 'width: 100%; min-height: 100px; resize: vertical; padding: 12px; border: 1px solid var(--border); border-radius: 8px; font-size: 14px; line-height: 1.6;';
            paragraphInput.addEventListener('blur', () => {
                setValueByPath(editingContent, itemPath, paragraphInput.value);
                markSectionDirty(sectionKey);
            });
            paragraphInput.addEventListener('input', () => {
                setValueByPath(editingContent, itemPath, paragraphInput.value);
                markSectionDirty(sectionKey);
            });
            paragraphContainer.appendChild(paragraphInput);
            
            // 添加删除按钮
            const deleteBtn = document.createElement('button');
            deleteBtn.type = 'button';
            deleteBtn.className = 'btn-chip';
            deleteBtn.style.cssText = 'display: flex; align-items: center; justify-content: center; gap: 6px; width: 100%; padding: 10px 16px; background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%); color: #dc2626; font-size: 13px; font-weight: 500; margin-top: 12px; border: 1px solid #fca5a5; border-radius: 10px; cursor: pointer; transition: all 0.2s ease; box-shadow: 0 1px 3px rgba(220, 38, 38, 0.2);';
            deleteBtn.innerHTML = '<span>🗑️</span> <span>删除段落</span>';
            deleteBtn.addEventListener('mouseenter', () => {
                deleteBtn.style.background = 'linear-gradient(135deg, #fecaca 0%, #fca5a5 100%)';
                deleteBtn.style.transform = 'translateY(-1px)';
                deleteBtn.style.boxShadow = '0 2px 6px rgba(220, 38, 38, 0.3)';
            });
            deleteBtn.addEventListener('mouseleave', () => {
                deleteBtn.style.background = 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)';
                deleteBtn.style.transform = 'translateY(0)';
                deleteBtn.style.boxShadow = '0 1px 3px rgba(220, 38, 38, 0.2)';
            });
            deleteBtn.addEventListener('click', () => {
                const currentArray = getValueByPath(editingContent, path);
                if (Array.isArray(currentArray)) {
                    currentArray.splice(index, 1);
                    setValueByPath(editingContent, path, currentArray);
                    markSectionDirty(sectionKey);
                    // 重新渲染整个栏目（不滚动）
                    navigateToSection(sectionKey, false);
                }
            });
            paragraphContainer.appendChild(deleteBtn);
            
            arrayContainer.appendChild(paragraphContainer);
            return;
        }
        
        // 如果是时间线数组，特殊处理
        if (isTimeline && item && typeof item === 'object') {
            const timelineContainer = document.createElement('div');
            timelineContainer.style.cssText = 'padding: 16px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; margin-bottom: 16px;';
            
            // 添加时间线标题（时间线1、时间线2等）
            const timelineTitle = document.createElement('div');
            timelineTitle.style.cssText = 'font-weight: 600; font-size: 16px; color: #1f2937; margin-bottom: 12px;';
            timelineTitle.textContent = `时间线${index + 1}`;
            timelineContainer.appendChild(timelineTitle);
            
            // 渲染时间线项的字段（year、title、description）
            renderSectionFieldsFlat(timelineContainer, item, itemPath, sectionKey);
            
            // 添加删除按钮
            const deleteBtn = document.createElement('button');
            deleteBtn.type = 'button';
            deleteBtn.className = 'btn-chip';
            deleteBtn.style.cssText = 'display: flex; align-items: center; justify-content: center; gap: 6px; width: 100%; padding: 10px 16px; background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%); color: #dc2626; font-size: 13px; font-weight: 500; margin-top: 12px; border: 1px solid #fca5a5; border-radius: 10px; cursor: pointer; transition: all 0.2s ease; box-shadow: 0 1px 3px rgba(220, 38, 38, 0.2);';
            deleteBtn.innerHTML = '<span>🗑️</span> <span>删除时间线</span>';
            deleteBtn.addEventListener('mouseenter', () => {
                deleteBtn.style.background = 'linear-gradient(135deg, #fecaca 0%, #fca5a5 100%)';
                deleteBtn.style.transform = 'translateY(-1px)';
                deleteBtn.style.boxShadow = '0 2px 6px rgba(220, 38, 38, 0.3)';
            });
            deleteBtn.addEventListener('mouseleave', () => {
                deleteBtn.style.background = 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)';
                deleteBtn.style.transform = 'translateY(0)';
                deleteBtn.style.boxShadow = '0 1px 3px rgba(220, 38, 38, 0.2)';
            });
            deleteBtn.addEventListener('click', () => {
                const currentArray = getValueByPath(editingContent, path);
                if (Array.isArray(currentArray)) {
                    currentArray.splice(index, 1);
                    setValueByPath(editingContent, path, currentArray);
                    markSectionDirty(sectionKey);
                    // 重新渲染整个栏目（不滚动）
                    navigateToSection(sectionKey, false);
                }
            });
            timelineContainer.appendChild(deleteBtn);
            
            arrayContainer.appendChild(timelineContainer);
            return;
        }
        
        // 如果是营业时间数组，特殊处理
        if (isHours) {
            const hoursContainer = document.createElement('div');
            hoursContainer.style.cssText = 'padding: 16px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; margin-bottom: 16px;';
            
            // 添加营业时间标题（营业时间1、营业时间2等）
            const hoursTitle = document.createElement('div');
            hoursTitle.style.cssText = 'font-weight: 600; font-size: 16px; color: #1f2937; margin-bottom: 12px;';
            hoursTitle.textContent = `营业时间${index + 1}`;
            hoursContainer.appendChild(hoursTitle);
            
            // 创建文本输入框
            const hoursInput = document.createElement('input');
            hoursInput.type = 'text';
            hoursInput.value = item || '';
            hoursInput.placeholder = '请输入营业时间';
            hoursInput.className = 'form-input';
            hoursInput.style.cssText = 'width: 100%; padding: 12px; border: 1px solid var(--border); border-radius: 8px; font-size: 14px;';
            hoursInput.addEventListener('blur', () => {
                setValueByPath(editingContent, itemPath, hoursInput.value);
                markSectionDirty(sectionKey);
            });
            hoursInput.addEventListener('input', () => {
                setValueByPath(editingContent, itemPath, hoursInput.value);
                markSectionDirty(sectionKey);
            });
            hoursContainer.appendChild(hoursInput);
            
            // 添加删除按钮
            const deleteBtn = document.createElement('button');
            deleteBtn.type = 'button';
            deleteBtn.className = 'btn-chip';
            deleteBtn.style.cssText = 'display: flex; align-items: center; justify-content: center; gap: 6px; width: 100%; padding: 10px 16px; background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%); color: #dc2626; font-size: 13px; font-weight: 500; margin-top: 12px; border: 1px solid #fca5a5; border-radius: 10px; cursor: pointer; transition: all 0.2s ease; box-shadow: 0 1px 3px rgba(220, 38, 38, 0.2);';
            deleteBtn.innerHTML = '<span>🗑️</span> <span>删除营业时间</span>';
            deleteBtn.addEventListener('mouseenter', () => {
                deleteBtn.style.background = 'linear-gradient(135deg, #fecaca 0%, #fca5a5 100%)';
                deleteBtn.style.transform = 'translateY(-1px)';
                deleteBtn.style.boxShadow = '0 2px 6px rgba(220, 38, 38, 0.3)';
            });
            deleteBtn.addEventListener('mouseleave', () => {
                deleteBtn.style.background = 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)';
                deleteBtn.style.transform = 'translateY(0)';
                deleteBtn.style.boxShadow = '0 1px 3px rgba(220, 38, 38, 0.2)';
            });
            deleteBtn.addEventListener('click', () => {
                const currentArray = getValueByPath(editingContent, path);
                if (Array.isArray(currentArray)) {
                    currentArray.splice(index, 1);
                    setValueByPath(editingContent, path, currentArray);
                    markSectionDirty(sectionKey);
                    // 重新渲染整个栏目（不滚动）
                    navigateToSection(sectionKey, false);
                }
            });
            hoursContainer.appendChild(deleteBtn);
            
            arrayContainer.appendChild(hoursContainer);
            return;
        }
        
        if (item && typeof item === 'object') {
            // 对象数组，递归渲染字段（平铺显示）
            // 如果是筛选标签数组，特殊处理
            if (isFilters) {
                // 跳过"全部"分类
                const filterCategory = item.category || 'all';
                if (filterCategory === 'all') {
                    return; // 跳过"全部"分类的渲染
                }
                
                // 为每个筛选标签项添加容器
                const filterItemContainer = document.createElement('div');
                filterItemContainer.style.cssText = 'padding: 16px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; margin-bottom: 16px;';
                
                // 渲染筛选标签项的字段（只显示label，category字段已隐藏）
                renderSectionFieldsFlat(filterItemContainer, item, itemPath, sectionKey);
                
                // 添加删除按钮
                const deleteBtn = document.createElement('button');
                deleteBtn.type = 'button';
                deleteBtn.className = 'btn-chip';
                deleteBtn.style.cssText = 'display: flex; align-items: center; justify-content: center; gap: 6px; width: 100%; padding: 10px 16px; background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%); color: #dc2626; font-size: 13px; font-weight: 500; margin-top: 12px; border: 1px solid #fca5a5; border-radius: 10px; cursor: pointer; transition: all 0.2s ease; box-shadow: 0 1px 3px rgba(220, 38, 38, 0.2);';
                deleteBtn.innerHTML = '<span>🗑️</span> <span>删除</span>';
                deleteBtn.addEventListener('mouseenter', () => {
                    deleteBtn.style.background = 'linear-gradient(135deg, #fecaca 0%, #fca5a5 100%)';
                    deleteBtn.style.transform = 'translateY(-1px)';
                    deleteBtn.style.boxShadow = '0 2px 6px rgba(220, 38, 38, 0.3)';
                });
                deleteBtn.addEventListener('mouseleave', () => {
                    deleteBtn.style.background = 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)';
                    deleteBtn.style.transform = 'translateY(0)';
                    deleteBtn.style.boxShadow = '0 1px 3px rgba(220, 38, 38, 0.2)';
                });
                deleteBtn.addEventListener('click', () => {
                    const currentFiltersArray = getValueByPath(editingContent, path);
                    if (Array.isArray(currentFiltersArray)) {
                        // 获取要删除的筛选标签的 label（用于匹配 productSeries）
                        // 确保从当前数组项中获取 label，而不是闭包中的 item
                        const filterItem = currentFiltersArray[index];
                        const filterLabel = filterItem && filterItem.label ? filterItem.label.trim() : '';
                        
                        if (!filterLabel) {
                            // 筛选标签的 label 为空，跳过
                        }
                        
                        // 删除筛选标签
                        currentFiltersArray.splice(index, 1);
                        
                        // 同时删除对应分类的产品卡片
                        // editingContent 存储的是当前页面的所有栏目数据
                        const productCardsArray = editingContent.productCards;
                        if (Array.isArray(productCardsArray)) {
                            // 从后往前删除，避免索引问题
                            for (let i = productCardsArray.length - 1; i >= 0; i--) {
                                if (productCardsArray[i].category === filterCategory) {
                                    productCardsArray.splice(i, 1);
                                }
                            }
                        }
                        
                        // 删除首页的产品系列标签中对应的标签（通过 label 匹配）
                        // 需要访问首页的数据，无论当前在哪个页面
                        if (filterLabel) {
                            if (currentContentPage === 'home') {
                                // 如果正在编辑首页，直接使用当前的 editingContent
                                if (editingContent.productSeries && Array.isArray(editingContent.productSeries)) {
                                    // 查找并删除匹配的标签（精确匹配，去除空格）
                                    const seriesIndex = editingContent.productSeries.findIndex(
                                        series => series && series.trim() === filterLabel
                                    );
                                    if (seriesIndex >= 0) {
                                        editingContent.productSeries.splice(seriesIndex, 1);
                                        markSectionDirty('productSeries');
                                    }
                                }
                            } else {
                                // 如果不在编辑首页，需要记录跨页面的修改
                                const homePageData = siteContentCache?.pages?.home;
                                if (homePageData && homePageData.productSeries && Array.isArray(homePageData.productSeries)) {
                                    // 先保存修改前的数据（在修改之前）
                                    const beforeData = [...homePageData.productSeries];
                                    
                                    // 创建首页 productSeries 的副本
                                    const homeProductSeries = [...homePageData.productSeries];
                                    // 查找并删除匹配的标签（精确匹配，去除空格）
                                    const seriesIndex = homeProductSeries.findIndex(
                                        series => series && series.trim() === filterLabel
                                    );
                                    if (seriesIndex >= 0) {
                                        homeProductSeries.splice(seriesIndex, 1);
                                        
                                        // 记录跨页面的修改（包含修改前和修改后的数据）
                                        if (!crossPageChanges['home']) {
                                            crossPageChanges['home'] = {};
                                        }
                                        crossPageChanges['home']['productSeries'] = {
                                            beforeData: beforeData,
                                            afterData: homeProductSeries
                                        };
                                        
                                        // 同时更新缓存，以便在保存时使用
                                        if (siteContentCache && siteContentCache.pages && siteContentCache.pages.home) {
                                            siteContentCache.pages.home.productSeries = homeProductSeries;
                                        }
                                    }
                                }
                            }
                        }
                        
                        // 删除标签分类对应的图片数组（categories 数组）
                        // categories 是按空间分类的，与产品系列标签没有直接关系
                        // 但用户要求删除，可能是希望删除相关的图片
                        // 这里先不处理 categories，因为它是按空间分类的，不是按产品系列分类的
                        
                        setValueByPath(editingContent, path, currentFiltersArray);
                        markSectionDirty(sectionKey);
                        // 重新渲染整个栏目（不更新侧边栏，等保存后再更新）
                        navigateToSection(sectionKey, false);
                    }
                });
                filterItemContainer.appendChild(deleteBtn);
                
                arrayContainer.appendChild(filterItemContainer);
                return;
            }
            
            // 如果是cases数组，特殊处理
            if (isCases) {
                // 为每个精选案例项添加容器
                const caseItemContainer = document.createElement('div');
                caseItemContainer.style.cssText = 'padding: 16px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; margin-bottom: 16px;';
                
                // 渲染精选案例项的字段（title、description和image）
                renderSectionFieldsFlat(caseItemContainer, item, itemPath, sectionKey);
                
                // 添加删除按钮
                const deleteBtn = document.createElement('button');
                deleteBtn.type = 'button';
                deleteBtn.className = 'btn-chip';
                deleteBtn.style.cssText = 'display: flex; align-items: center; justify-content: center; gap: 6px; width: 100%; padding: 10px 16px; background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%); color: #dc2626; font-size: 13px; font-weight: 500; margin-top: 12px; border: 1px solid #fca5a5; border-radius: 10px; cursor: pointer; transition: all 0.2s ease; box-shadow: 0 1px 3px rgba(220, 38, 38, 0.2);';
                deleteBtn.innerHTML = '<span>🗑️</span> <span>删除</span>';
                deleteBtn.addEventListener('mouseenter', () => {
                    deleteBtn.style.background = 'linear-gradient(135deg, #fecaca 0%, #fca5a5 100%)';
                    deleteBtn.style.transform = 'translateY(-1px)';
                    deleteBtn.style.boxShadow = '0 2px 6px rgba(220, 38, 38, 0.3)';
                });
                deleteBtn.addEventListener('mouseleave', () => {
                    deleteBtn.style.background = 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)';
                    deleteBtn.style.transform = 'translateY(0)';
                    deleteBtn.style.boxShadow = '0 1px 3px rgba(220, 38, 38, 0.2)';
                });
                deleteBtn.addEventListener('click', () => {
                    const currentArray = getValueByPath(editingContent, path);
                    if (Array.isArray(currentArray)) {
                        currentArray.splice(index, 1);
                        setValueByPath(editingContent, path, currentArray);
                        markSectionDirty(sectionKey);
                        // 重新渲染整个栏目
                        navigateToSection(sectionKey, false);
                    }
                });
                caseItemContainer.appendChild(deleteBtn);
                
                arrayContainer.appendChild(caseItemContainer);
                return;
            }
            
            // 如果是casesGrid数组，特殊处理
            if (isCasesGrid) {
                // 为每个案例网格项添加容器
                const caseGridItemContainer = document.createElement('div');
                caseGridItemContainer.style.cssText = 'padding: 16px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; margin-bottom: 16px;';
                
                // 渲染案例网格项的字段（title、description、image和images）
                renderSectionFieldsFlat(caseGridItemContainer, item, itemPath, sectionKey);
                
                // 添加删除按钮
                const deleteBtn = document.createElement('button');
                deleteBtn.type = 'button';
                deleteBtn.className = 'btn-chip';
                deleteBtn.style.cssText = 'display: flex; align-items: center; justify-content: center; gap: 6px; width: 100%; padding: 10px 16px; background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%); color: #dc2626; font-size: 13px; font-weight: 500; margin-top: 12px; border: 1px solid #fca5a5; border-radius: 10px; cursor: pointer; transition: all 0.2s ease; box-shadow: 0 1px 3px rgba(220, 38, 38, 0.2);';
                deleteBtn.innerHTML = '<span>🗑️</span> <span>删除</span>';
                deleteBtn.addEventListener('mouseenter', () => {
                    deleteBtn.style.background = 'linear-gradient(135deg, #fecaca 0%, #fca5a5 100%)';
                    deleteBtn.style.transform = 'translateY(-1px)';
                    deleteBtn.style.boxShadow = '0 2px 6px rgba(220, 38, 38, 0.3)';
                });
                deleteBtn.addEventListener('mouseleave', () => {
                    deleteBtn.style.background = 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)';
                    deleteBtn.style.transform = 'translateY(0)';
                    deleteBtn.style.boxShadow = '0 1px 3px rgba(220, 38, 38, 0.2)';
                });
                deleteBtn.addEventListener('click', () => {
                    const currentArray = getValueByPath(editingContent, path);
                    if (Array.isArray(currentArray)) {
                        currentArray.splice(index, 1);
                        setValueByPath(editingContent, path, currentArray);
                        markSectionDirty(sectionKey);
                        // 重新渲染整个栏目
                        navigateToSection(sectionKey, false);
                    }
                });
                caseGridItemContainer.appendChild(deleteBtn);
                
                arrayContainer.appendChild(caseGridItemContainer);
                return;
            }
            
            // 如果是advantages数组，特殊处理
            if (isAdvantages) {
                // 为每个服务优势项添加容器
                const advantageItemContainer = document.createElement('div');
                advantageItemContainer.style.cssText = 'padding: 16px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; margin-bottom: 16px;';
                
                // 添加数字标题（基于索引，从01开始）
                const numberTitle = document.createElement('div');
                numberTitle.style.cssText = 'display: flex; align-items: center; justify-content: center; width: 48px; height: 48px; background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%); color: #fff; font-size: 20px; font-weight: 700; border-radius: 12px; margin-bottom: 16px; box-shadow: 0 4px 12px rgba(14, 165, 233, 0.25);';
                const number = String(index + 1).padStart(2, '0');
                numberTitle.textContent = number;
                advantageItemContainer.appendChild(numberTitle);
                
                // 渲染服务优势项的字段（只渲染title和description，不渲染icon）
                // 创建一个新的对象，排除icon字段
                const itemWithoutIcon = { ...item };
                delete itemWithoutIcon.icon;
                renderSectionFieldsFlat(advantageItemContainer, itemWithoutIcon, itemPath, sectionKey);
                
                // 添加删除按钮
                const deleteBtn = document.createElement('button');
                deleteBtn.type = 'button';
                deleteBtn.className = 'btn-chip';
                deleteBtn.style.cssText = 'display: flex; align-items: center; justify-content: center; gap: 6px; width: 100%; padding: 10px 16px; background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%); color: #dc2626; font-size: 13px; font-weight: 500; margin-top: 12px; border: 1px solid #fca5a5; border-radius: 10px; cursor: pointer; transition: all 0.2s ease; box-shadow: 0 1px 3px rgba(220, 38, 38, 0.2);';
                deleteBtn.innerHTML = '<span>🗑️</span> <span>删除</span>';
                deleteBtn.addEventListener('mouseenter', () => {
                    deleteBtn.style.background = 'linear-gradient(135deg, #fecaca 0%, #fca5a5 100%)';
                    deleteBtn.style.transform = 'translateY(-1px)';
                    deleteBtn.style.boxShadow = '0 2px 6px rgba(220, 38, 38, 0.3)';
                });
                deleteBtn.addEventListener('mouseleave', () => {
                    deleteBtn.style.background = 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)';
                    deleteBtn.style.transform = 'translateY(0)';
                    deleteBtn.style.boxShadow = '0 1px 3px rgba(220, 38, 38, 0.2)';
                });
                deleteBtn.addEventListener('click', () => {
                    const currentArray = getValueByPath(editingContent, path);
                    if (Array.isArray(currentArray)) {
                        currentArray.splice(index, 1);
                        setValueByPath(editingContent, path, currentArray);
                        markSectionDirty(sectionKey);
                        // 重新渲染整个栏目
                        navigateToSection(sectionKey, false);
                    }
                });
                advantageItemContainer.appendChild(deleteBtn);
                
                arrayContainer.appendChild(advantageItemContainer);
                return;
            }
            
            // 如果是featured.small或featured.large数组，特殊处理
            if (isFeaturedSubsection) {
                // 为每个重点案例项添加容器
                const featuredItemContainer = document.createElement('div');
                featuredItemContainer.style.cssText = 'padding: 16px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; margin-bottom: 16px;';
                
                // 渲染重点案例项的字段（title、description、image和images）
                renderSectionFieldsFlat(featuredItemContainer, item, itemPath, sectionKey);
                
                // 添加删除按钮
                const deleteBtn = document.createElement('button');
                deleteBtn.type = 'button';
                deleteBtn.className = 'btn-chip';
                deleteBtn.style.cssText = 'display: flex; align-items: center; justify-content: center; gap: 6px; width: 100%; padding: 10px 16px; background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%); color: #dc2626; font-size: 13px; font-weight: 500; margin-top: 12px; border: 1px solid #fca5a5; border-radius: 10px; cursor: pointer; transition: all 0.2s ease; box-shadow: 0 1px 3px rgba(220, 38, 38, 0.2);';
                deleteBtn.innerHTML = '<span>🗑️</span> <span>删除</span>';
                deleteBtn.addEventListener('mouseenter', () => {
                    deleteBtn.style.background = 'linear-gradient(135deg, #fecaca 0%, #fca5a5 100%)';
                    deleteBtn.style.transform = 'translateY(-1px)';
                    deleteBtn.style.boxShadow = '0 2px 6px rgba(220, 38, 38, 0.3)';
                });
                deleteBtn.addEventListener('mouseleave', () => {
                    deleteBtn.style.background = 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)';
                    deleteBtn.style.transform = 'translateY(0)';
                    deleteBtn.style.boxShadow = '0 1px 3px rgba(220, 38, 38, 0.2)';
                });
                deleteBtn.addEventListener('click', () => {
                    const currentArray = getValueByPath(editingContent, path);
                    if (Array.isArray(currentArray)) {
                        currentArray.splice(index, 1);
                        setValueByPath(editingContent, path, currentArray);
                        markSectionDirty(sectionKey);
                        // 重新渲染整个栏目
                        navigateToSection(sectionKey, false);
                    }
                });
                featuredItemContainer.appendChild(deleteBtn);
                
                arrayContainer.appendChild(featuredItemContainer);
                return;
            }
            
            // 如果是productGallery数组，特殊处理
            if (isProductGallery) {
                // 为每个产品画廊项添加容器
                const galleryItemContainer = document.createElement('div');
                galleryItemContainer.style.cssText = 'padding: 16px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; margin-bottom: 16px;';
                
                // 渲染产品画廊项的字段（title和image）
                renderSectionFieldsFlat(galleryItemContainer, item, itemPath, sectionKey);
                
                // 添加删除按钮
                const deleteBtn = document.createElement('button');
                deleteBtn.type = 'button';
                deleteBtn.className = 'btn-chip';
                deleteBtn.style.cssText = 'display: flex; align-items: center; justify-content: center; gap: 6px; width: 100%; padding: 10px 16px; background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%); color: #dc2626; font-size: 13px; font-weight: 500; margin-top: 12px; border: 1px solid #fca5a5; border-radius: 10px; cursor: pointer; transition: all 0.2s ease; box-shadow: 0 1px 3px rgba(220, 38, 38, 0.2);';
                deleteBtn.innerHTML = '<span>🗑️</span> <span>删除</span>';
                deleteBtn.addEventListener('mouseenter', () => {
                    deleteBtn.style.background = 'linear-gradient(135deg, #fecaca 0%, #fca5a5 100%)';
                    deleteBtn.style.transform = 'translateY(-1px)';
                    deleteBtn.style.boxShadow = '0 2px 6px rgba(220, 38, 38, 0.3)';
                });
                deleteBtn.addEventListener('mouseleave', () => {
                    deleteBtn.style.background = 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)';
                    deleteBtn.style.transform = 'translateY(0)';
                    deleteBtn.style.boxShadow = '0 1px 3px rgba(220, 38, 38, 0.2)';
                });
                deleteBtn.addEventListener('click', () => {
                    const currentArray = getValueByPath(editingContent, path);
                    if (Array.isArray(currentArray)) {
                        currentArray.splice(index, 1);
                        setValueByPath(editingContent, path, currentArray);
                        markSectionDirty(sectionKey);
                        // 重新渲染整个栏目
                        navigateToSection(sectionKey, false);
                    }
                });
                galleryItemContainer.appendChild(deleteBtn);
                
                arrayContainer.appendChild(galleryItemContainer);
                return;
            }
            
            // 如果是productCards数组，特殊处理
            if (isProductCards) {
                // 为每个产品卡片项添加容器
                const productCardContainer = document.createElement('div');
                productCardContainer.style.cssText = 'padding: 16px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; margin-bottom: 16px;';
                
                // 渲染产品卡片项的字段（title、description和image，category和detailedDescription已隐藏）
                renderSectionFieldsFlat(productCardContainer, item, itemPath, sectionKey);
                
                // 添加删除按钮
                const deleteBtn = document.createElement('button');
                deleteBtn.type = 'button';
                deleteBtn.className = 'btn-chip';
                deleteBtn.style.cssText = 'display: flex; align-items: center; justify-content: center; gap: 6px; width: 100%; padding: 10px 16px; background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%); color: #dc2626; font-size: 13px; font-weight: 500; margin-top: 12px; border: 1px solid #fca5a5; border-radius: 10px; cursor: pointer; transition: all 0.2s ease; box-shadow: 0 1px 3px rgba(220, 38, 38, 0.2);';
                deleteBtn.innerHTML = '<span>🗑️</span> <span>删除</span>';
                deleteBtn.addEventListener('mouseenter', () => {
                    deleteBtn.style.background = 'linear-gradient(135deg, #fecaca 0%, #fca5a5 100%)';
                    deleteBtn.style.transform = 'translateY(-1px)';
                    deleteBtn.style.boxShadow = '0 2px 6px rgba(220, 38, 38, 0.3)';
                });
                deleteBtn.addEventListener('mouseleave', () => {
                    deleteBtn.style.background = 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)';
                    deleteBtn.style.transform = 'translateY(0)';
                    deleteBtn.style.boxShadow = '0 1px 3px rgba(220, 38, 38, 0.2)';
                });
                deleteBtn.addEventListener('click', () => {
                    const currentArray = getValueByPath(editingContent, path);
                    if (Array.isArray(currentArray)) {
                        // 保存当前选中的分类，以便重新渲染后恢复
                        const savedSubsection = currentSubsection;
                        currentArray.splice(index, 1);
                        setValueByPath(editingContent, path, currentArray);
                        markSectionDirty(sectionKey);
                        // 重新渲染整个栏目，但保持当前分类选择
                        currentSection = sectionKey;
                        currentSubsection = savedSubsection; // 恢复分类选择
                        renderContentEditor(); // 直接重新渲染编辑器，不重置分类
                    }
                });
                productCardContainer.appendChild(deleteBtn);
                
                arrayContainer.appendChild(productCardContainer);
                return;
            }
            
            // 如果是columns数组，添加项标题和标签管理
            if (isFooterColumns) {
                const itemHeader = document.createElement('div');
                itemHeader.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; padding-bottom: 8px; border-bottom: 2px solid var(--primary);';
                
                const itemTitle = document.createElement('div');
                itemTitle.style.cssText = 'font-size: 16px; font-weight: 600; color: #1f2937;';
                itemTitle.textContent = '系列标题';
                itemHeader.appendChild(itemTitle);
                
                arrayContainer.appendChild(itemHeader);
                
                // 渲染系列标题字段（只渲染title字段）
                const titleFieldPath = [...itemPath, 'title'];
                const titleField = createPrimitiveField('系列标题', item.title || '', titleFieldPath, sectionKey);
                arrayContainer.appendChild(titleField);
                
                // 渲染标签（links数组）
                const labelsContainer = document.createElement('div');
                labelsContainer.style.cssText = 'margin-top: 20px; margin-bottom: 20px; padding: 16px; background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); border-radius: 12px; border: 1px solid #e2e8f0;';
                
                const labelsTitle = document.createElement('div');
                labelsTitle.style.cssText = 'display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 600; color: #1f2937; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 2px solid #e2e8f0;';
                const titleIcon = document.createElement('span');
                titleIcon.textContent = '🏷️';
                titleIcon.style.cssText = 'font-size: 16px;';
                labelsTitle.appendChild(titleIcon);
                const titleText = document.createElement('span');
                titleText.textContent = '标签';
                labelsTitle.appendChild(titleText);
                labelsContainer.appendChild(labelsTitle);
                
                // 标签列表容器
                const labelsList = document.createElement('div');
                labelsList.style.cssText = 'display: flex; flex-direction: column; gap: 10px; margin-bottom: 12px;';
                
                // 显示现有的标签（links数组中的label）
                const linksArray = item.links || [];
                if (linksArray.length === 0) {
                    const emptyHint = document.createElement('div');
                    emptyHint.style.cssText = 'text-align: center; padding: 20px; color: #374151; font-size: 13px; font-style: italic; background: rgba(255, 255, 255, 0.5); border-radius: 8px; border: 1px dashed #cbd5e1;';
                    emptyHint.textContent = '暂无标签，点击下方按钮添加';
                    labelsList.appendChild(emptyHint);
                } else {
                    linksArray.forEach((link, linkIndex) => {
                        const labelRow = document.createElement('div');
                        labelRow.style.cssText = 'display: flex; align-items: center; gap: 10px; padding: 12px 14px; background: white; border: 1px solid #e2e8f0; border-radius: 10px; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05); transition: all 0.2s ease;';
                        labelRow.addEventListener('mouseenter', () => {
                            labelRow.style.boxShadow = '0 2px 6px rgba(0, 0, 0, 0.1)';
                            labelRow.style.borderColor = '#cbd5e1';
                        });
                        labelRow.addEventListener('mouseleave', () => {
                            labelRow.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.05)';
                            labelRow.style.borderColor = '#e2e8f0';
                        });
                        
                        // 标签序号图标
                        const labelIndex = document.createElement('div');
                        labelIndex.style.cssText = 'display: flex; align-items: center; justify-content: center; width: 24px; height: 24px; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; border-radius: 6px; font-size: 11px; font-weight: 600; flex-shrink: 0;';
                        labelIndex.textContent = linkIndex + 1;
                        labelRow.appendChild(labelIndex);
                        
                        const labelInput = document.createElement('input');
                        labelInput.type = 'text';
                        labelInput.value = link.label || '';
                        labelInput.placeholder = '请输入标签名称';
                        labelInput.style.cssText = 'flex: 1; padding: 8px 12px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 13px; background: #f8fafc; transition: all 0.2s ease; outline: none;';
                        labelInput.addEventListener('focus', () => {
                            labelInput.style.borderColor = '#3b82f6';
                            labelInput.style.background = 'white';
                            labelInput.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                        });
                        labelInput.addEventListener('blur', () => {
                            labelInput.style.borderColor = '#e2e8f0';
                            labelInput.style.background = '#f8fafc';
                            labelInput.style.boxShadow = 'none';
                        });
                        labelInput.addEventListener('input', () => {
                            const currentItem = getValueByPath(editingContent, itemPath);
                            if (currentItem && currentItem.links && currentItem.links[linkIndex]) {
                                currentItem.links[linkIndex].label = labelInput.value;
                                markSectionDirty(sectionKey);
                            }
                        });
                        labelRow.appendChild(labelInput);
                        
                        // 删除标签按钮
                        const deleteLabelBtn = document.createElement('button');
                        deleteLabelBtn.type = 'button';
                        deleteLabelBtn.className = 'btn-chip';
                        deleteLabelBtn.style.cssText = 'display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; padding: 0; background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%); color: #dc2626; font-size: 14px; white-space: nowrap; border: 1px solid #fca5a5; border-radius: 8px; cursor: pointer; transition: all 0.2s ease; flex-shrink: 0;';
                        deleteLabelBtn.innerHTML = '✕';
                        deleteLabelBtn.addEventListener('mouseenter', () => {
                            deleteLabelBtn.style.background = 'linear-gradient(135deg, #fecaca 0%, #fca5a5 100%)';
                            deleteLabelBtn.style.transform = 'scale(1.05)';
                        });
                        deleteLabelBtn.addEventListener('mouseleave', () => {
                            deleteLabelBtn.style.background = 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)';
                            deleteLabelBtn.style.transform = 'scale(1)';
                        });
                        deleteLabelBtn.addEventListener('click', () => {
                            const currentItem = getValueByPath(editingContent, itemPath);
                            if (currentItem && currentItem.links && Array.isArray(currentItem.links)) {
                                currentItem.links.splice(linkIndex, 1);
                                // 重新渲染整个栏目（不滚动）
                                navigateToSection(sectionKey, false);
                                markSectionDirty(sectionKey);
                            }
                        });
                        labelRow.appendChild(deleteLabelBtn);
                        
                        labelsList.appendChild(labelRow);
                    });
                }
                
                labelsContainer.appendChild(labelsList);
                
                // 添加标签按钮
                const addLabelBtn = document.createElement('button');
                addLabelBtn.type = 'button';
                addLabelBtn.className = 'btn-chip';
                addLabelBtn.style.cssText = 'display: flex; align-items: center; justify-content: center; gap: 6px; width: 100%; padding: 10px 16px; background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%); color: #2563eb; font-size: 13px; font-weight: 500; margin-top: 0; border: 1px solid #93c5fd; border-radius: 10px; cursor: pointer; transition: all 0.2s ease; box-shadow: 0 1px 3px rgba(37, 99, 235, 0.2);';
                addLabelBtn.innerHTML = '<span style="font-size: 16px;">+</span> <span>添加标签</span>';
                addLabelBtn.addEventListener('mouseenter', () => {
                    addLabelBtn.style.background = 'linear-gradient(135deg, #bfdbfe 0%, #93c5fd 100%)';
                    addLabelBtn.style.transform = 'translateY(-1px)';
                    addLabelBtn.style.boxShadow = '0 2px 6px rgba(37, 99, 235, 0.3)';
                });
                addLabelBtn.addEventListener('mouseleave', () => {
                    addLabelBtn.style.background = 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)';
                    addLabelBtn.style.transform = 'translateY(0)';
                    addLabelBtn.style.boxShadow = '0 1px 3px rgba(37, 99, 235, 0.2)';
                });
                addLabelBtn.addEventListener('click', () => {
                    const currentItem = getValueByPath(editingContent, itemPath);
                    if (currentItem) {
                        if (!currentItem.links) {
                            currentItem.links = [];
                        }
                        currentItem.links.push({ label: '', link: '' });
                        // 重新渲染整个栏目（不滚动）
                        navigateToSection(sectionKey, false);
                        markSectionDirty(sectionKey);
                    }
                });
                labelsContainer.appendChild(addLabelBtn);
                
                arrayContainer.appendChild(labelsContainer);
            } else {
                // 非columns数组，正常渲染
                renderSectionFieldsFlat(arrayContainer, item, itemPath, sectionKey);
            }
        } else {
            // 基本类型数组，直接创建输入框
            // 检查是否是产品系列标签数组
            const isProductSeries = path.length >= 1 && path[path.length - 1] === 'productSeries';
            const fieldLabel = isFooterDescription ? '页脚描述' : (isProductSeries ? '系列标题' : `${label} #${index + 1}`);
            const fieldRow = createPrimitiveField(fieldLabel, item, itemPath, sectionKey);
            
            // 如果是页脚描述数组，添加删除按钮
            if (isFooterDescription) {
                const deleteBtn = document.createElement('button');
                deleteBtn.type = 'button';
                deleteBtn.className = 'btn-chip';
                deleteBtn.style.cssText = 'background: #fee2e2; color: #dc2626; margin-top: 8px;';
                deleteBtn.textContent = '删除';
                deleteBtn.addEventListener('click', () => {
                    // 从数组中删除该项
                    const currentArray = getValueByPath(editingContent, path);
                    if (Array.isArray(currentArray)) {
                        currentArray.splice(index, 1);
                        // 重新渲染整个栏目（不滚动）
                        navigateToSection(sectionKey, false);
                        markSectionDirty(sectionKey);
                    }
                });
                fieldRow.appendChild(deleteBtn);
            }
            
            arrayContainer.appendChild(fieldRow);
        }
    });
    
    // 如果是页脚描述数组，添加"添加描述"按钮
    if (isFooterDescription) {
        // 添加分隔线
        const divider = document.createElement('div');
        divider.style.cssText = 'height: 1px; background: linear-gradient(to right, transparent, var(--border), transparent); margin: 24px 0 16px 0;';
        arrayContainer.appendChild(divider);
        
        const addBtn = document.createElement('button');
        addBtn.type = 'button';
        addBtn.className = 'btn-chip';
        addBtn.style.cssText = 'background: #dbeafe; color: #2563eb; margin-top: 0; margin-bottom: 24px;';
        addBtn.textContent = '+ 添加页脚描述';
        addBtn.addEventListener('click', () => {
            // 向数组中添加新项
            const currentArray = getValueByPath(editingContent, path);
            if (Array.isArray(currentArray)) {
                currentArray.push('');
                // 重新渲染整个栏目（不滚动）
                navigateToSection(sectionKey, false);
                markSectionDirty(sectionKey);
            }
        });
        arrayContainer.appendChild(addBtn);
    }
    
    // 如果是筛选标签数组，添加"添加筛选标签"按钮
    if (isFilters) {
        // 添加分隔线
        const divider = document.createElement('div');
        divider.style.cssText = 'height: 1px; background: linear-gradient(to right, transparent, var(--border), transparent); margin: 24px 0 16px 0;';
        arrayContainer.appendChild(divider);
        
        const addBtn = document.createElement('button');
        addBtn.type = 'button';
        addBtn.className = 'btn-chip';
        addBtn.style.cssText = 'display: flex; align-items: center; justify-content: center; gap: 6px; width: 100%; padding: 10px 16px; background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%); color: #2563eb; font-size: 13px; font-weight: 500; margin-top: 0; margin-bottom: 24px; border: 1px solid #93c5fd; border-radius: 10px; cursor: pointer; transition: all 0.2s ease; box-shadow: 0 1px 3px rgba(37, 99, 235, 0.2);';
        addBtn.innerHTML = '<span style="font-size: 16px;">+</span> <span>添加筛选标签</span>';
        addBtn.addEventListener('mouseenter', () => {
            addBtn.style.background = 'linear-gradient(135deg, #bfdbfe 0%, #93c5fd 100%)';
            addBtn.style.transform = 'translateY(-1px)';
            addBtn.style.boxShadow = '0 2px 6px rgba(37, 99, 235, 0.3)';
        });
        addBtn.addEventListener('mouseleave', () => {
            addBtn.style.background = 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)';
            addBtn.style.transform = 'translateY(0)';
            addBtn.style.boxShadow = '0 1px 3px rgba(37, 99, 235, 0.2)';
        });
        addBtn.addEventListener('click', () => {
            // 向筛选标签数组中添加新项
            const currentFiltersArray = getValueByPath(editingContent, path);
            if (Array.isArray(currentFiltersArray)) {
                // 生成新的分类ID（基于时间戳）
                const newCategory = 'category_' + Date.now();
                const newFilter = {
                    label: '新分类',
                    category: newCategory
                };
                currentFiltersArray.push(newFilter);
                
                // 同时添加一个空的产品卡片
                // editingContent 存储的是当前页面的所有栏目数据
                if (!editingContent.productCards) {
                    editingContent.productCards = [];
                }
                const newProductCard = {
                    category: newCategory,
                    title: '',
                    description: '',
                    detailedDescription: '',
                    image: ''
                };
                editingContent.productCards.push(newProductCard);
                
                setValueByPath(editingContent, path, currentFiltersArray);
                markSectionDirty(sectionKey);
                // 重新渲染整个栏目（不更新侧边栏，等保存后再更新）
                navigateToSection(sectionKey, false);
            }
        });
        arrayContainer.appendChild(addBtn);
    }
    
    // 如果是产品画廊数组，添加"添加"按钮
    if (isProductGallery) {
        // 添加分隔线
        const divider = document.createElement('div');
        divider.style.cssText = 'height: 1px; background: linear-gradient(to right, transparent, var(--border), transparent); margin: 24px 0 16px 0;';
        arrayContainer.appendChild(divider);
        
        const addBtn = document.createElement('button');
        addBtn.type = 'button';
        addBtn.className = 'btn-chip';
        addBtn.style.cssText = 'display: flex; align-items: center; justify-content: center; gap: 6px; width: 100%; padding: 10px 16px; background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%); color: #2563eb; font-size: 13px; font-weight: 500; margin-top: 0; margin-bottom: 24px; border: 1px solid #93c5fd; border-radius: 10px; cursor: pointer; transition: all 0.2s ease; box-shadow: 0 1px 3px rgba(37, 99, 235, 0.2);';
        addBtn.innerHTML = '<span style="font-size: 16px;">+</span> <span>添加产品</span>';
        addBtn.addEventListener('mouseenter', () => {
            addBtn.style.background = 'linear-gradient(135deg, #bfdbfe 0%, #93c5fd 100%)';
            addBtn.style.transform = 'translateY(-1px)';
            addBtn.style.boxShadow = '0 2px 6px rgba(37, 99, 235, 0.3)';
        });
        addBtn.addEventListener('mouseleave', () => {
            addBtn.style.background = 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)';
            addBtn.style.transform = 'translateY(0)';
            addBtn.style.boxShadow = '0 1px 3px rgba(37, 99, 235, 0.2)';
        });
        addBtn.addEventListener('click', () => {
            // 向数组中添加新项
            const currentArray = getValueByPath(editingContent, path);
            if (Array.isArray(currentArray)) {
                currentArray.push({ title: '', image: '', description: '' });
                setValueByPath(editingContent, path, currentArray);
                markSectionDirty(sectionKey);
                // 重新渲染整个栏目
                navigateToSection(sectionKey, false);
            }
        });
        arrayContainer.appendChild(addBtn);
    }
    
    // 如果是产品列表数组，添加"添加产品"按钮
    if (isProductCards) {
        // 添加分隔线
        const divider = document.createElement('div');
        divider.style.cssText = 'height: 1px; background: linear-gradient(to right, transparent, var(--border), transparent); margin: 24px 0 16px 0;';
        arrayContainer.appendChild(divider);
        
        const addBtn = document.createElement('button');
        addBtn.type = 'button';
        addBtn.className = 'btn-chip';
        addBtn.style.cssText = 'display: flex; align-items: center; justify-content: center; gap: 6px; width: 100%; padding: 10px 16px; background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%); color: #2563eb; font-size: 13px; font-weight: 500; margin-top: 0; margin-bottom: 24px; border: 1px solid #93c5fd; border-radius: 10px; cursor: pointer; transition: all 0.2s ease; box-shadow: 0 1px 3px rgba(37, 99, 235, 0.2);';
        addBtn.innerHTML = '<span style="font-size: 16px;">+</span> <span>添加产品</span>';
        addBtn.addEventListener('mouseenter', () => {
            addBtn.style.background = 'linear-gradient(135deg, #bfdbfe 0%, #93c5fd 100%)';
            addBtn.style.transform = 'translateY(-1px)';
            addBtn.style.boxShadow = '0 2px 6px rgba(37, 99, 235, 0.3)';
        });
        addBtn.addEventListener('mouseleave', () => {
            addBtn.style.background = 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)';
            addBtn.style.transform = 'translateY(0)';
            addBtn.style.boxShadow = '0 1px 3px rgba(37, 99, 235, 0.2)';
        });
        addBtn.addEventListener('click', () => {
            // 向产品列表数组中添加新项
            const currentArray = getValueByPath(editingContent, path);
            if (Array.isArray(currentArray)) {
                // 保存当前选中的分类，以便重新渲染后恢复
                const savedSubsection = currentSubsection;
                // 获取当前选中的分类（如果有）
                const newCategory = savedSubsection || 'all';
                const newItem = {
                    category: newCategory,
                    title: '',
                    description: '',
                    detailedDescription: '',
                    image: ''
                };
                currentArray.push(newItem);
                setValueByPath(editingContent, path, currentArray);
                markSectionDirty(sectionKey);
                // 重新渲染整个栏目，但保持当前分类选择
                currentSection = sectionKey;
                currentSubsection = savedSubsection; // 恢复分类选择
                renderContentEditor(); // 直接重新渲染编辑器，不重置分类
            }
        });
        arrayContainer.appendChild(addBtn);
    }
    
    // 如果是精选案例数组、案例网格数组、服务优势数组、段落数组、时间线数组或营业时间数组，添加"添加"按钮
    if (isCases || isCasesGrid || isAdvantages || isParagraphs || isTimeline || isHours) {
        // 添加分隔线
        const divider = document.createElement('div');
        if (isCasesGrid) {
            divider.style.cssText = 'height: 2px; background: linear-gradient(to right, transparent, #cbd5e1, transparent); margin: 32px 0 16px 0; border-radius: 1px;';
        } else {
            divider.style.cssText = 'height: 1px; background: linear-gradient(to right, transparent, var(--border), transparent); margin: 24px 0 16px 0;';
        }
        arrayContainer.appendChild(divider);
        
        const addBtn = document.createElement('button');
        addBtn.type = 'button';
        addBtn.className = 'btn-chip';
        addBtn.style.cssText = 'display: flex; align-items: center; justify-content: center; gap: 6px; width: 100%; padding: 10px 16px; background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%); color: #2563eb; font-size: 13px; font-weight: 500; margin-top: 0; margin-bottom: 24px; border: 1px solid #93c5fd; border-radius: 10px; cursor: pointer; transition: all 0.2s ease; box-shadow: 0 1px 3px rgba(37, 99, 235, 0.2);';
        // 根据数组类型显示不同的按钮文本
        if (isAdvantages) {
            addBtn.innerHTML = '<span style="font-size: 16px;">+</span> <span>添加优势</span>';
        } else if (isParagraphs) {
            addBtn.innerHTML = '<span style="font-size: 16px;">+</span> <span>添加段落</span>';
        } else if (isTimeline) {
            addBtn.innerHTML = '<span style="font-size: 16px;">+</span> <span>添加时间线</span>';
        } else if (isHours) {
            addBtn.innerHTML = '<span style="font-size: 16px;">+</span> <span>添加营业时间</span>';
        } else {
            addBtn.innerHTML = '<span style="font-size: 16px;">+</span> <span>添加案例</span>';
        }
        addBtn.addEventListener('mouseenter', () => {
            addBtn.style.background = 'linear-gradient(135deg, #bfdbfe 0%, #93c5fd 100%)';
            addBtn.style.transform = 'translateY(-1px)';
            addBtn.style.boxShadow = '0 2px 6px rgba(37, 99, 235, 0.3)';
        });
        addBtn.addEventListener('mouseleave', () => {
            addBtn.style.background = 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)';
            addBtn.style.transform = 'translateY(0)';
            addBtn.style.boxShadow = '0 1px 3px rgba(37, 99, 235, 0.2)';
        });
        addBtn.addEventListener('click', () => {
            // 向数组中添加新项
            const currentArray = getValueByPath(editingContent, path);
            if (Array.isArray(currentArray)) {
                // casesGrid 需要包含 images 数组
                if (isCasesGrid) {
                    currentArray.push({ title: '', description: '', image: '', images: [] });
                } else if (isAdvantages) {
                    // advantages 需要包含 icon 字段（虽然不显示，但需要保留）
                    currentArray.push({ icon: '', title: '', description: '' });
                } else if (isParagraphs) {
                    // paragraphs 是字符串数组
                    currentArray.push('');
                } else if (isTimeline) {
                    // timeline 需要包含 year、title、description 字段
                    currentArray.push({ year: '', title: '', description: '' });
                } else if (isHours) {
                    // hours 是字符串数组
                    currentArray.push('');
                } else {
                    currentArray.push({ title: '', description: '', image: '' });
                }
                setValueByPath(editingContent, path, currentArray);
                markSectionDirty(sectionKey);
                // 重新渲染整个栏目
                navigateToSection(sectionKey, false);
            }
        });
        arrayContainer.appendChild(addBtn);
    }
    
    // 移除全局的"添加系列"按钮（不再需要）
    
    parent.appendChild(arrayContainer);
    
    // 如果是images数组，添加添加按钮（包括所有images数组，不仅仅是cases）
    if (isImagesArray) {
        const addImageBtn = document.createElement('button');
        addImageBtn.type = 'button';
        addImageBtn.className = 'btn-chip';
        addImageBtn.style.cssText = 'display: flex; align-items: center; justify-content: center; gap: 6px; padding: 10px 16px; margin-top: 16px; margin-bottom: 20px; background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%); color: #2563eb; font-size: 13px; font-weight: 500; border: 1px solid #93c5fd; border-radius: 10px; cursor: pointer; transition: all 0.2s ease; box-shadow: 0 1px 3px rgba(37, 99, 235, 0.2);';
        addImageBtn.innerHTML = '<span style="font-size: 16px;">+</span> <span>添加图片</span>';
        addImageBtn.addEventListener('mouseenter', () => {
            addImageBtn.style.background = 'linear-gradient(135deg, #bfdbfe 0%, #93c5fd 100%)';
            addImageBtn.style.transform = 'translateY(-1px)';
            addImageBtn.style.boxShadow = '0 2px 6px rgba(37, 99, 235, 0.3)';
        });
        addImageBtn.addEventListener('mouseleave', () => {
            addImageBtn.style.background = 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)';
            addImageBtn.style.transform = 'translateY(0)';
            addImageBtn.style.boxShadow = '0 1px 3px rgba(37, 99, 235, 0.2)';
        });
        addImageBtn.addEventListener('click', () => {
            // 找到父级对象（small/large/casesGrid数组中的某个项，或其他对象中的images数组）
            const parentPath = path.slice(0, -1); // 去掉 'images'
            const parentArrayPath = parentPath.slice(0, -1); // 去掉索引，得到数组路径
            const parentArray = getValueByPath(editingContent, parentArrayPath);
            const parentIndex = parseInt(parentPath[parentPath.length - 1]);
            if (Array.isArray(parentArray) && parentArray[parentIndex]) {
                const parentItem = parentArray[parentIndex];
                if (!parentItem.images) {
                    parentItem.images = [];
                }
                parentItem.images.push('');
                setValueByPath(editingContent, parentArrayPath, parentArray);
                markSectionDirty(sectionKey);
                // 重新渲染整个栏目
                navigateToSection(sectionKey, false);
            }
        });
        parent.appendChild(addImageBtn);
    }
}


// 创建基本字段输入框
function createPrimitiveField(label, value, path, sectionKey) {
    const row = document.createElement('div');
    row.className = 'field-row';
    const labelEl = document.createElement('label');
    labelEl.textContent = label;
    row.appendChild(labelEl);

    // 如果是布尔值类型，创建开关控件
    if (typeof value === 'boolean') {
        const switchContainer = document.createElement('div');
        switchContainer.style.cssText = 'display: flex; align-items: center; gap: 12px;';
        
        const switchLabel = document.createElement('label');
        switchLabel.style.cssText = `
            position: relative;
            display: inline-block;
            width: 48px;
            height: 24px;
            cursor: pointer;
        `;
        switchLabel.innerHTML = `
            <input type="checkbox" ${value ? 'checked' : ''} style="opacity: 0; width: 0; height: 0;">
            <span class="slider" style="
                position: absolute;
                cursor: pointer;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background-color: ${value ? '#4f46e5' : '#ccc'};
                transition: 0.3s;
                border-radius: 24px;
            ">
                <span style="
                    position: absolute;
                    content: '';
                    height: 18px;
                    width: 18px;
                    left: ${value ? '26px' : '3px'};
                    bottom: 3px;
                    background-color: white;
                    transition: 0.3s;
                    border-radius: 50%;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
                "></span>
            </span>
        `;
        
        const checkbox = switchLabel.querySelector('input[type="checkbox"]');
        const slider = switchLabel.querySelector('.slider');
        const sliderCircle = switchLabel.querySelector('.slider span');
        
        checkbox.checked = value;
        
        checkbox.addEventListener('change', () => {
            const newValue = checkbox.checked;
            setValueByPath(editingContent, path, newValue);
            markSectionDirty(sectionKey);
            
            slider.style.backgroundColor = newValue ? '#4f46e5' : '#ccc';
            sliderCircle.style.left = newValue ? '26px' : '3px';
        });
        
        switchContainer.appendChild(switchLabel);
        row.appendChild(switchContainer);
        return row;
    }

    // 检查是否是产品描述字段
    const isProductDescription = path.length >= 2 && 
        path.includes('productGallery') && 
        path[path.length - 1] === 'description';
    
    // 检查是否是服务描述字段
    const isServiceDescription = (path.length >= 2 && path[path.length - 2] === 'service' && path[path.length - 1] === 'description' && (path.includes('contact') || currentContentPage === 'contact')) ||
                                (currentContentPage === 'contact' && currentSection === 'service' && path.length >= 1 && path[path.length - 1] === 'description');
    
    // 如果是产品描述、服务描述或文本长度超过80，使用 textarea
    const isLongText = isProductDescription || isServiceDescription || (typeof value === 'string' && value.length > 80);
    const input = document.createElement(isLongText ? 'textarea' : 'input');
    if (!isLongText) {
        input.type = 'text';
    } else {
        if (isProductDescription || isServiceDescription) {
            input.rows = 6;
            input.style.minHeight = '120px';
        } else {
            input.rows = 4;
            input.style.minHeight = '80px';
        }
        input.style.resize = 'vertical';
    }
    input.value = value ?? '';
    input.placeholder = `请输入${label}`;
    input.className = 'form-input';
    
    input.addEventListener('blur', () => {
        const newValue = input.value;
        setValueByPath(editingContent, path, newValue);
        markSectionDirty(sectionKey);
    });
    
    input.addEventListener('input', () => {
        setValueByPath(editingContent, path, input.value);
        if (isImageField(path)) {
            updateImagePreview(input.value, row);
        }
    });
    
    row.appendChild(input);

    if (isImageField(path)) {
        // 特殊处理：如果是品牌Logo字段，添加说明文字
        const isLogoField = path.length >= 2 && path[path.length - 1] === 'logo' && path[path.length - 2] === 'brand';
        
        if (isLogoField) {
            const logoNotice = document.createElement('div');
            logoNotice.className = 'logo-field-notice';
            logoNotice.innerHTML = `
                <div class="notice-icon">ℹ️</div>
                <div class="notice-content">
                    <strong>重要提示：</strong>
                    <p>上传Logo图片后，网站导航栏将显示Logo图片，<strong>品牌名称和品牌标语将被隐藏。</strong></p>
                    <p>如果不上传Logo或清空Logo，网站将显示品牌名称和品牌标语文字。</p>
                    <p>建议Logo图片尺寸：宽度200-300px，高度60-80px，支持PNG、JPG格式，背景透明为佳。</p>
                </div>
            `;
            row.appendChild(logoNotice);
        }
        
        // 图片预览区域
        const previewContainer = document.createElement('div');
        previewContainer.className = 'image-preview-container';
        const previewImg = document.createElement('img');
        previewImg.className = 'image-preview';
        previewImg.alt = '图片预览';
        
        const imageUrl = value && typeof value === 'string' ? value.trim() : '';
        if (imageUrl) {
            const normalizedUrl = normalizeImageUrl(imageUrl);
            previewImg.src = normalizedUrl;
            previewImg.style.display = 'block';
            previewImg.onerror = () => {
                previewImg.style.display = 'none';
            };
        } else {
            previewImg.style.display = 'none';
        }
        
        previewImg.addEventListener('click', () => {
            if (input.value && input.value.trim()) {
                showImageModal(input.value);
            }
        });
        previewContainer.appendChild(previewImg);
        row.appendChild(previewContainer);
        
        // 上传控件
        const uploadControls = document.createElement('div');
        uploadControls.className = 'array-controls';
        const uploadBtn = document.createElement('button');
        uploadBtn.type = 'button';
        uploadBtn.className = 'btn-chip';
        uploadBtn.style.cssText = 'display: flex; align-items: center; gap: 6px; padding: 8px 16px; background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%); color: #fff; border: none; border-radius: 8px; cursor: pointer; font-size: 13px; font-weight: 500; transition: all 0.2s; box-shadow: 0 2px 4px rgba(14, 165, 233, 0.2);';
        uploadBtn.innerHTML = '<span>📤</span><span>上传图片</span>';
        uploadBtn.addEventListener('mouseenter', () => {
            uploadBtn.style.background = 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)';
            uploadBtn.style.transform = 'translateY(-1px)';
            uploadBtn.style.boxShadow = '0 4px 8px rgba(14, 165, 233, 0.3)';
        });
        uploadBtn.addEventListener('mouseleave', () => {
            uploadBtn.style.background = 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)';
            uploadBtn.style.transform = 'translateY(0)';
            uploadBtn.style.boxShadow = '0 2px 4px rgba(14, 165, 233, 0.2)';
        });
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'image/*';
        fileInput.style.display = 'none';
        fileInput.addEventListener('change', () => {
            if (fileInput.files && fileInput.files[0]) {
                uploadImage(fileInput.files[0], path, input, sectionKey);
            }
        });
        uploadBtn.addEventListener('click', () => fileInput.click());
        uploadControls.appendChild(uploadBtn);
        uploadControls.appendChild(fileInput);
        row.appendChild(uploadControls);
    }

    return row;
}

// 找出已更改的页面和栏目
function findChangedPagesAndSections(draftData, publishedData) {
    const changes = {
        global: [],
        pages: {}
    };
    
    // 检查 global
    const draftGlobal = draftData.global || {};
    const publishedGlobal = publishedData.global || {};
    for (const sectionKey of Object.keys(draftGlobal)) {
        if (!deepEqual(draftGlobal[sectionKey], publishedGlobal[sectionKey] || {})) {
            changes.global.push(sectionKey);
        }
    }
    // 检查 published 中是否有 draft 中没有的栏目
    for (const sectionKey of Object.keys(publishedGlobal)) {
        if (!draftGlobal.hasOwnProperty(sectionKey) && !changes.global.includes(sectionKey)) {
            changes.global.push(sectionKey);
        }
    }
    
    // 检查所有 pages
    const draftPages = draftData.pages || {};
    const publishedPages = publishedData.pages || {};
    const allPageKeys = new Set([...Object.keys(draftPages), ...Object.keys(publishedPages)]);
    
    for (const pageKey of allPageKeys) {
        const draftPage = draftPages[pageKey] || {};
        const publishedPage = publishedPages[pageKey] || {};
        const pageChanges = [];
        
        for (const sectionKey of Object.keys(draftPage)) {
            if (!deepEqual(draftPage[sectionKey], publishedPage[sectionKey] || {})) {
                pageChanges.push(sectionKey);
            }
        }
        // 检查 published 中是否有 draft 中没有的栏目
        for (const sectionKey of Object.keys(publishedPage)) {
            if (!draftPage.hasOwnProperty(sectionKey) && !pageChanges.includes(sectionKey)) {
                pageChanges.push(sectionKey);
            }
        }
        
        if (pageChanges.length > 0) {
            changes.pages[pageKey] = pageChanges;
        }
    }
    
    return changes;
}

// 显示未发布更改的提示
function showUnpublishedChangesHint(changes) {
    // 移除之前的提示
    const existingHint = document.getElementById('unpublishedChangesHint');
    if (existingHint) {
        existingHint.remove();
    }
    
    // 如果没有更改，不显示提示
    if (changes.global.length === 0 && Object.keys(changes.pages).length === 0) {
        return;
    }
    
    // 创建提示元素
    const hint = document.createElement('div');
    hint.id = 'unpublishedChangesHint';
    hint.style.cssText = `
        position: fixed;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        max-width: 90%;
        width: 100%;
        max-width: 600px;
        background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
        border: 2px solid #f59e0b;
        border-radius: 12px;
        padding: 16px 20px;
        box-shadow: 0 10px 40px rgba(245, 158, 11, 0.3);
        z-index: 9999;
        animation: slideUpIn 0.3s ease-out;
    `;
    
    let hintContent = '<div style="display: flex; align-items: flex-start; gap: 12px;">';
    hintContent += '<div style="font-size: 24px; flex-shrink: 0;">⚠️</div>';
    hintContent += '<div style="flex: 1;">';
    hintContent += '<div style="font-weight: 600; font-size: 16px; color: #92400e; margin-bottom: 12px;">有未发布的修改</div>';
    hintContent += '<div style="font-size: 13px; color: #78350f; line-height: 1.6;">';
    
    const changeList = [];
    
    // 添加 global 的更改
    if (changes.global.length > 0) {
        const sectionLabels = changes.global.map(sectionKey => {
            return SECTION_LABELS.global?.[sectionKey] || formatLabel(sectionKey, [], currentContentPage, currentSection, FIELD_LABELS);
        }).join('、');
        changeList.push(`<strong>全站公用</strong>：${sectionLabels}`);
    }
    
    // 添加 pages 的更改
    for (const [pageKey, sectionKeys] of Object.entries(changes.pages)) {
        const pageLabel = PAGE_LABELS[pageKey] || pageKey;
        const sectionLabels = sectionKeys.map(sectionKey => {
            return SECTION_LABELS[pageKey]?.[sectionKey] || formatLabel(sectionKey, [], pageKey, null, FIELD_LABELS);
        }).join('、');
        changeList.push(`<strong>${pageLabel}</strong>：${sectionLabels}`);
    }
    
    hintContent += changeList.join('<br>');
    hintContent += '</div>';
    hintContent += '<button onclick="this.closest(\'#unpublishedChangesHint\').remove()" style="background: none; border: none; font-size: 20px; color: #78350f; cursor: pointer; padding: 0; width: 24px; height: 24px; flex-shrink: 0; line-height: 1;">×</button>';
    hintContent += '</div></div>';
    
    hint.innerHTML = hintContent;
    
    // 添加到页面
    document.body.appendChild(hint);
    
    // 移动端适配
    const updateMobileStyle = () => {
        if (window.innerWidth <= 768) {
            hint.style.bottom = '80px';
            hint.style.maxWidth = 'calc(100% - 40px)';
            hint.style.padding = '14px 16px';
            hint.style.fontSize = '12px';
        } else {
            hint.style.bottom = '20px';
            hint.style.maxWidth = '600px';
            hint.style.padding = '16px 20px';
            hint.style.fontSize = '13px';
        }
    };
    
    // 初始设置
    updateMobileStyle();
    
    // 监听窗口大小变化
    window.addEventListener('resize', updateMobileStyle);
    
    // 在提示框移除时清理事件监听器
    const originalRemove = hint.remove.bind(hint);
    hint.remove = function() {
        window.removeEventListener('resize', updateMobileStyle);
        originalRemove();
    };
}

// 检查发布状态
async function checkPublishStatus() {
    const publishBtn = document.getElementById('cmsPublishBtn');
    if (!publishBtn) return;
    
    try {
        const token = getToken();
        // 获取完整的草稿内容和已发布内容（包括global和所有pages）进行比较
        const [draftRes, publishedRes] = await Promise.all([
            fetchWithTimeout(`${API_BASE_URL}/content?preview=true`, {
                headers: { 'Authorization': `Bearer ${token}` }
            }),
            fetchWithTimeout(`${API_BASE_URL}/content?published=true`, {
                headers: { 'Authorization': `Bearer ${token}` }
            })
        ]);
        
        const draftResponse = await draftRes.json();
        const publishedResponse = await publishedRes.json();
        
        // 获取完整的数据结构（包括global和所有pages）
        const draftFullData = draftResponse.success && draftResponse.data ? draftResponse.data : { global: {}, pages: {} };
        const publishedFullData = publishedResponse.success && publishedResponse.data ? publishedResponse.data : { global: {}, pages: {} };
        
        // 深度比较整个数据结构（global + 所有pages），检查是否有任何未发布的修改
        const hasUnpublishedChanges = !deepEqual(draftFullData, publishedFullData);
        
        // 找出具体哪些页面/栏目有更改
        const changes = findChangedPagesAndSections(draftFullData, publishedFullData);
        
        // 使用 !important 确保样式生效，并同时设置 background 和 backgroundColor
        // 移除可能冲突的类，然后设置样式
        if (hasUnpublishedChanges) {
            publishBtn.classList.remove('cms-action-btn-primary');
            publishBtn.classList.add('cms-action-btn-warning');
            publishBtn.style.setProperty('background', '#f59e0b', 'important');
            publishBtn.style.setProperty('background-color', '#f59e0b', 'important');
            publishBtn.style.setProperty('color', 'white', 'important');
            publishBtn.title = '有未发布的修改，点击发布后网站才会显示';
            
            // 显示详细提示
            showUnpublishedChangesHint(changes);
        } else {
            publishBtn.classList.remove('cms-action-btn-warning');
            publishBtn.classList.add('cms-action-btn-primary');
            publishBtn.style.setProperty('background', '#16a34a', 'important');
            publishBtn.style.setProperty('background-color', '#16a34a', 'important');
            publishBtn.style.setProperty('color', 'white', 'important');
            publishBtn.title = '已发布，网站显示最新内容';
            
            // 移除提示
            const existingHint = document.getElementById('unpublishedChangesHint');
            if (existingHint) {
                existingHint.remove();
            }
        }
    } catch (error) {
        // 静默处理错误
    }
}

// 检测是否为移动端设备
function isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
           (window.innerWidth <= 768);
}

// 记录操作日志
async function recordLog(action, page, section, beforeData, afterData) {
    try {
        const token = getToken();
        await fetchWithTimeout(`${API_BASE_URL}/logs`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                action,
                page,
                section,
                beforeData,
                afterData,
                timestamp: new Date().toISOString()
            })
        });
    } catch (error) {
        // 日志记录失败不影响主操作
    }
}

// 保存单个栏目
async function saveSection(sectionKey) {
    // 检查是否有任何修改（包括子分类的修改）
    const hasModifications = sectionDirtyFlags[sectionKey] || 
        Object.keys(sectionDirtyFlags).some(key => key.startsWith(`${sectionKey}-`));
    
    if (!hasModifications) {
        showInfo('没有需要保存的修改');
        return;
    }

    try {
        const token = getToken();
        // 获取修改前的数据（从缓存中）
        const beforeData = getValueByPath(siteContentCache, currentContentPage === 'global' ? ['global', sectionKey] : ['pages', currentContentPage, sectionKey]);
        
        // 获取修改后的数据（从编辑内容中）
        const afterData = editingContent[sectionKey];
        
        // 深度比较修改前后的内容
        if (deepEqual(beforeData, afterData)) {
            // 内容相同，不需要保存
            // 清除修改标记
            sectionDirtyFlags[sectionKey] = false;
            Object.keys(sectionDirtyFlags).forEach(key => {
                if (key.startsWith(`${sectionKey}-`)) {
                    sectionDirtyFlags[key] = false;
                }
            });
            showInfo('内容未发生变化，无需保存');
            return;
        }
        
        // 保存整个栏目（包括所有子分类）
        const sectionData = editingContent[sectionKey];
        
        const response = await fetchWithTimeout(`${API_BASE_URL}/content/page/${currentContentPage}/section/${sectionKey}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(sectionData)
        });
        
        // 检查响应状态
        if (!response.ok) {
            // 尝试解析错误响应
            let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
            try {
                const contentType = response.headers.get('content-type');
                if (contentType && contentType.includes('application/json')) {
                    const errorData = await response.json();
                    errorMessage = errorData.message || errorMessage;
                } else {
                    // 如果不是 JSON，读取文本内容
                    const text = await response.text();
                    if (text && text.length < 200) {
                        errorMessage = text;
                    }
                }
            } catch (e) {
                // 如果解析失败，使用默认错误消息
            }
            throw new Error(errorMessage || '保存失败');
        }
        
        // 检查响应内容类型
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            const text = await response.text();
            throw new Error(`服务器返回了非JSON响应: ${text.substring(0, 100)}`);
        }
        
        const result = await response.json();
        if (!result.success) throw new Error(result.message || '保存失败');
        
        // 更新缓存，确保下次保存时能获取到正确的修改前数据
        if (siteContentCache) {
            if (currentContentPage === 'global') {
                if (!siteContentCache.global) {
                    siteContentCache.global = {};
                }
                siteContentCache.global[sectionKey] = deepClone(sectionData);
            } else {
                if (!siteContentCache.pages) {
                    siteContentCache.pages = {};
                }
                if (!siteContentCache.pages[currentContentPage]) {
                    siteContentCache.pages[currentContentPage] = {};
                }
                siteContentCache.pages[currentContentPage][sectionKey] = deepClone(sectionData);
            }
        }
        
        // 清除所有相关的修改标记（包括子分类）
        sectionDirtyFlags[sectionKey] = false;
        Object.keys(sectionDirtyFlags).forEach(key => {
            if (key.startsWith(`${sectionKey}-`)) {
                sectionDirtyFlags[key] = false;
            }
        });
        
        showSuccess('保存成功');
        
        // 保存单个section后也检查发布状态
        if (typeof checkPublishStatus === 'function') {
            setTimeout(() => {
                checkPublishStatus();
            }, 100);
        }
    } catch (error) {
        showError(error.message || '保存失败');
    }
}

// 保存所有内容
async function saveAllContent() {
    const saveBtn = document.getElementById('cmsSaveBtn');
    const originalText = saveBtn.textContent;
    // 使用 currentContentPage 确保使用正确的页面标识（productSeries 在 home 页面，不在 global）
    const currentPage = currentContentPage || 'global';
    
    try {
        const token = getToken();
        saveBtn.disabled = true;
        saveBtn.textContent = '保存中...';
        
        // 获取所有未保存的栏目
        const dirtySections = Object.keys(sectionDirtyFlags || {}).filter(
            key => sectionDirtyFlags[key]
        );
        
        if (dirtySections.length === 0) {
            showInfo('没有需要保存的修改');
            return;
        }
        
        // 保存所有修改的栏目，并记录实际保存的栏目
        const savedSections = [];
        for (const sectionKey of dirtySections) {
            if (typeof saveSection === 'function') {
                // 先获取修改后的数据（从编辑内容中获取，例如productSeries字段的当前编辑值）
                const afterData = editingContent[sectionKey];
                
                // 获取修改前的数据：优先使用缓存数据（因为后端可能没有单独的section获取接口）
                // 缓存数据在页面加载时已经是最新的，保存前获取的数据应该和缓存一致
                let beforeData = getValueByPath(siteContentCache, currentPage === 'global' ? ['global', sectionKey] : ['pages', currentPage, sectionKey]);
                
                // 确保数组字段返回的是数组而不是对象
                // 如果 afterData 是数组，但 beforeData 是空对象或未定义，则将其转换为空数组
                if (beforeData === undefined || beforeData === null) {
                    beforeData = Array.isArray(afterData) ? [] : null;
                } else if (Array.isArray(afterData) && !Array.isArray(beforeData) && typeof beforeData === 'object' && Object.keys(beforeData).length === 0) {
                    beforeData = [];
                }
                
                // 深度比较整个section的数据片段（如productSeries数组），如果内容相同则跳过保存
                if (deepEqual(beforeData, afterData)) {
                    // 内容相同，清除修改标记但不保存
                    sectionDirtyFlags[sectionKey] = false;
                    Object.keys(sectionDirtyFlags).forEach(key => {
                        if (key.startsWith(`${sectionKey}-`)) {
                            sectionDirtyFlags[key] = false;
                        }
                    });
                    continue;
                }
                
                // 内容有变化，执行保存
                await saveSection(sectionKey);
                savedSections.push(sectionKey);
                
                // 记录日志（使用从服务器获取的最新数据作为修改前数据）
                await recordLog('save', currentPage, sectionKey, beforeData, afterData);
            }
        }
        
        // 保存跨页面的修改（例如在 products 页面删除筛选标签时，同时修改了首页的 productSeries）
        for (const [page, sections] of Object.entries(crossPageChanges)) {
            for (const [sectionKey, changeData] of Object.entries(sections)) {
                try {
                    // 从记录的修改中获取修改前和修改后的数据
                    let beforeData, afterData;
                    if (changeData && typeof changeData === 'object' && 'beforeData' in changeData && 'afterData' in changeData) {
                        // 新格式：包含 beforeData 和 afterData
                        beforeData = changeData.beforeData;
                        afterData = changeData.afterData;
                    } else {
                        // 旧格式兼容：直接是 afterData
                        afterData = changeData;
                        // 尝试从缓存获取 beforeData（可能不准确，因为缓存可能已被修改）
                        beforeData = getValueByPath(siteContentCache, page === 'global' ? ['global', sectionKey] : ['pages', page, sectionKey]);
                    }
                    
                    // 深度比较，如果内容相同则跳过保存
                    if (deepEqual(beforeData, afterData)) {
                        continue;
                    }
                    
                    // 保存跨页面的修改
                    const response = await fetchWithTimeout(`${API_BASE_URL}/content/page/${page}/section/${sectionKey}`, {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify(afterData)
                    });
                    
                    if (!response.ok) {
                        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
                        try {
                            const contentType = response.headers.get('content-type');
                            if (contentType && contentType.includes('application/json')) {
                                const errorData = await response.json();
                                errorMessage = errorData.message || errorMessage;
                            } else {
                                const text = await response.text();
                                if (text && text.length < 200) {
                                    errorMessage = text;
                                }
                            }
                        } catch (e) {
                            // 解析错误响应失败，静默处理
                        }
                        throw new Error(errorMessage || '保存失败');
                    }
                    
                    // 检查响应内容类型
                    const contentType = response.headers.get('content-type');
                    if (!contentType || !contentType.includes('application/json')) {
                        const text = await response.text();
                        throw new Error(`服务器返回了非JSON响应: ${text.substring(0, 100)}`);
                    }
                    
                    const result = await response.json();
                    if (!result.success) {
                        throw new Error(result.message || '保存失败');
                    }
                    
                    // 更新缓存
                    if (page === 'global') {
                        if (!siteContentCache.global) siteContentCache.global = {};
                        siteContentCache.global[sectionKey] = afterData;
                    } else {
                        if (!siteContentCache.pages) siteContentCache.pages = {};
                        if (!siteContentCache.pages[page]) siteContentCache.pages[page] = {};
                        siteContentCache.pages[page][sectionKey] = afterData;
                    }
                    
                    savedSections.push(`${page}.${sectionKey}`);
                    
                    // 记录日志
                    await recordLog('save', page, sectionKey, beforeData, afterData);
                } catch (error) {
                    showError(`保存跨页面修改失败 (${page}.${sectionKey}): ${error.message}`);
                }
            }
        }
        
        // 清空跨页面修改记录
        crossPageChanges = {};
        
        // 根据实际保存的栏目数量显示不同的提示
        if (savedSections.length === 0) {
            showInfo('内容未发生变化，无需保存');
        } else {
            showSuccess(`已保存 ${savedSections.length} 个栏目的内容（未发布，网站不会显示。点击"发布"按钮后网站才会显示最新内容）`);
            
            // 如果保存了筛选标签，更新侧边栏分类导航
            if (savedSections.includes('filters') && currentContentPage === 'products') {
                // 重新加载内容以更新缓存
                setTimeout(async () => {
                    await loadSiteContent(false);
                    // 重新渲染侧边栏以显示最新的分类导航
                    renderContentSidebar();
                }, 200);
            }
        }
        
        // 保存后立即检查发布状态（确保缓存已更新）
        if (typeof checkPublishStatus === 'function') {
            // 使用 setTimeout 确保所有异步操作（包括缓存更新）都已完成
            setTimeout(() => {
                checkPublishStatus();
            }, 100);
        }
        
        // 如果预览窗口打开，刷新预览以显示最新草稿内容
        // 延迟刷新，确保后端文件写入完成
        if (window.previewManager && window.previewManager.isVisible) {
            setTimeout(() => {
                window.previewManager.refresh();
            }, 1000);
        }
    } catch (error) {
        showError('保存失败: ' + error.message);
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = originalText;
    }
}

// 发布页面
async function publishPage() {
    const publishBtn = document.getElementById('cmsPublishBtn');
    
    try {
        const token = getToken();
        publishBtn.disabled = true;
        publishBtn.textContent = '检查中...';
        
        // 获取完整的草稿内容和已发布内容（包括global和所有pages）
        let draftFullData = { global: {}, pages: {} };
        let publishedFullData = { global: {}, pages: {} };
        
        try {
            const draftRes = await fetchWithTimeout(`${API_BASE_URL}/content?preview=true`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const draftResponse = await draftRes.json();
            if (draftResponse.success && draftResponse.data) {
                draftFullData = draftResponse.data;
            }
        } catch (error) {
            showError('获取草稿内容失败: ' + error.message);
            return;
        }
        
        try {
            const publishedRes = await fetchWithTimeout(`${API_BASE_URL}/content?published=true`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const publishedResponse = await publishedRes.json();
            if (publishedResponse.success && publishedResponse.data) {
                publishedFullData = publishedResponse.data;
            }
        } catch (error) {
            // 如果获取失败，使用空对象（可能是首次发布）
            publishedFullData = { global: {}, pages: {} };
        }
        
        // 深度比较整个站点（global + 所有pages）的草稿内容和已发布内容
        if (deepEqual(draftFullData, publishedFullData)) {
            showInfo('全站内容与已发布内容一致，无需发布');
            return;
        }
        
        // 内容不同，显示确认对话框
        const confirmed = await showConfirm(
            `确认发布全站内容吗？<br><br>发布后，网站将显示您保存的最新内容（包括全局设置和所有页面）。未保存的修改将不会被发布。`,
            { 
                title: '发布全站', 
                type: 'info', 
                confirmText: '确认发布', 
                cancelText: '取消' 
            }
        );
        
        if (!confirmed) return;
        
        publishBtn.textContent = '发布中...';
        
        // 执行发布：先发布 global，然后发布所有 pages
        const pagesToPublish = ['global', ...Object.keys(draftFullData.pages || {})];
        const publishedPages = [];
        const failedPages = [];
        
        for (const page of pagesToPublish) {
            try {
                const publishRes = await fetchWithTimeout(`${API_BASE_URL}/publish/page/${page}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ publish: true })
                });
                
                // 检查响应状态
                if (!publishRes.ok) {
                    const errorData = await publishRes.json().catch(() => ({ message: '发布请求失败' }));
                    throw new Error(errorData.message || `HTTP ${publishRes.status}: ${publishRes.statusText}`);
                }
                
                const response = await publishRes.json();
                if (response.success) {
                    publishedPages.push(page);
                } else {
                    throw new Error(response.message || '发布失败');
                }
            } catch (error) {
                failedPages.push({ page, error: error.message });
            }
        }
        
        // 记录操作日志（发布整个站点）
        try {
            await recordLog('publish', 'all', null, publishedFullData, draftFullData);
        } catch (error) {
            // 日志记录失败不影响发布操作
        }
        
        // 显示发布结果
        if (failedPages.length === 0) {
            showSuccess(`全站内容已成功发布！共发布 ${publishedPages.length} 个部分（${publishedPages.join('、')}）。网站现在显示最新内容。`);
        } else {
            showError(`部分发布失败：${failedPages.map(f => f.page).join('、')}。已成功发布：${publishedPages.join('、')}。`);
        }
        
        // 更新缓存：重新加载已发布内容到缓存
        try {
            const refreshRes = await fetchWithTimeout(`${API_BASE_URL}/content?published=true`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (refreshRes.ok) {
                const refreshResponse = await refreshRes.json();
                if (refreshResponse.success && refreshResponse.data) {
                    // 更新整个缓存
                    siteContentCache = refreshResponse.data;
                }
            }
        } catch (error) {
            // 更新缓存失败，静默处理
        }
        
        // 更新发布状态
        if (typeof checkPublishStatus === 'function') {
            checkPublishStatus();
        }
        
        // 如果预览窗口打开，刷新预览以显示已发布内容
        if (window.previewManager && window.previewManager.isVisible) {
            setTimeout(() => {
                window.previewManager.refresh();
            }, 500);
        }
    } catch (error) {
        showError('发布失败: ' + error.message);
    } finally {
        publishBtn.disabled = false;
        publishBtn.textContent = '🚀 发布';
    }
}

// 恢复栏目为默认值
async function resetSection(sectionKey) {
    const sectionLabel = SECTION_LABELS[currentContentPage]?.[sectionKey] || formatLabel(sectionKey, [], currentContentPage, currentSection, FIELD_LABELS);
    
    // 先比较当前内容和默认内容
    const currentData = editingContent[sectionKey];
    const defaultSection = defaultContentCache[sectionKey];
    
    // 如果默认内容不存在，需要先加载
    if (defaultSection === undefined) {
        await loadSiteContent();
        const reloadedDefault = defaultContentCache[sectionKey];
        if (reloadedDefault === undefined) {
            showError('未找到默认内容');
            return;
        }
        // 深度比较
        if (deepEqual(currentData, reloadedDefault)) {
            showInfo('内容已经是默认值，无需恢复');
            return;
        }
    } else {
        // 深度比较当前内容和默认内容
        if (deepEqual(currentData, defaultSection)) {
            showInfo('内容已经是默认值，无需恢复');
            return;
        }
    }
    
    // 内容不同，显示确认对话框
    const confirmed = await showConfirm(
        `确认将"${sectionLabel}"栏目恢复为默认值吗？此操作不可撤销。`,
        { title: '恢复默认', type: 'warning', confirmText: '恢复', cancelText: '取消', confirmColor: 'danger' }
    );
    if (!confirmed) {
        return;
    }

    try {
        const token = getToken();
        // 获取恢复前的数据（用于记录日志）
        const beforeData = getValueByPath(siteContentCache, currentContentPage === 'global' ? ['global', sectionKey] : ['pages', currentContentPage, sectionKey]);
        
        const response = await fetchWithTimeout(`${API_BASE_URL}/content/page/${currentContentPage}/section/${sectionKey}/reset`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const result = await response.json();
        if (!result.success) throw new Error(result.message || '恢复失败');
        
        // 清除修改标记
        sectionDirtyFlags[sectionKey] = false;
        Object.keys(sectionDirtyFlags).forEach(key => {
            if (key.startsWith(`${sectionKey}-`)) {
                sectionDirtyFlags[key] = false;
            }
        });
        
        // 直接从默认内容中恢复，只更新对应部分，不重新渲染整个编辑器
        const finalDefaultSection = defaultContentCache[sectionKey];
        if (finalDefaultSection !== undefined) {
            editingContent[sectionKey] = deepClone(finalDefaultSection);
            // 只更新对应的栏目卡片，不重新渲染整个编辑器
            updateSectionCard(sectionKey, finalDefaultSection);
            
            // 更新缓存
            if (currentContentPage === 'global') {
                if (!siteContentCache.global) siteContentCache.global = {};
                siteContentCache.global[sectionKey] = deepClone(finalDefaultSection);
            } else {
                if (!siteContentCache.pages) siteContentCache.pages = {};
                if (!siteContentCache.pages[currentContentPage]) siteContentCache.pages[currentContentPage] = {};
                siteContentCache.pages[currentContentPage][sectionKey] = deepClone(finalDefaultSection);
            }
        } else {
            // 如果没有默认内容，重新加载
            await loadSiteContent();
        }
        
        // 记录操作日志（只有在真正执行恢复时才记录）
        const afterData = editingContent[sectionKey];
        try {
            await recordLog('reset', currentContentPage, sectionKey, beforeData, afterData);
        } catch (error) {
            // 日志记录失败不影响主操作
        }
        
        showSuccess('已恢复为默认值');
        
        // 恢复后检查发布状态
        if (typeof checkPublishStatus === 'function') {
            setTimeout(() => {
                checkPublishStatus();
            }, 100);
        }
    } catch (error) {
        showError(error.message || '恢复失败');
    }
}

// 绑定CMS工具栏事件
function bindCMSToolbar() {
    const previewBtn = document.getElementById('cmsPreviewBtn');
    const saveBtn = document.getElementById('cmsSaveBtn');
    const publishBtn = document.getElementById('cmsPublishBtn');
    const pageSelector = document.getElementById('cmsPageSelector');
    
    // 预览按钮
    previewBtn?.addEventListener('click', () => {
        // 检测是否为移动端
        if (isMobileDevice()) {
            showInfo('预览功能建议在PC端使用，以获得更好的体验。');
            return;
        }
        
        if (window.previewManager) {
            const currentPage = pageSelector?.value || 'home';
            window.previewManager.toggle();
            if (window.previewManager.isVisible) {
                window.previewManager.show(currentPage);
            }
        }
    });
    
    // 保存按钮
    saveBtn?.addEventListener('click', async () => {
        // 获取所有未保存的栏目
        const dirtySections = Object.keys(sectionDirtyFlags || {}).filter(
            key => sectionDirtyFlags[key]
        );
        
        if (dirtySections.length === 0) {
            showInfo('没有需要保存的修改');
            return;
        }
        
        // 显示确认对话框
        const confirmed = await showConfirm(
            `确认保存草稿吗？<br><br>保存后，内容将保存为草稿，网站不会显示。需要点击"发布"按钮后网站才会显示最新内容。`,
            { 
                title: '保存草稿', 
                type: 'info', 
                confirmText: '确认保存', 
                cancelText: '取消' 
            }
        );
        
        if (!confirmed) return;
        
        await saveAllContent();
    });
    
    // 发布按钮
    publishBtn?.addEventListener('click', async () => {
        await publishPage();
    });
    
    // 页面选择器
    pageSelector?.addEventListener('change', (e) => {
        const page = e.target.value;
        if (typeof setCurrentContentPage === 'function') {
            setCurrentContentPage(page);
        }
        if (window.previewManager && window.previewManager.isVisible) {
            window.previewManager.show(page);
        }
        // 切换页面时检查发布状态
        checkPublishStatus();
    });
}

// 导出函数供外部使用
export {
    initCMSModule,
    loadSiteContent,
    setCurrentContentPage,
    renderContentSidebar,
    navigateToSection,
    navigateToCategory,
    navigateToFeaturedSubsection,
    renderContentEditor,
    renderSectionFieldsFlat,
    renderArrayFields,
    createPrimitiveField,
    uploadImage,
    saveSection,
    saveAllContent,
    publishPage,
    checkPublishStatus,
    resetSection,
    bindCMSToolbar,
    recordLog,
    findChangedPagesAndSections,
    showUnpublishedChangesHint,
    isMobileDevice
};

// 导出到全局，供HTML中的onclick和普通脚本使用
window.cmsModule = {
    loadSiteContent,
    setCurrentContentPage,
    navigateToSection,
    navigateToCategory,
    navigateToFeaturedSubsection,
    saveSection,
    resetSection
};

// 直接导出到window，供普通脚本使用
window.loadSiteContent = loadSiteContent;
window.saveSection = saveSection;
window.resetSection = resetSection;

