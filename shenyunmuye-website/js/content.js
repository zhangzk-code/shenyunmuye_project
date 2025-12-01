(() => {
    const pageKey = document.body.dataset.page;
    if (!pageKey) return;

    const API_BASE_URL = getApiBaseUrl();
    
    // 存储产品卡片原始数据，供筛选使用
    let productsDataCache = null;

    /**
     * 规范化图片URL，确保图片路径正确
     * @param {string} imageUrl - 图片URL
     * @returns {string} 规范化后的图片URL
     */
    function normalizeImageUrl(imageUrl) {
        if (!imageUrl || typeof imageUrl !== 'string') return '';
        
        const url = imageUrl.trim();
        
        // 如果已经是完整的HTTP/HTTPS URL，直接返回
        if (url.startsWith('http://') || url.startsWith('https://')) {
            return url;
        }
        
        // 如果是相对路径，确保以 / 开头
        const normalizedPath = url.startsWith('/') ? url : `/${url}`;
        
        // 使用当前页面的 origin（协议+主机名+端口）
        // 这样无论通过什么端口访问，图片路径都会正确
        return `${window.location.origin}${normalizedPath}`;
    }

    initContent();

    async function initContent() {
        try {
            // 检查URL参数，如果是预览模式，添加preview=true参数
            const urlParams = new URLSearchParams(window.location.search);
            const previewValue = urlParams.get('preview');
            const isPreview = previewValue === 'true' || previewValue === '1';
            
            // 如果是预览模式，拦截所有链接点击，确保跳转时保留 preview=true 参数
            if (isPreview) {
                setupPreviewLinkInterceptor();
            }
            
            const previewParam = isPreview ? '&preview=true' : '';
            const apiUrl = `${API_BASE_URL}/content?page=${pageKey}${previewParam}`;
            const response = await fetch(apiUrl);
            if (!response.ok) throw new Error('无法读取站点内容配置');
            const result = await response.json();
            if (!result.success) throw new Error(result.message || '内容加载失败');

            const globalContent = result.data.global || {};
            const pageContent = result.data.page || {};

            applyGlobalContent(globalContent);
            renderPageContent(pageKey, pageContent);
        } catch (error) {
        }
    }
    
    /**
     * 设置预览模式下的链接拦截器
     * 确保所有链接跳转时都保留 preview=true 参数
     */
    function setupPreviewLinkInterceptor() {
        // 拦截所有链接点击事件
        document.addEventListener('click', function(e) {
            const link = e.target.closest('a');
            if (!link) return;
            
            // 跳过特殊链接（如锚点、JavaScript链接、外部链接等）
            const href = link.getAttribute('href');
            if (!href || 
                href.startsWith('#') || 
                href.startsWith('javascript:') || 
                href.startsWith('mailto:') || 
                href.startsWith('tel:') ||
                link.target === '_blank' ||
                link.hasAttribute('data-no-preview')) {
                return;
            }
            
            // 检查是否是同域链接（相对路径或同域名）
            const isSameOrigin = href.startsWith('/') || 
                               href.startsWith('./') || 
                               !href.includes('://') ||
                               href.startsWith(window.location.origin);
            
            if (!isSameOrigin) {
                return; // 外部链接不处理
            }
            
            // 解析链接URL
            let targetUrl;
            try {
                if (href.startsWith('/') || href.startsWith('./')) {
                    targetUrl = new URL(href, window.location.origin);
                } else {
                    targetUrl = new URL(href);
                }
            } catch (error) {
                return; // URL解析失败，不处理
            }
            
            // 如果URL中还没有 preview=true 参数，添加它
            if (!targetUrl.searchParams.has('preview')) {
                targetUrl.searchParams.set('preview', 'true');
                
                // 阻止默认行为，使用修改后的URL进行跳转
                e.preventDefault();
                e.stopPropagation();
                
                // 使用修改后的URL进行跳转
                window.location.href = targetUrl.toString();
            }
        }, true); // 使用捕获阶段，确保能拦截所有链接点击
        
        // 同时处理动态添加的链接（使用 MutationObserver）
        const observer = new MutationObserver(function(mutations) {
            // 当DOM发生变化时，不需要特别处理，因为事件委托已经覆盖了所有链接
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }
    

    function getApiBaseUrl() {
        const hostname = window.location.hostname;
        const protocol = window.location.protocol;
        
        // 检查是否在开发环境（localhost）
        if (hostname === 'localhost' || hostname === '127.0.0.1') {
            return 'http://localhost:3000/api';
        }
        
        // 生产环境：后端API始终使用3000端口，无论前端使用什么端口
        const backendPort = '3000';
        return `${protocol}//${hostname}:${backendPort}/api`;
    }

    function applyGlobalContent(globalData = {}) {
        const { brand = {}, nav = [], languages = [], footer = {}, floatingSidebar = {} } = globalData;
        const logoContainer = document.querySelector('.logo');
        
        // 如果有Logo图片，显示Logo；否则显示品牌名称和标语
        if (logoContainer) {
            if (brand.logo && brand.logo.trim()) {
                // 显示Logo图片
                let logoImg = logoContainer.querySelector('.logo-img');
                if (!logoImg) {
                    // 创建Logo图片元素
                    logoImg = document.createElement('img');
                    logoImg.className = 'logo-img';
                    logoImg.alt = brand.name || 'Logo';
                    logoContainer.innerHTML = '';
                    logoContainer.appendChild(logoImg);
                }
                logoImg.src = brand.logo;
                logoImg.style.display = 'block';
                
                // 隐藏文字内容
                const logoTitle = logoContainer.querySelector('h2');
                const logoTagline = logoContainer.querySelector('span');
                if (logoTitle) logoTitle.style.display = 'none';
                if (logoTagline) logoTagline.style.display = 'none';
            } else {
                // 显示品牌名称和标语
                const logoTitle = logoContainer.querySelector('h2');
                const logoTagline = logoContainer.querySelector('span');
                const logoImg = logoContainer.querySelector('.logo-img');
                
                if (logoTitle && brand.name) {
                    logoTitle.textContent = brand.name;
                    logoTitle.style.display = 'block';
                }
                if (logoTagline && brand.tagline) {
                    logoTagline.textContent = brand.tagline;
                    logoTagline.style.display = 'block';
                }
                if (logoImg) {
                    logoImg.style.display = 'none';
                }
            }
        }
        
        // 应用品牌口号到首页 hero 区域
        const heroTitle = document.querySelector('.hero-text h1');
        if (heroTitle) {
            // 如果后端有品牌口号，使用后端的；否则保持HTML中的默认文本
            if (brand.slogan) {
                heroTitle.textContent = brand.slogan;
            }
        }
        
        // 应用品牌描述到首页 hero 副标题区域
        const heroSubtitle = document.querySelector('.hero-text p');
        if (heroSubtitle && brand.description) {
            heroSubtitle.textContent = brand.description;
        }
        
        // 应用品牌口号到案例页 header（作为默认值，如果页面内容中没有特定的 tagline 则使用）
        const casesTagline = document.querySelector('.cases-header .tagline');
        if (casesTagline && brand.slogan) {
            casesTagline.textContent = brand.slogan;
        }

        const navMenus = document.querySelectorAll('.nav-menu');
        navMenus.forEach(menu => {
            if (!nav || !nav.length) return;
            // 检查是否是预览模式
            const urlParams = new URLSearchParams(window.location.search);
            const isPreview = urlParams.get('preview') === 'true' || urlParams.get('preview') === '1';
            
            menu.innerHTML = nav.map(item => {
                const active = item.key === pageKey ? 'active' : '';
                let linkUrl = item.link;
                // 如果是预览模式，在链接中添加 preview=true 参数
                if (isPreview && linkUrl) {
                    try {
                        const linkUrlObj = linkUrl.startsWith('/') || linkUrl.startsWith('./') 
                            ? new URL(linkUrl, window.location.origin)
                            : new URL(linkUrl);
                        if (!linkUrlObj.searchParams.has('preview')) {
                            linkUrlObj.searchParams.set('preview', 'true');
                            linkUrl = linkUrlObj.toString().replace(window.location.origin, '');
                        }
                    } catch (e) {
                        // URL解析失败，使用简单字符串拼接
                        linkUrl += (linkUrl.includes('?') ? '&' : '?') + 'preview=true';
                    }
                }
                return `<li><a href="${linkUrl}" class="${active}">${item.label}</a></li>`;
            }).join('');
        });

        const langSelects = document.querySelectorAll('.lang-select');
        langSelects.forEach(select => {
            if (!select || !languages || !languages.length) return;
            select.innerHTML = languages.map(lang => `<option value="${lang.value}">${lang.label}</option>`).join('');
        });

        const footerEl = document.querySelector('.footer .footer-content');
        if (footerEl) {
            const columns = footer.columns || [];
            footerEl.innerHTML = `
                <div class="footer-section">
                    <h4>${footer.title || ''}</h4>
                    ${(footer.description || []).map(p => `<p>${p}</p>`).join('')}
                </div>
                ${columns.map(column => `
                    <div class="footer-section">
                        <h4>${column.title || ''}</h4>
                        <ul>
                            ${(column.links || []).map(link => {
                                let linkUrl = link.link;
                                // 检查是否是预览模式
                                const urlParams = new URLSearchParams(window.location.search);
                                const isPreview = urlParams.get('preview') === 'true' || urlParams.get('preview') === '1';
                                // 如果是预览模式，在链接中添加 preview=true 参数
                                if (isPreview && linkUrl) {
                                    try {
                                        const linkUrlObj = linkUrl.startsWith('/') || linkUrl.startsWith('./') 
                                            ? new URL(linkUrl, window.location.origin)
                                            : new URL(linkUrl);
                                        if (!linkUrlObj.searchParams.has('preview')) {
                                            linkUrlObj.searchParams.set('preview', 'true');
                                            linkUrl = linkUrlObj.toString().replace(window.location.origin, '');
                                        }
                                    } catch (e) {
                                        // URL解析失败，使用简单字符串拼接
                                        linkUrl += (linkUrl.includes('?') ? '&' : '?') + 'preview=true';
                                    }
                                }
                                return `<li><a href="${linkUrl}">${link.label}</a></li>`;
                            }).join('')}
                        </ul>
                    </div>
                `).join('')}
                <div class="footer-section">
                    <h4>联系方式</h4>
                    <p>服务热线：${footer.contact?.hotline || ''}</p>
                    <p>工作时间：${footer.contact?.hours || ''}</p>
                </div>
            `;
            const footerBottom = document.querySelector('.footer-bottom');
            if (footerBottom) {
                let footerBottomHTML = '';
                if (footer.copyright) {
                    footerBottomHTML += `<p>${footer.copyright}</p>`;
                }
                if (footer.icp) {
                    footerBottomHTML += `<p style="margin-top: 8px; font-size: 12px; opacity: 0.8;">${footer.icp}</p>`;
                }
                footerBottom.innerHTML = footerBottomHTML;
            }
        }

        const floating = document.querySelector('.floating-sidebar');
        if (floating && floatingSidebar) {
            // 兼容旧格式：如果是数组，转换为新格式
            let items = [];
            let showConsultation = true;
            let showCustomerService = true;
            
            if (Array.isArray(floatingSidebar)) {
                // 旧格式：直接是数组
                items = floatingSidebar;
            } else if (floatingSidebar.items && Array.isArray(floatingSidebar.items)) {
                // 新格式：对象包含 items 数组和开关配置
                items = floatingSidebar.items;
                showConsultation = floatingSidebar.showConsultation !== false; // 默认为 true
                showCustomerService = floatingSidebar.showCustomerService !== false; // 默认为 true
            } else {
                return; // 无效格式，不渲染
            }
            
            if (items.length === 0) {
                return; // 没有项，不渲染
            }
            
            const filteredItems = items.filter(item => {
                // 返回顶部始终显示
                if (item.action === 'backToTop') {
                    return true;
                }
                // 根据配置显示/隐藏在线咨询
                if (item.text === '在线咨询') {
                    return showConsultation;
                }
                // 根据配置显示/隐藏在线客服
                if (item.text === '在线客服') {
                    return showCustomerService;
                }
                // 其他项默认显示
                return true;
            });
            
            floating.innerHTML = filteredItems.map(item => {
                const actionAttr = item.action ? `data-action="${item.action}"` : '';
                const textAttr = item.text ? `data-text="${item.text}"` : '';
                const iconEl = item.icon && item.icon.length === 2 ? `<span class="sidebar-icon">${item.icon}</span>` : `<div class="sidebar-avatar"><span>${item.icon || ''}</span></div>`;
                return `
                    <div class="sidebar-item" ${actionAttr} ${textAttr}>
                        ${iconEl}
                        <span class="sidebar-text">${item.text || ''}</span>
                    </div>
                `;
            }).join('');
            
            // 处理返回顶部
            const backToTop = floating.querySelector('[data-action="backToTop"]');
            if (backToTop) {
                backToTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
            }
            
            // 处理在线咨询和在线客服 - 显示暂不支持提示
            const consultItems = floating.querySelectorAll('.sidebar-item');
            consultItems.forEach(item => {
                const text = item.getAttribute('data-text');
                const action = item.getAttribute('data-action');
                
                // 如果不是返回顶部，且文本是"在线咨询"或"在线客服"
                if (!action && (text === '在线咨询' || text === '在线客服')) {
                    item.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        
                        // 创建提示消息
                        const message = document.createElement('div');
                        message.style.cssText = `
                            position: fixed;
                            top: 50%;
                            left: 50%;
                            transform: translate(-50%, -50%);
                            background: linear-gradient(135deg, #1f2937 0%, #111827 100%);
                            color: white;
                            padding: 20px 30px;
                            border-radius: 12px;
                            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
                            z-index: 10000;
                            font-size: 14px;
                            text-align: center;
                            min-width: 200px;
                            animation: fadeIn 0.3s ease;
                        `;
                        message.textContent = '暂不支持此功能';
                        
                        // 添加动画样式
                        if (!document.getElementById('sidebar-message-style')) {
                            const style = document.createElement('style');
                            style.id = 'sidebar-message-style';
                            style.textContent = `
                                @keyframes fadeIn {
                                    from { opacity: 0; transform: translate(-50%, -50%) scale(0.9); }
                                    to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
                                }
                                @keyframes fadeOut {
                                    from { opacity: 1; transform: translate(-50%, -50%) scale(1); }
                                    to { opacity: 0; transform: translate(-50%, -50%) scale(0.9); }
                                }
                            `;
                            document.head.appendChild(style);
                        }
                        
                        document.body.appendChild(message);
                        
                        // 3秒后自动移除
                        setTimeout(() => {
                            message.style.animation = 'fadeOut 0.3s ease';
                            setTimeout(() => {
                                if (message.parentNode) {
                                    message.parentNode.removeChild(message);
                                }
                            }, 300);
                        }, 2000);
                    });
                }
            });
        }
    }

    function renderPageContent(page, data = {}) {
        switch (page) {
            case 'home':
                renderHomeContent(data);
                break;
            case 'products':
                renderProductsContent(data);
                break;
            case 'cases':
                renderCasesContent(data);
                break;
            case 'about':
                renderAboutContent(data);
                break;
            case 'service':
                renderServiceContent(data);
                break;
            case 'contact':
                renderContactContent(data);
                break;
            default:
                break;
        }
    }

    function renderHomeContent(content) {
        const heroTitle = document.querySelector('.hero-text h1');
        const heroSubtitle = document.querySelector('.hero-text p');
        const heroButtons = document.querySelector('.hero-buttons');
        // 首页 hero 标题使用品牌口号（已在 applyGlobalContent 中设置），不再使用 content.hero.title
        // 首页 hero 副标题使用品牌描述（已在 applyGlobalContent 中设置），不再使用 content.hero.subtitle
        // 这样可以确保品牌信息在首页正确显示
        if (heroButtons && content.hero?.buttons) {
            heroButtons.innerHTML = content.hero.buttons.map(btn => {
                const variant = btn.variant === 'secondary' ? 'btn btn-secondary' :
                    btn.variant === 'outline' ? 'btn btn-outline' : 'btn btn-primary';
                return `<a href="${btn.link}" class="${variant}">${btn.label}</a>`;
            }).join('');
        }
        const phoneContent = document.querySelector('.phone-content');
        if (phoneContent && content.hero?.phone) {
            const { title, tagline, subtitle } = content.hero.phone;
            phoneContent.innerHTML = `
                <h3>${title || ''}</h3>
                <p>${tagline || ''}</p>
                <p class="subtitle">${subtitle || ''}</p>
            `;
        }

        const qrCards = document.querySelector('.qr-cards');
        if (qrCards && content.qrCards) {
            qrCards.innerHTML = content.qrCards.map(card => `
                <div class="qr-card">
                    <div class="qr-code">
                        ${card.image ? `<img src="${normalizeImageUrl(card.image)}" alt="${card.title}">` : '<div class="qr-placeholder">二维码</div>'}
                    </div>
                    <h4>${card.title || ''}</h4>
                    <p>${card.description || ''}</p>
                </div>
            `).join('');
        }

        const seriesContainer = document.querySelector('.product-series');
        if (seriesContainer && content.productSeries) {
            // 系列名称到分类的映射
            const seriesToCategory = {
                '经典系列': 'classic',
                '东方美学系列': 'oriental',
                '现代系列': 'modern',
                '轻奢系列': 'luxury',
                '现代年轻系列': 'young',
                '法式顶奢系列': 'french'
            };
            
            seriesContainer.innerHTML = content.productSeries.map(item => {
                const category = seriesToCategory[item] || 'all';
                return `<div class="series-item" data-series="${item}" data-category="${category}">${item}</div>`;
            }).join('');
            
            // 为系列标签添加点击事件
            const seriesItems = seriesContainer.querySelectorAll('.series-item');
            seriesItems.forEach(item => {
                item.addEventListener('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    const category = this.getAttribute('data-category');
                    if (category) {
                        // 跳转到产品页面，并传递分类参数
                        window.location.href = `products.html?category=${encodeURIComponent(category)}`;
                    }
                });
            });
        }

        const gallery = document.querySelector('.product-gallery');
        if (gallery && content.productGallery) {
            gallery.innerHTML = content.productGallery.map(item => `
                <div class="gallery-item" data-image-title="${item.title}" data-image-src="${normalizeImageUrl(item.image)}" data-image-description="${item.description || ''}">
                    <img data-src="${normalizeImageUrl(item.image)}" alt="${item.title}">
                    <div class="gallery-overlay">
                        <h3>${item.title}</h3>
                    </div>
                </div>
            `).join('');
            
            // 为产品画廊图片添加点击事件和懒加载
            const galleryItems = gallery.querySelectorAll('.gallery-item');
            galleryItems.forEach(item => {
                const title = item.getAttribute('data-image-title');
                const imageSrc = item.getAttribute('data-image-src');
                const description = item.getAttribute('data-image-description');
                const img = item.querySelector('img');
                
                // 添加懒加载
                if (window.lazyImageLoader && img) {
                    window.lazyImageLoader.addImage(img);
                }
                
                // 添加滚动显示动画
                if (window.scrollReveal) {
                    window.scrollReveal.addElement(item);
                }
                
                item.style.cursor = 'pointer';
                item.addEventListener('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    if (window.openProductModal) {
                        window.openProductModal({
                            title: title,
                            description: description || '',
                            detailedDescription: description || '',
                            image: imageSrc,
                            category: 'all'
                        });
                    }
                });
            });
        }

        const casesGrid = document.querySelector('.cases-grid');
        if (casesGrid && content.cases) {
            casesGrid.innerHTML = content.cases.map(item => `
                <div class="case-card" data-image-title="${item.title}" data-image-src="${normalizeImageUrl(item.image)}" data-image-description="${item.description || ''}">
                    <img data-src="${normalizeImageUrl(item.image)}" alt="${item.title}">
                    <div class="case-info">
                        <h3>${item.title}</h3>
                        <p>${item.description || ''}</p>
                    </div>
                </div>
            `).join('');
            
            // 为案例图片添加点击事件和懒加载
            const caseCards = casesGrid.querySelectorAll('.case-card');
            caseCards.forEach(card => {
                const title = card.getAttribute('data-image-title');
                const imageSrc = card.getAttribute('data-image-src');
                const description = card.getAttribute('data-image-description');
                const img = card.querySelector('img');
                
                // 添加懒加载
                if (window.lazyImageLoader && img) {
                    window.lazyImageLoader.addImage(img);
                }
                
                // 添加滚动显示动画
                if (window.scrollReveal) {
                    window.scrollReveal.addElement(card);
                }
                
                card.style.cursor = 'pointer';
                card.addEventListener('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    if (window.openProductModal) {
                        window.openProductModal({
                            title: title,
                            description: description || '',
                            detailedDescription: description || '',
                            image: imageSrc,
                            category: 'all'
                        });
                    }
                });
            });
        }

        const ctaBtn = document.querySelector('.cases-preview .btn-outline');
        if (ctaBtn && content.cta) {
            ctaBtn.textContent = content.cta.label;
            ctaBtn.href = content.cta.link;
        }
    }

    function renderProductsContent(content) {
        const headerTitle = document.querySelector('.page-header h1');
        const headerSubtitle = document.querySelector('.page-header p');
        const pageHeader = document.querySelector('.page-header');
        
        if (headerTitle && content.header?.title) headerTitle.textContent = content.header.title;
        if (headerSubtitle && content.header?.subtitle) headerSubtitle.textContent = content.header.subtitle;
        
        // 设置背景图片
        if (pageHeader && content.header?.backgroundImage) {
            let bgImage = normalizeImageUrl(content.header.backgroundImage);
            pageHeader.style.backgroundImage = `linear-gradient(rgba(0,0,0,0.4), rgba(0,0,0,0.4)), url('${bgImage}')`;
            pageHeader.style.backgroundSize = 'cover';
            pageHeader.style.backgroundPosition = 'center';
        }

        const filterTabs = document.querySelector('.filter-tabs');
        if (filterTabs && content.filters) {
            filterTabs.innerHTML = content.filters.map((filter, index) => `
                <button class="filter-tab ${index === 0 ? 'active' : ''}" data-category="${filter.category}">
                    ${filter.label}
                </button>
            `).join('');
        }

        const productsGrid = document.querySelector('.products-grid');
        if (productsGrid && content.productCards) {
            // 缓存产品数据到window对象，供products.js筛选使用
            window.productsDataCache = content.productCards;
            
            // 从URL参数获取当前筛选的分类
            const urlParams = new URLSearchParams(window.location.search);
            const currentCategory = urlParams.get('category') || 'all';
            
            // 根据当前分类筛选产品卡片
            const filteredCards = currentCategory === 'all' 
                ? content.productCards 
                : content.productCards.filter(card => card.category === currentCategory);
            
            // 只渲染匹配的产品卡片
            productsGrid.innerHTML = filteredCards.map(card => `
                <div class="product-card" data-category="${card.category || 'all'}">
                    <div class="product-image" data-product-title="${card.title}" data-product-description="${card.description || ''}" data-product-image="${normalizeImageUrl(card.image)}">
                        <img data-src="${normalizeImageUrl(card.image)}" alt="${card.title}">
                        <div class="product-overlay">
                            <button class="btn btn-primary view-detail-btn" type="button">查看详情</button>
                        </div>
                    </div>
                    <div class="product-info">
                        <h3>${card.title}</h3>
                        <p>${card.description || ''}</p>
                    </div>
                </div>
            `).join('');
            
            // 为产品图片添加点击事件和懒加载
            const productImages = productsGrid.querySelectorAll('.product-image');
            productImages.forEach((imageEl, index) => {
                const title = imageEl.getAttribute('data-product-title');
                const description = imageEl.getAttribute('data-product-description');
                const imageSrc = imageEl.getAttribute('data-product-image');
                const img = imageEl.querySelector('img');
                const cardElement = imageEl.closest('.product-card');
                
                // 添加懒加载
                if (window.lazyImageLoader && img) {
                    window.lazyImageLoader.addImage(img);
                }
                
                // 添加滚动显示动画
                if (window.scrollReveal && cardElement) {
                    window.scrollReveal.addElement(cardElement);
                }
                
                // 从缓存数据中获取详细描述
                const cardData = filteredCards[index];
                const detailedDescription = cardData ? (cardData.detailedDescription || '') : '';
                
                const showProductModal = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (window.openProductModal) {
                        // 获取产品卡片数据
                        const category = cardElement ? cardElement.getAttribute('data-category') : 'all';
                        
                        window.openProductModal({
                            title: title,
                            description: description,
                            detailedDescription: detailedDescription,
                            image: imageSrc,
                            category: category
                        });
                    }
                };
                
                imageEl.addEventListener('click', showProductModal);
                const viewDetailBtn = imageEl.querySelector('.view-detail-btn');
                if (viewDetailBtn) {
                    viewDetailBtn.addEventListener('click', showProductModal);
                }
            });
            
            // 产品卡片生成后，触发自定义事件，通知products.js重新初始化
            const event = new CustomEvent('productsLoaded', { 
                detail: { 
                    count: filteredCards.length,
                    category: currentCategory
                } 
            });
            window.dispatchEvent(event);
        }

    }

    function renderCasesContent(content) {
        if (content.header) {
            const tagline = document.querySelector('.cases-header .tagline');
            const title = document.querySelector('.cases-header h1');
            const subtitle = document.querySelector('.cases-header .subtitle');
            const pageHeader = document.querySelector('.cases-header') || document.querySelector('.page-header');
            
            // 优先使用页面特定的 tagline，如果没有则使用品牌口号（已在 applyGlobalContent 中设置）
            if (tagline && content.header.tagline) {
                tagline.textContent = content.header.tagline;
            } else if (tagline) {
                // 如果页面内容中没有 tagline，保持使用品牌口号（已在 applyGlobalContent 中设置）
            }
            if (title && content.header.title) title.textContent = content.header.title;
            if (subtitle && content.header.subtitle) subtitle.textContent = content.header.subtitle;
            
            // 设置背景图片
            if (pageHeader && content.header.backgroundImage) {
                let bgImage = normalizeImageUrl(content.header.backgroundImage);
                // 使用 setProperty 确保样式优先级，覆盖 CSS 中的背景图片
                pageHeader.style.setProperty('background-image', `linear-gradient(rgba(0,0,0,0.4), rgba(0,0,0,0.4)), url('${bgImage}')`, 'important');
                pageHeader.style.setProperty('background-size', 'cover', 'important');
                pageHeader.style.setProperty('background-position', 'center', 'important');
            }
        }

        const leftContainer = document.querySelector('.cases-left');
        if (leftContainer && content.featured?.small) {
            // 只显示前 3 个
            const smallItemsData = content.featured.small.slice(0, 3);
            leftContainer.innerHTML = smallItemsData.map((item, index) => {
                // 对 JSON 字符串进行 HTML 转义，避免引号冲突
                const normalizedImage = normalizeImageUrl(item.image);
                const normalizedImages = (item.images || [item.image]).map(img => normalizeImageUrl(img));
                const imagesJson = JSON.stringify(normalizedImages).replace(/"/g, '&quot;');
                return `
                <div class="case-item-small" data-case-title="${item.title}" data-case-description="${(item.description || '').replace(/"/g, '&quot;')}" data-case-images="${imagesJson}">
                    <img data-src="${normalizedImage}" alt="${item.title}">
                    <div class="case-label">${item.title}${item.description ? '<br><span style="font-size: 14px; opacity: 0.9;">' + item.description + '</span>' : ''}</div>
                </div>
            `;
            }).join('');
            
            // 为左侧小图添加懒加载、滚动动画和点击事件
            const smallItems = leftContainer.querySelectorAll('.case-item-small');
            const isCasesPage = pageKey === 'cases'; // 检查是否是 cases 页面
            
            smallItems.forEach((item, index) => {
                const img = item.querySelector('img');
                // 确保懒加载器已初始化
                if (window.lazyImageLoader && img && img.hasAttribute('data-src')) {
                    window.lazyImageLoader.addImage(img);
                } else if (img && img.hasAttribute('data-src')) {
                    // 如果懒加载器还没准备好，等待一下再添加
                    setTimeout(() => {
                        if (window.lazyImageLoader) {
                            window.lazyImageLoader.addImage(img);
                        }
                    }, 100);
                }
                if (window.scrollReveal) {
                    window.scrollReveal.addElement(item);
                }
                
                // 如果是 cases 页面，不添加点击事件（由 cases.js 处理）
                // 或者如果元素已经被 cases.js 处理过，也跳过
                if (isCasesPage || item.dataset.clickHandlerAdded === 'true') {
                    return;
                }
                
                // 添加点击事件（仅用于非 cases 页面或动态加载的内容）
                const title = item.getAttribute('data-case-title');
                const description = item.getAttribute('data-case-description');
                const imagesJson = item.getAttribute('data-case-images');
                let images = [];
                try {
                    images = JSON.parse(imagesJson);
                } catch (e) {
                    images = [item.querySelector('img').getAttribute('data-src') || item.querySelector('img').src];
                }
                
                item.style.cursor = 'pointer';
                item.addEventListener('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    // 验证数据
                    if (!title) {
                        console.error('案例标题为空');
                        return;
                    }
                    if (!images || images.length === 0) {
                        console.error('案例图片为空', images);
                        return;
                    }
                    
                    console.log('点击案例项，准备打开模态框', {
                        title,
                        description,
                        images,
                        hasOpenProductModal: typeof window.openProductModal === 'function'
                    });
                    
                    // 确保 openProductModal 已加载
                    if (typeof window.openProductModal === 'function') {
                        try {
                            const productData = {
                                title: title || '案例',
                                description: description || '',
                                detailedDescription: description || '',
                                image: images[0] || '',
                                images: images && images.length > 0 ? images : [images[0] || ''],
                                category: 'all'
                            };
                            console.log('调用 openProductModal，参数:', productData);
                            window.openProductModal(productData);
                            console.log('openProductModal 调用完成');
                        } catch (error) {
                            console.error('打开模态框失败:', error);
                            console.error('错误堆栈:', error.stack);
                            // 如果出错，恢复页面滚动
                            document.body.style.overflow = '';
                        }
                    } else {
                        console.warn('openProductModal 函数未加载，等待中...');
                        // 如果函数未加载，等待一下再试
                        setTimeout(() => {
                            if (typeof window.openProductModal === 'function') {
                                try {
                                    const productData = {
                                        title: title || '案例',
                                        description: description || '',
                                        detailedDescription: description || '',
                                        image: images[0] || '',
                                        images: images && images.length > 0 ? images : [images[0] || ''],
                                        category: 'all'
                                    };
                                    console.log('延迟调用 openProductModal，参数:', productData);
                                    window.openProductModal(productData);
                                } catch (error) {
                                    console.error('打开模态框失败:', error);
                                    console.error('错误堆栈:', error.stack);
                                    document.body.style.overflow = '';
                                }
                            } else {
                                console.error('openProductModal 函数未加载');
                                document.body.style.overflow = '';
                            }
                        }, 100);
                    }
                });
            });
        }

        const rightContainer = document.querySelector('.cases-right');
        if (rightContainer && content.featured?.large) {
            // 只显示前 2 个
            const largeItemsData = content.featured.large.slice(0, 2);
            rightContainer.innerHTML = largeItemsData.map(item => {
                // 对 JSON 字符串进行 HTML 转义，避免引号冲突
                const normalizedImage = normalizeImageUrl(item.image);
                const normalizedImages = (item.images || [item.image]).map(img => normalizeImageUrl(img));
                const imagesJson = JSON.stringify(normalizedImages).replace(/"/g, '&quot;');
                return `
                <div class="case-item-large" data-case-title="${item.title}" data-case-description="${(item.description || '').replace(/"/g, '&quot;')}" data-case-images="${imagesJson}">
                    <img data-src="${normalizedImage}" alt="${item.title}">
                    <div class="case-label-large">
                        <h3>${item.title}</h3>
                        <p>${item.description || ''}</p>
                    </div>
                </div>
            `;
            }).join('');
            
            // 为右侧大图添加懒加载、滚动动画和点击事件
            const largeItems = rightContainer.querySelectorAll('.case-item-large');
            const isCasesPage = pageKey === 'cases'; // 检查是否是 cases 页面
            
            largeItems.forEach(item => {
                const img = item.querySelector('img');
                // 确保懒加载器已初始化
                if (window.lazyImageLoader && img && img.hasAttribute('data-src')) {
                    window.lazyImageLoader.addImage(img);
                } else if (img && img.hasAttribute('data-src')) {
                    // 如果懒加载器还没准备好，等待一下再添加
                    setTimeout(() => {
                        if (window.lazyImageLoader) {
                            window.lazyImageLoader.addImage(img);
                        }
                    }, 100);
                }
                if (window.scrollReveal) {
                    window.scrollReveal.addElement(item);
                }
                
                // 如果是 cases 页面，不添加点击事件（由 cases.js 处理）
                // 或者如果元素已经被 cases.js 处理过，也跳过
                if (isCasesPage || item.dataset.clickHandlerAdded === 'true') {
                    return;
                }
                
                // 添加点击事件（仅用于非 cases 页面或动态加载的内容）
                const title = item.getAttribute('data-case-title');
                const description = item.getAttribute('data-case-description');
                const imagesJson = item.getAttribute('data-case-images');
                let images = [];
                try {
                    images = JSON.parse(imagesJson);
                } catch (e) {
                    images = [item.querySelector('img').getAttribute('data-src') || item.querySelector('img').src];
                }
                
                item.style.cursor = 'pointer';
                item.addEventListener('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    // 验证数据
                    if (!title) {
                        console.error('案例标题为空');
                        return;
                    }
                    if (!images || images.length === 0) {
                        console.error('案例图片为空', images);
                        return;
                    }
                    
                    console.log('点击案例项，准备打开模态框', {
                        title,
                        description,
                        images,
                        hasOpenProductModal: typeof window.openProductModal === 'function'
                    });
                    
                    // 确保 openProductModal 已加载
                    if (typeof window.openProductModal === 'function') {
                        try {
                            const productData = {
                                title: title || '案例',
                                description: description || '',
                                detailedDescription: description || '',
                                image: images[0] || '',
                                images: images && images.length > 0 ? images : [images[0] || ''],
                                category: 'all'
                            };
                            console.log('调用 openProductModal，参数:', productData);
                            window.openProductModal(productData);
                            console.log('openProductModal 调用完成');
                        } catch (error) {
                            console.error('打开模态框失败:', error);
                            console.error('错误堆栈:', error.stack);
                            // 如果出错，恢复页面滚动
                            document.body.style.overflow = '';
                        }
                    } else {
                        console.warn('openProductModal 函数未加载，等待中...');
                        // 如果函数未加载，等待一下再试
                        setTimeout(() => {
                            if (typeof window.openProductModal === 'function') {
                                try {
                                    const productData = {
                                        title: title || '案例',
                                        description: description || '',
                                        detailedDescription: description || '',
                                        image: images[0] || '',
                                        images: images && images.length > 0 ? images : [images[0] || ''],
                                        category: 'all'
                                    };
                                    console.log('延迟调用 openProductModal，参数:', productData);
                                    window.openProductModal(productData);
                                } catch (error) {
                                    console.error('打开模态框失败:', error);
                                    console.error('错误堆栈:', error.stack);
                                    document.body.style.overflow = '';
                                }
                            } else {
                                console.error('openProductModal 函数未加载');
                                document.body.style.overflow = '';
                            }
                        }, 100);
                    }
                });
            });
        }

        const grid = document.querySelector('.cases-grid');
        if (grid && content.casesGrid) {
            grid.innerHTML = content.casesGrid.map(item => {
                // 对 JSON 字符串进行 HTML 转义，避免引号冲突
                const normalizedImage = normalizeImageUrl(item.image);
                const normalizedImages = (item.images || [item.image]).map(img => normalizeImageUrl(img));
                const imagesJson = JSON.stringify(normalizedImages).replace(/"/g, '&quot;');
                return `
                <div class="case-card" data-case-title="${item.title}" data-case-description="${(item.description || '').replace(/"/g, '&quot;')}" data-case-images="${imagesJson}">
                    <img data-src="${normalizedImage}" alt="${item.title}">
                    <div class="case-info">
                        <h3>${item.title}</h3>
                        <p>${item.description || ''}</p>
                    </div>
                </div>
            `;
            }).join('');
            
            // 为案例网格添加懒加载、滚动动画和点击事件
            const caseCards = grid.querySelectorAll('.case-card');
            const isCasesPage = pageKey === 'cases'; // 检查是否是 cases 页面
            
            caseCards.forEach(card => {
                const img = card.querySelector('img');
                // 确保懒加载器已初始化
                if (window.lazyImageLoader && img && img.hasAttribute('data-src')) {
                    window.lazyImageLoader.addImage(img);
                } else if (img && img.hasAttribute('data-src')) {
                    // 如果懒加载器还没准备好，等待一下再添加
                    setTimeout(() => {
                        if (window.lazyImageLoader) {
                            window.lazyImageLoader.addImage(img);
                        }
                    }, 100);
                }
                if (window.scrollReveal) {
                    window.scrollReveal.addElement(card);
                }
                
                // 如果是 cases 页面，不添加点击事件（由 cases.js 处理）
                // 或者如果元素已经被 cases.js 处理过，也跳过
                if (isCasesPage || card.dataset.clickHandlerAdded === 'true') {
                    return;
                }
                
                // 添加点击事件（仅用于非 cases 页面或动态加载的内容）
                const title = card.getAttribute('data-case-title');
                const description = card.getAttribute('data-case-description');
                const imagesJson = card.getAttribute('data-case-images');
                let images = [];
                try {
                    images = JSON.parse(imagesJson);
                } catch (e) {
                    images = [card.querySelector('img').getAttribute('data-src') || card.querySelector('img').src];
                }
                
                card.style.cursor = 'pointer';
                card.addEventListener('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    if (window.openProductModal) {
                        window.openProductModal({
                            title: title,
                            description: description,
                            detailedDescription: description,
                            image: images[0],
                            images: images,
                            category: 'all'
                        });
                    }
                });
            });
        }
    }

    function renderAboutContent(content) {
        const heroImage = document.querySelector('.about-header img');
        if (heroImage && content.heroImage) {
            heroImage.src = content.heroImage;
        }

        const storyContainer = document.querySelector('.story-content');
        if (storyContainer && content.story?.paragraphs) {
            storyContainer.innerHTML = content.story.paragraphs.map(p => `<p>${p}</p>`).join('');
            const title = document.querySelector('.brand-story .section-title');
            const subtitle = document.querySelector('.brand-story .title-en');
            if (title && content.story.title) title.textContent = content.story.title;
            if (subtitle && content.story.subtitle) subtitle.textContent = content.story.subtitle;
        }

        const advGrid = document.querySelector('.advantages-grid');
        if (advGrid && content.advantages) {
            advGrid.innerHTML = content.advantages.map(item => `
                <div class="advantage-item">
                    <div class="advantage-icon">${item.icon || ''}</div>
                    <h3>${item.title}</h3>
                    <p>${item.description || ''}</p>
                </div>
            `).join('');
        }

        const timeline = document.querySelector('.timeline-container');
        if (timeline && content.timeline) {
            timeline.innerHTML = content.timeline.map(item => `
                <div class="timeline-item">
                    <div class="timeline-year">${item.year}</div>
                    <div class="timeline-content">
                        <h3>${item.title}</h3>
                        <p>${item.description || ''}</p>
                    </div>
                </div>
            `).join('');
        }
    }

    function renderServiceContent(content) {
        const headerTitle = document.querySelector('.service-header h1');
        const headerSubtitle = document.querySelector('.service-header p');
        if (headerTitle && content.header?.title) headerTitle.textContent = content.header.title;
        if (headerSubtitle && content.header?.subtitle) headerSubtitle.textContent = content.header.subtitle;

        const processSteps = document.querySelector('.process-steps');
        if (processSteps && content.process) {
            processSteps.innerHTML = content.process.map(item => `
                <div class="step-item">
                    <div class="step-number">${item.number}</div>
                    <h3>${item.title}</h3>
                    <p>${item.description || ''}</p>
                </div>
            `).join('');
        }

        const advantagesGrid = document.querySelector('.service-advantages .advantages-grid');
        if (advantagesGrid && content.advantages) {
            advantagesGrid.innerHTML = content.advantages.map(item => `
                <div class="advantage-card">
                    <div class="advantage-icon">${item.icon || ''}</div>
                    <h3>${item.title}</h3>
                    <p>${item.description || ''}</p>
                </div>
            `).join('');
        }

        const appointmentBox = document.querySelector('.appointment-box');
        if (appointmentBox && content.appointment) {
            appointmentBox.querySelector('h2').textContent = content.appointment.title || '预约设计';
            appointmentBox.querySelector('p').textContent = content.appointment.description || '';
            const button = appointmentBox.querySelector('button[type="submit"]');
            if (button && content.appointment.button) button.textContent = content.appointment.button;
        }
    }

    function renderContactContent(content) {
        const headerTitle = document.querySelector('.contact-header h1');
        const headerSubtitle = document.querySelector('.contact-header p');
        if (headerTitle && content.header?.title) headerTitle.textContent = content.header.title;
        if (headerSubtitle && content.header?.subtitle) headerSubtitle.textContent = content.header.subtitle;

        const serviceSection = document.querySelector('.contact-info .contact-section:nth-child(1)');
        if (serviceSection && content.service) {
            serviceSection.querySelector('h2').textContent = content.service.title || '客户服务';
            const desc = serviceSection.querySelector('.section-desc');
            if (desc) desc.textContent = content.service.description || '';
            const hours = serviceSection.querySelector('.service-hours');
            if (hours) {
                hours.innerHTML = `<h3>服务时间</h3>${(content.service.hours || []).map(line => `<p>${line}</p>`).join('')}`;
            }
            const online = serviceSection.querySelector('.online-service');
            if (online && content.service.online) {
                // 根据开关配置过滤显示的项
                // 如果字段不存在或为 undefined，默认为 true（显示）
                // 使用严格等于 true 来判断，false 或 undefined 都视为不显示（但为了兼容，undefined 默认为 true）
                const showConsultation = content.service.hasOwnProperty('showConsultation') 
                    ? content.service.showConsultation === true 
                    : true; // 如果字段不存在，默认显示
                const showCustomerService = content.service.hasOwnProperty('showCustomerService') 
                    ? content.service.showCustomerService === true 
                    : true; // 如果字段不存在，默认显示
                
                // 调试信息（可在控制台查看）
                console.log('联系我们页面 - 在线服务配置:', {
                    showConsultation,
                    showCustomerService,
                    hasShowConsultation: content.service.hasOwnProperty('showConsultation'),
                    hasShowCustomerService: content.service.hasOwnProperty('showCustomerService'),
                    showConsultationValue: content.service.showConsultation,
                    showCustomerServiceValue: content.service.showCustomerService,
                    onlineItems: content.service.online,
                    serviceData: content.service
                });
                
                const filteredOnline = content.service.online.filter(item => {
                    // 根据配置显示/隐藏在线咨询
                    if (item.title === '在线咨询') {
                        return showConsultation;
                    }
                    // 根据配置显示/隐藏在线客服
                    if (item.title === '在线客服') {
                        return showCustomerService;
                    }
                    // 其他项默认显示
                    return true;
                });
                
                // 如果没有可显示的项目，隐藏容器
                if (filteredOnline.length === 0) {
                    online.style.display = 'none';
                } else {
                    online.style.display = '';
                    online.innerHTML = filteredOnline.map(item => `
                        <div class="service-item">
                            <div class="${item.icon?.length > 1 ? 'service-icon' : 'service-avatar'}">${item.icon || ''}</div>
                            <div>
                                <p>${item.title}</p>
                                ${item.subtitle ? `<span>${item.subtitle}</span>` : ''}
                            </div>
                        </div>
                    `).join('');
                }
            }
        }

        const companySection = document.querySelector('.contact-info .contact-section:nth-child(2)');
        if (companySection && content.company) {
            companySection.querySelector('h2').textContent = content.company.title || '公司信息';
            const items = companySection.querySelectorAll('.info-item');
            if (items[0]) {
                items[0].querySelector('h3').textContent = '服务热线';
                items[0].querySelector('.phone-number').textContent = content.company.hotline || '';
            }
            if (items[1]) {
                items[1].querySelector('h3').textContent = '公司地址';
                items[1].querySelector('p').textContent = content.company.address || '';
            }
        }


        const formSection = document.querySelector('.contact-form-section .section-title');
        if (formSection && content.form?.title) formSection.textContent = content.form.title;
        const formButton = document.querySelector('.contact-form button[type="submit"]');
        if (formButton && content.form?.button) formButton.textContent = content.form.button;
    }
})();

