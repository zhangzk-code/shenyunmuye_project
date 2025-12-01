// 产品筛选功能 - 重构版本
(function() {
    'use strict';
    
    // 系列名称到分类的映射（与首页保持一致）
    const SERIES_TO_CATEGORY = {
        '经典系列': 'classic',
        '东方美学系列': 'oriental',
        '现代系列': 'modern',
        '轻奢系列': 'luxury',
        '现代年轻系列': 'young',
        '法式顶奢系列': 'french'
    };
    
    // 分类到系列名称的映射
    const CATEGORY_TO_SERIES = {
        'classic': '经典系列',
        'oriental': '东方美学系列',
        'modern': '现代系列',
        'luxury': '轻奢系列',
        'young': '现代年轻系列',
        'french': '法式顶奢系列',
        'all': '全部'
    };
    
    let filterTabs = null;
    let productCards = null;
    let isInitialized = false;
    
    // 初始化函数
    function initProductFilter() {
        // 如果已经初始化，不再重复初始化
        if (isInitialized) return;
        
        filterTabs = document.querySelectorAll('.filter-tab');
        productCards = document.querySelectorAll('.product-card');
        
        // 检查必要元素是否存在
        if (filterTabs.length === 0) {
            setTimeout(initProductFilter, 200);
            return;
        }
        
        // 产品卡片可能由content.js动态生成，需要等待更长时间
        if (productCards.length === 0) {
            setTimeout(initProductFilter, 500);
            return;
        }
        
        // 标记已初始化
        isInitialized = true;
        
        // 从URL参数获取分类
        const urlParams = new URLSearchParams(window.location.search);
        let categoryParam = urlParams.get('category');
        
        // 如果URL参数无效，默认显示全部
        if (!categoryParam || !isValidCategory(categoryParam)) {
            categoryParam = 'all';
        }
        
        // 初始化时应用筛选
        applyFilter(categoryParam, false);
        
        // 绑定筛选标签点击事件
        bindFilterEvents();
        
        // 监听浏览器前进/后退
        window.addEventListener('popstate', function(e) {
            const urlParams = new URLSearchParams(window.location.search);
            const category = urlParams.get('category') || 'all';
            applyFilter(category, false);
        });
    }
    
    // 验证分类是否有效
    function isValidCategory(category) {
        return category === 'all' || SERIES_TO_CATEGORY.hasOwnProperty(CATEGORY_TO_SERIES[category]);
    }
    
    // 应用筛选
    function applyFilter(category, updateUrl = true) {
        if (!category || !isValidCategory(category)) {
            category = 'all';
        }
        
        // 更新筛选标签状态
        updateFilterTabs(category);
        
        // 筛选产品卡片
        filterProductCards(category);
        
        // 更新URL（如果需要）
        if (updateUrl) {
            updateUrlParam(category);
        }
    }
    
    // 更新筛选标签状态
    function updateFilterTabs(category) {
        if (!filterTabs) return;

filterTabs.forEach(tab => {
            tab.classList.remove('active');
            const tabCategory = tab.getAttribute('data-category');
            if (tabCategory === category) {
        tab.classList.add('active');
            }
        });
    }
    
    // 筛选产品卡片 - 重新渲染匹配的卡片
    function filterProductCards(category) {
        // 获取网格容器
        const gridContainer = document.querySelector('.products-grid');
        if (!gridContainer) return;
        
        // 从content.js获取缓存的产品数据
        // 如果无法获取，则从当前DOM中获取所有卡片数据
        let allCardsData = null;
        
        // 尝试从window获取缓存的产品数据
        if (window.productsDataCache && Array.isArray(window.productsDataCache)) {
            allCardsData = window.productsDataCache;
            } else {
            // 如果缓存不存在，从当前DOM中提取数据
            const currentCards = gridContainer.querySelectorAll('.product-card');
            if (currentCards.length === 0) return;
            
            allCardsData = Array.from(currentCards).map(card => ({
                category: card.getAttribute('data-category'),
                title: card.querySelector('h3')?.textContent || '',
                description: card.querySelector('p')?.textContent || '',
                image: card.querySelector('img')?.src || card.querySelector('img')?.getAttribute('src') || ''
            }));
        }
        
        // 根据分类筛选产品卡片数据
        const filteredCards = category === 'all' 
            ? allCardsData 
            : allCardsData.filter(card => card.category === category);
        
        // 清空容器
        gridContainer.innerHTML = '';
        
        // 渲染匹配的产品卡片
        filteredCards.forEach((card, index) => {
            const cardElement = document.createElement('div');
            cardElement.className = 'product-card';
            cardElement.setAttribute('data-category', card.category || 'all');
            cardElement.style.opacity = '0';
            cardElement.style.transform = 'scale(0.95)';
            
            // 处理图片路径（如果是绝对路径，需要转换为相对路径）
            let imageSrc = card.image || '';
            if (imageSrc && (imageSrc.includes('http://') || imageSrc.includes('https://'))) {
                try {
                    // 提取相对路径
                    const urlObj = new URL(imageSrc);
                    imageSrc = urlObj.pathname;
                    if (imageSrc.startsWith('/')) {
                        imageSrc = imageSrc.substring(1);
                    }
                } catch (e) {
                    // URL解析失败，使用原始路径
                }
            }
            
            cardElement.innerHTML = `
                <div class="product-image" data-product-title="${card.title}" data-product-description="${card.description || ''}" data-product-image="${imageSrc}">
                    <img data-src="${imageSrc}" alt="${card.title}">
                    <div class="product-overlay">
                        <button class="btn btn-primary view-detail-btn" type="button">查看详情</button>
                    </div>
                </div>
                <div class="product-info">
                    <h3>${card.title}</h3>
                    <p>${card.description || ''}</p>
                </div>
            `;
            
            // 为产品图片添加点击事件和懒加载
            const productImage = cardElement.querySelector('.product-image');
            const viewDetailBtn = cardElement.querySelector('.view-detail-btn');
            const img = cardElement.querySelector('img');
            
            // 添加懒加载
            if (window.lazyImageLoader && img) {
                window.lazyImageLoader.addImage(img);
            }
            
            // 添加滚动显示动画
            if (window.scrollReveal) {
                window.scrollReveal.addElement(cardElement);
            }
            
            const showProductModal = (e) => {
                e.preventDefault();
                e.stopPropagation();
                openProductModal({
                    title: card.title,
                    description: card.description || '',
                    detailedDescription: card.detailedDescription || '',
                    image: imageSrc,
                    category: card.category || 'all'
                });
            };
            
            productImage.addEventListener('click', showProductModal);
            if (viewDetailBtn) {
                viewDetailBtn.addEventListener('click', showProductModal);
            }
            
            gridContainer.appendChild(cardElement);
            
            // 淡入动画
            const delay = index * 30;
            setTimeout(() => {
                requestAnimationFrame(() => {
                    cardElement.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
                    cardElement.style.opacity = '1';
                    cardElement.style.transform = 'scale(1)';
                });
            }, delay);
        });
        
        // 更新productCards引用
        productCards = gridContainer.querySelectorAll('.product-card');
    }
    
    // 更新URL参数
    function updateUrlParam(category) {
        // 检查是否是预览模式，如果是则保留 preview=true 参数
        const urlParams = new URLSearchParams(window.location.search);
        const isPreview = urlParams.get('preview') === 'true' || urlParams.get('preview') === '1';
        
        let newUrl;
        if (category === 'all') {
            newUrl = window.location.pathname;
        } else {
            newUrl = `${window.location.pathname}?category=${category}`;
        }
        
        // 如果是预览模式，保留 preview=true 参数
        if (isPreview) {
            newUrl += newUrl.includes('?') ? '&preview=true' : '?preview=true';
        }
        
        window.history.pushState({ category }, '', newUrl);
    }
    
    // 绑定筛选标签点击事件
    function bindFilterEvents() {
        // 重新获取筛选标签（可能被content.js动态更新）
        filterTabs = document.querySelectorAll('.filter-tab');
        if (!filterTabs || filterTabs.length === 0) return;
        
        filterTabs.forEach(tab => {
            // 移除可能存在的旧事件监听器
            const newTab = tab.cloneNode(true);
            tab.parentNode.replaceChild(newTab, tab);
            
            // 添加新的点击事件
            newTab.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                
                const category = this.getAttribute('data-category');
                if (category) {
                    applyFilter(category, true);
                }
            });
        });
        
        // 更新引用
        filterTabs = document.querySelectorAll('.filter-tab');
    }
    
    // 页面加载完成后初始化
    function onPageLoad() {
        // 等待所有脚本加载完成
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', function() {
                // 延迟初始化，确保所有DOM元素都已渲染
                setTimeout(initProductFilter, 300);
            });
        } else {
            // DOM已经加载完成，但可能脚本还在加载
            setTimeout(initProductFilter, 300);
        }
    }
    
    // 监听产品卡片加载完成事件
    window.addEventListener('productsLoaded', function() {
        // 重置初始化状态，允许重新初始化
        isInitialized = false;
        // 重新获取产品卡片引用
        productCards = document.querySelectorAll('.product-card');
        // 重新初始化筛选功能
        setTimeout(initProductFilter, 100);
    });
    
    // 启动
    onPageLoad();
    
    // 如果window.load事件触发，再次尝试初始化（作为备用）
    window.addEventListener('load', function() {
        if (!isInitialized) {
            setTimeout(initProductFilter, 100);
        }
    });
    
    // 根据产品信息生成详细描述
    function generateDetailedDescription(product) {
        const { title, description, detailedDescription, category, image } = product;
        
        // 优先使用内容管理中定制的详细描述
        if (detailedDescription && detailedDescription.trim().length > 0) {
            return detailedDescription.trim();
        }
        
        // 如果已有描述（超过20个字符），直接使用
        if (description && description.length > 20) {
            return description;
        }
        
        // 从标题和分类中提取信息
        let seriesName = '';
        let spaceType = '';
        let styleType = '';
        
        // 解析标题
        if (title) {
            const titleParts = title.split('-');
            if (titleParts.length > 0) {
                seriesName = titleParts[0].replace('系列', '').trim();
            }
            if (titleParts.length > 1) {
                spaceType = titleParts[1].trim();
            }
        }
        
        // 根据分类确定风格
        const categoryMap = {
            'classic': '经典',
            'modern': '现代',
            'luxury': '轻奢',
            'young': '现代年轻',
            'french': '法式顶奢',
            'oriental': '东方美学',
            'minimalist': '极简',
            'industrial': '工业',
            'scandinavian': '北欧'
        };
        styleType = categoryMap[category] || '精致';
        
        // 从图片路径提取空间信息
        let spaceFromImage = '';
        if (image) {
            const imagePath = image.toLowerCase();
            if (imagePath.includes('客厅') || imagePath.includes('living')) {
                spaceFromImage = '客厅';
            } else if (imagePath.includes('卧室') || imagePath.includes('bedroom')) {
                spaceFromImage = '卧室';
            } else if (imagePath.includes('厨房') || imagePath.includes('kitchen')) {
                spaceFromImage = '厨房';
            } else if (imagePath.includes('浴室') || imagePath.includes('bathroom')) {
                spaceFromImage = '浴室';
            } else if (imagePath.includes('书房') || imagePath.includes('study') || imagePath.includes('办公')) {
                spaceFromImage = '书房';
            } else if (imagePath.includes('楼梯') || imagePath.includes('stair')) {
                spaceFromImage = '楼梯';
            }
        }
        
        // 如果没有从标题获取空间类型，使用图片路径的信息
        if (!spaceType && spaceFromImage) {
            spaceType = spaceFromImage;
        }
        
        // 生成详细描述
        const descriptions = [];
        
        // 基础描述
        if (seriesName && spaceType) {
            descriptions.push(`${seriesName}系列专为${spaceType}空间精心设计，`);
        } else if (seriesName) {
            descriptions.push(`${seriesName}系列产品，`);
        }
        
        // 风格描述
        const styleDescriptions = {
            '经典': '传承经典设计理念，融合传统工艺与现代审美，展现永恒优雅的魅力。',
            '现代': '采用现代简约设计风格，线条流畅，色彩和谐，营造时尚舒适的居住环境。',
            '轻奢': '追求精致与品质的完美结合，细节考究，材质上乘，彰显低调奢华的生活品味。',
            '现代年轻': '充满活力与创意，色彩明快，设计新颖，适合年轻一代的审美需求。',
            '法式顶奢': '汲取法式浪漫与优雅精髓，工艺精湛，装饰精美，打造顶级奢华空间。',
            '东方美学': '融合东方传统美学与现代设计，简约中见雅致，宁静与实用并存。',
            '极简': '追求极致的简约美学，去除多余装饰，回归本质，营造宁静致远的空间氛围。',
            '工业': '采用工业风格设计，粗犷中见细腻，展现独特的现代工业美学。',
            '北欧': '秉承北欧设计理念，自然简约，功能实用，营造温馨舒适的居住体验。'
        };
        
        const styleDesc = styleDescriptions[styleType] || '精心设计，注重细节，追求品质与美感的完美统一。';
        descriptions.push(styleDesc);
        
        // 空间特色描述
        if (spaceType) {
            const spaceFeatures = {
                '客厅': '宽敞明亮的客厅空间，适合家庭聚会与休闲娱乐，营造温馨和谐的家庭氛围。',
                '卧室': '私密舒适的卧室环境，注重休息与放松，打造宁静安逸的睡眠空间。',
                '厨房': '功能齐全的厨房设计，操作便捷，收纳有序，让烹饪成为一种享受。',
                '浴室': '精致优雅的浴室空间，注重舒适与美观，提供放松身心的洗浴体验。',
                '书房': '安静雅致的书房环境，适合阅读与工作，营造专注高效的学习氛围。',
                '楼梯': '精致美观的楼梯设计，不仅是连接空间的通道，更是家中的艺术装饰。'
            };
            
            const spaceFeature = spaceFeatures[spaceType];
            if (spaceFeature) {
                descriptions.push(spaceFeature);
            }
        }
        
        // 材质与工艺描述
        descriptions.push('采用优质木材，经过精细加工与严格质检，确保每一件产品都达到高品质标准。');
        
        // 组合最终描述
        let finalDescription = descriptions.join(' ');
        
        // 如果原始描述存在但较短，作为补充
        if (description && description.length > 0 && description.length <= 20) {
            finalDescription = `${description}。${finalDescription}`;
        }
        
        return finalDescription;
    }
    
    // 产品详情模态框（支持单图或多图）
    function openProductModal(product) {
        console.log('openProductModal 被调用', product);
        
        // 参数验证
        if (!product) {
            console.error('openProductModal: product 参数为空');
            return;
        }
        
        // 生成详细描述
        const detailedDescription = product.detailedDescription || product.description || generateDetailedDescription(product);
        
        // 处理图片：支持单图或多图数组
        let images = [];
        if (product.images && Array.isArray(product.images) && product.images.length > 0) {
            // 多图模式
            images = product.images;
            console.log('使用多图模式，图片数量:', images.length);
        } else if (product.image) {
            // 单图模式
            images = [product.image];
            console.log('使用单图模式');
        } else {
            console.warn('openProductModal: 没有找到图片', product);
            images = [];
        }
        
        // 处理图片路径
        images = images.map(img => {
            if (!img) return '';
            if (typeof img !== 'string') return '';
            if (img.startsWith('http://') || img.startsWith('https://') || img.startsWith('/')) {
                return img;
            }
            if (!img.includes('images/') && !img.includes('uploads/')) {
                return 'images/' + img;
            }
            return img;
        }).filter(img => img && img.trim());
        
        console.log('处理后的图片数组:', images);
        
        if (images.length === 0) {
            console.warn('openProductModal: 处理后没有有效图片');
            return; // 没有图片，不显示模态框
        }
        
        const isMultiImage = images.length > 1;
        const currentImageIndex = 0;
        
        // 创建模态框
        const modal = document.createElement('div');
        modal.className = 'product-modal';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.setAttribute('aria-labelledby', 'product-modal-title');
        
        // 构建图片切换控件
        let imageControls = '';
        if (isMultiImage) {
            imageControls = `
                <button class="image-nav-btn image-nav-prev" aria-label="上一张" type="button">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="15 18 9 12 15 6"></polyline>
                    </svg>
                </button>
                <button class="image-nav-btn image-nav-next" aria-label="下一张" type="button">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="9 18 15 12 9 6"></polyline>
                    </svg>
                </button>
                <div class="image-counter">
                    <span class="current-index">1</span> / <span class="total-count">${images.length}</span>
                </div>
                <div class="image-thumbnails">
                    ${images.map((img, index) => `
                        <div class="thumbnail-item ${index === 0 ? 'active' : ''}" data-index="${index}">
                            <img src="${img}" alt="缩略图 ${index + 1}">
                        </div>
                    `).join('')}
                </div>
            `;
        }
        
        modal.innerHTML = `
            <div class="product-modal-overlay"></div>
            <div class="product-modal-container">
                <button class="product-modal-close" aria-label="关闭" type="button">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
                <div class="product-modal-content">
                    <div class="product-modal-image-wrapper">
                        ${imageControls}
                        <div class="product-modal-image-container">
                            ${images.map((img, index) => `
                                <img src="${img}" alt="${product.title} - 图片 ${index + 1}" 
                                     class="product-modal-image ${index === 0 ? 'active' : ''}" 
                                     data-index="${index}">
                            `).join('')}
                        </div>
                        <div class="product-modal-image-loading">加载中...</div>
                    </div>
                    <div class="product-modal-info">
                        <h2 id="product-modal-title" class="product-modal-title">${product.title}</h2>
                        <div class="product-modal-description">
                            <p>${detailedDescription}</p>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // 添加模态框到页面
        try {
            console.log('准备添加模态框到页面');
            // 先设置样式确保可见
            modal.style.display = 'flex';
            modal.style.opacity = '1';
            modal.style.visibility = 'visible';
            
            document.body.appendChild(modal);
            console.log('模态框已添加到页面');
            
            document.body.style.overflow = 'hidden'; // 禁止背景滚动
            
            // 强制重绘
            void modal.offsetHeight;
            
            // 验证模态框是否真的在DOM中
            const modalInDom = document.querySelector('.product-modal');
            if (!modalInDom) {
                console.error('模态框未成功添加到DOM');
                document.body.style.overflow = '';
                return;
            }
            console.log('模态框验证成功，已在DOM中');
            
            // 检查模态框的实际样式
            const computedStyle = window.getComputedStyle(modal);
            console.log('模态框样式检查:', {
                display: computedStyle.display,
                opacity: computedStyle.opacity,
                visibility: computedStyle.visibility,
                zIndex: computedStyle.zIndex,
                position: computedStyle.position,
                width: computedStyle.width,
                height: computedStyle.height,
                top: computedStyle.top,
                left: computedStyle.left
            });
            
            // 检查模态框容器
            const container = modal.querySelector('.product-modal-container');
            if (container) {
                const containerStyle = window.getComputedStyle(container);
                console.log('模态框容器样式:', {
                    display: containerStyle.display,
                    opacity: containerStyle.opacity,
                    visibility: containerStyle.visibility,
                    width: containerStyle.width,
                    height: containerStyle.height,
                    backgroundColor: containerStyle.backgroundColor
                });
            } else {
                console.error('未找到模态框容器');
            }
            
            // 检查overlay
            const overlay = modal.querySelector('.product-modal-overlay');
            if (overlay) {
                const overlayStyle = window.getComputedStyle(overlay);
                console.log('模态框遮罩样式:', {
                    display: overlayStyle.display,
                    opacity: overlayStyle.opacity,
                    backgroundColor: overlayStyle.backgroundColor,
                    position: overlayStyle.position
                });
            } else {
                console.error('未找到模态框遮罩');
            }
        } catch (error) {
            console.error('添加模态框失败:', error);
            document.body.style.overflow = ''; // 恢复滚动
            return;
        }
        
        // 多图切换逻辑
        let currentIndex = 0;
        const modalImages = modal.querySelectorAll('.product-modal-image');
        const loadingIndicator = modal.querySelector('.product-modal-image-loading');
        const prevBtn = modal.querySelector('.image-nav-prev');
        const nextBtn = modal.querySelector('.image-nav-next');
        const currentIndexSpan = modal.querySelector('.current-index');
        const thumbnailItems = modal.querySelectorAll('.thumbnail-item');
        
        // 显示指定索引的图片
        function showImage(index) {
            if (index < 0 || index >= images.length) return;
            
            currentIndex = index;
            
            // 更新图片显示
            modalImages.forEach((img, i) => {
                if (i === index) {
                    img.classList.add('active');
                    img.style.opacity = '1';
                } else {
                    img.classList.remove('active');
                    img.style.opacity = '0';
                }
            });
            
            // 更新缩略图
            thumbnailItems.forEach((thumb, i) => {
                if (i === index) {
                    thumb.classList.add('active');
                } else {
                    thumb.classList.remove('active');
                }
            });
            
            // 更新计数器
            if (currentIndexSpan) {
                currentIndexSpan.textContent = index + 1;
            }
            
            // 更新按钮状态
            if (prevBtn) prevBtn.style.opacity = index === 0 ? '0.5' : '1';
            if (nextBtn) nextBtn.style.opacity = index === images.length - 1 ? '0.5' : '1';
        }
        
        // 上一张/下一张
        if (prevBtn) {
            prevBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (currentIndex > 0) {
                    showImage(currentIndex - 1);
                }
            });
        }
        
        if (nextBtn) {
            nextBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (currentIndex < images.length - 1) {
                    showImage(currentIndex + 1);
                }
            });
        }
        
        // 缩略图点击
        thumbnailItems.forEach((thumb, index) => {
            thumb.addEventListener('click', (e) => {
                e.stopPropagation();
                showImage(index);
            });
        });
        
        // 键盘导航
        const handleKeyDown = (e) => {
            if (e.key === 'ArrowLeft' && currentIndex > 0) {
                showImage(currentIndex - 1);
            } else if (e.key === 'ArrowRight' && currentIndex < images.length - 1) {
                showImage(currentIndex + 1);
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        
        // 图片加载处理
        let loadedCount = 0;
        modalImages.forEach((img, index) => {
            img.onload = () => {
                loadedCount++;
                if (loadedCount === 1) {
                    loadingIndicator.style.display = 'none';
                }
                if (index === 0) {
                    img.style.opacity = '1';
                }
            };
            
            img.onerror = () => {
                loadedCount++;
                if (loadedCount === 1) {
                    loadingIndicator.textContent = '图片加载失败';
                    loadingIndicator.style.color = '#ff4444';
                }
            };
            
            // 如果图片已经缓存
            if (img.complete && img.naturalWidth > 0) {
                loadedCount++;
                if (loadedCount === 1) {
                    loadingIndicator.style.display = 'none';
                }
                if (index === 0) {
                    img.style.opacity = '1';
                }
            }
        });
        
        // 初始化显示第一张
        if (modalImages.length > 0) {
            showImage(0);
        }
        
        // 关闭按钮事件
        const closeBtn = modal.querySelector('.product-modal-close');
        const overlay = modal.querySelector('.product-modal-overlay');
        
        const closeModal = () => {
            try {
                modal.style.opacity = '0';
                modal.style.visibility = 'hidden';
                setTimeout(() => {
                    if (document.body.contains(modal)) {
                        document.body.removeChild(modal);
                    }
                    document.body.style.overflow = '';
                    if (handleKeyDown) {
                        document.removeEventListener('keydown', handleKeyDown);
                    }
                }, 300);
            } catch (error) {
                console.error('关闭模态框失败:', error);
                // 强制移除
                if (document.body.contains(modal)) {
                    document.body.removeChild(modal);
                }
                document.body.style.overflow = '';
            }
        };
        
        if (closeBtn) {
            closeBtn.addEventListener('click', closeModal);
        }
        if (overlay) {
            overlay.addEventListener('click', closeModal);
        }
        
        // ESC键关闭
        const handleEsc = (e) => {
            if (e.key === 'Escape') {
                closeModal();
                document.removeEventListener('keydown', handleEsc);
            }
        };
        document.addEventListener('keydown', handleEsc);
    }
    
    // 将函数暴露到全局，供content.js使用
    window.openProductModal = openProductModal;
})();
