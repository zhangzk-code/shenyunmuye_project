// 案例页面图片弹框功能（支持多图、标题和描述）
(function() {
    'use strict';

    // 打开案例模态框
    function openCaseModal(caseData) {
        console.log('openCaseModal 被调用', caseData);
        
        // 参数验证
        if (!caseData) {
            console.error('openCaseModal: caseData 参数为空');
            return;
        }

        // 处理图片：优先使用 images 数组（弹框中显示的多张图片）
        // 如果 images 不存在或为空，则使用 image（主图）
        let images = [];
        if (caseData.images && Array.isArray(caseData.images) && caseData.images.length > 0) {
            // 多图模式：使用 images 数组
            images = caseData.images;
        } else if (caseData.image) {
            // 单图模式：使用 image（主图）
            images = [caseData.image];
        } else {
            console.warn('openCaseModal: 没有找到图片', caseData);
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


        if (images.length === 0) {
            console.warn('openCaseModal: 处理后没有有效图片');
            return; // 没有图片，不显示模态框
        }

        const isMultiImage = images.length > 1;
        const title = caseData.title || '案例详情';
        const description = caseData.description || '';

        // 如果已经存在模态框，先移除
        const existingModal = document.querySelector('.product-modal');
        if (existingModal) {
            document.body.removeChild(existingModal);
        }

        // 创建模态框（使用与 products 相同的类名以复用样式）
        const modal = document.createElement('div');
        modal.className = 'product-modal';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.setAttribute('aria-labelledby', 'product-modal-title');

        // 构建图片切换控件（导航按钮和计数器）
        let imageControls = '';
        let thumbnailsHtml = '';
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
            `;
            // 缩略图单独放在图片下方
            thumbnailsHtml = `
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
                                <img src="${img}" alt="${title} - 图片 ${index + 1}" 
                                     class="product-modal-image ${index === 0 ? 'active' : ''}" 
                                     data-index="${index}">
                            `).join('')}
                        </div>
                        <div class="product-modal-image-loading">加载中...</div>
                    </div>
                    ${thumbnailsHtml}
                    <div class="product-modal-info">
                        <h2 id="product-modal-title" class="product-modal-title">${title}</h2>
                        <div class="product-modal-description">
                            <p>${description}</p>
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
        } catch (error) {
            console.error('添加模态框失败:', error);
            document.body.style.overflow = '';
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

        // 移动端触摸滑动功能
        if (isMultiImage) {
            const imageWrapper = modal.querySelector('.product-modal-image-wrapper');
            let touchStartX = 0;
            let touchEndX = 0;
            let isSwiping = false;

            const handleTouchStart = (e) => {
                touchStartX = e.touches[0].clientX;
                isSwiping = true;
            };

            const handleTouchMove = (e) => {
                if (!isSwiping) return;
                touchEndX = e.touches[0].clientX;
            };

            const handleTouchEnd = () => {
                if (!isSwiping) return;
                isSwiping = false;

                const swipeThreshold = 50; // 滑动阈值（像素）
                const diff = touchStartX - touchEndX;

                if (Math.abs(diff) > swipeThreshold) {
                    if (diff > 0 && currentIndex < images.length - 1) {
                        // 向左滑动，显示下一张
                        showImage(currentIndex + 1);
                    } else if (diff < 0 && currentIndex > 0) {
                        // 向右滑动，显示上一张
                        showImage(currentIndex - 1);
                    }
                }

                touchStartX = 0;
                touchEndX = 0;
            };

            if (imageWrapper) {
                imageWrapper.addEventListener('touchstart', handleTouchStart, { passive: true });
                imageWrapper.addEventListener('touchmove', handleTouchMove, { passive: true });
                imageWrapper.addEventListener('touchend', handleTouchEnd, { passive: true });
            }
        }

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
                if (handleKeyDown) {
                    document.removeEventListener('keydown', handleKeyDown);
                }
            }
        };
        document.addEventListener('keydown', handleEsc);
    }

    // 为单个案例项添加点击事件
    function addCaseClickHandler(caseElement) {
        // 如果已经添加过事件，跳过
        if (caseElement.dataset.clickHandlerAdded === 'true') {
            return;
        }

        caseElement.style.cursor = 'pointer';
        caseElement.dataset.clickHandlerAdded = 'true';

        const clickHandler = function(e) {
            e.preventDefault();
            e.stopPropagation();

            // 获取案例数据
            const title = this.getAttribute('data-case-title') || this.dataset.caseTitle || '';
            const description = this.getAttribute('data-case-description') || this.dataset.caseDescription || '';
            let images = [];

            // 解析图片数组 - 优先使用 getAttribute，因为它能保留原始格式
            let imagesAttr = this.getAttribute('data-case-images');
            // 如果 getAttribute 返回 null，尝试使用 dataset（会自动转换 kebab-case 到 camelCase）
            if (!imagesAttr && this.dataset.caseImages) {
                imagesAttr = this.dataset.caseImages;
            }


            if (imagesAttr && typeof imagesAttr === 'string' && imagesAttr.trim()) {
                try {
                    // 清理可能的空白字符
                    let cleanedAttr = imagesAttr.trim();
                    
                    // 处理可能的 HTML 实体编码（如 &quot; 转换为 "）
                    if (cleanedAttr.includes('&quot;')) {
                        cleanedAttr = cleanedAttr.replace(/&quot;/g, '"');
                    }
                    if (cleanedAttr.includes('&#39;')) {
                        cleanedAttr = cleanedAttr.replace(/&#39;/g, "'");
                    }
                    if (cleanedAttr.includes('&apos;')) {
                        cleanedAttr = cleanedAttr.replace(/&apos;/g, "'");
                    }
                    
                    // 验证是否为有效的 JSON 字符串（至少包含 [ 和 ]）
                    if (cleanedAttr.length > 2 && cleanedAttr.startsWith('[') && cleanedAttr.endsWith(']')) {
                        const parsed = JSON.parse(cleanedAttr);
                        // 验证解析结果是否为数组
                        if (Array.isArray(parsed)) {
                            // 过滤掉空值和非字符串值
                            images = parsed.filter(img => img && typeof img === 'string' && img.trim());
                        } else {
                            throw new Error('解析结果不是数组');
                        }
                    } else {
                        throw new Error('不是有效的 JSON 数组格式');
                    }
                } catch (e) {
                    console.warn('解析图片数组失败，使用备用方案:', e.message, '原始值:', imagesAttr);
                    // 如果解析失败，清空数组，稍后从 img 标签获取
                    images = [];
                }
            }
            
            // 如果图片数组为空，从 img 标签获取
            if (!images || images.length === 0) {
                const img = this.querySelector('img');
                if (img) {
                    const imgSrc = img.src || img.getAttribute('src') || img.getAttribute('data-src');
                    if (imgSrc && imgSrc.trim()) {
                        images = [imgSrc.trim()];
                    }
                }
            }

            // 如果没有标题，尝试从标签中获取
            let finalTitle = title;
            if (!finalTitle) {
                const label = this.querySelector('.case-label, .case-label-large h3, .case-info h3');
                if (label) {
                    finalTitle = label.textContent.trim();
                }
            }

            // 如果没有描述，尝试从标签中获取
            let finalDescription = description;
            if (!finalDescription) {
                const desc = this.querySelector('.case-label-large p, .case-info p');
                if (desc) {
                    finalDescription = desc.textContent.trim();
                }
            }

            // 确保 images 是数组且不为空
            if (Array.isArray(images) && images.length > 0) {
                // 获取主图（用于备用，但优先使用 images 数组）
                const img = this.querySelector('img');
                const mainImage = img ? (img.src || img.getAttribute('src') || img.getAttribute('data-src')) : '';
                
                openCaseModal({
                    title: finalTitle,
                    description: finalDescription,
                    image: mainImage, // 主图（页面显示的）
                    images: images    // 弹框中显示的多张图片数组
                });
            } else {
                console.warn('无法获取案例图片，案例:', finalTitle || '未知');
            }
        };

        caseElement.addEventListener('click', clickHandler);
    }

    // 初始化：为所有案例添加点击事件
    function initCaseImageClick() {
        // 选择所有案例项
        const caseItems = document.querySelectorAll('.case-item-small, .case-item-large, .case-card');

        caseItems.forEach((item) => {
            addCaseClickHandler(item);
        });

        // 使用 MutationObserver 监听动态添加的案例
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === 1) { // Element node
                        // 检查新添加的节点是否是案例项
                        if (node.classList && (node.classList.contains('case-item-small') || 
                            node.classList.contains('case-item-large') || 
                            node.classList.contains('case-card'))) {
                            addCaseClickHandler(node);
                        }
                        // 检查新添加的节点内是否包含案例项
                        const caseItems = node.querySelectorAll && node.querySelectorAll('.case-item-small, .case-item-large, .case-card');
                        if (caseItems) {
                            caseItems.forEach((item) => {
                                addCaseClickHandler(item);
                            });
                        }
                    }
                });
            });
        });

        // 开始观察
        const casesSection = document.querySelector('.cases-section');
        if (casesSection) {
            observer.observe(casesSection, {
                childList: true,
                subtree: true
            });
        }

        console.log(`已为 ${caseItems.length} 个案例添加点击事件`);
    }

    // 导出函数供外部调用
    window.openCaseModal = openCaseModal;

    // 自动初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initCaseImageClick);
    } else {
        // DOM 已经加载完成，直接初始化
        initCaseImageClick();
    }

    // 如果页面是动态加载内容，可以重新调用 initCaseImageClick
    window.initCaseImageClick = initCaseImageClick;
})();
