/**
 * 图片懒加载和骨架屏模块
 * 支持滚动加载和图片加载状态管理
 */

(() => {
    'use strict';

    // 骨架屏HTML模板
    function createSkeleton(className = 'skeleton-image') {
        const skeleton = document.createElement('div');
        skeleton.className = className;
        skeleton.innerHTML = `
            <div class="skeleton-shimmer"></div>
        `;
        return skeleton;
    }

    // 图片懒加载类
    class LazyImageLoader {
        constructor(options = {}) {
            this.options = {
                root: null,
                rootMargin: '200px', // 提前200px开始加载（优化：增加预加载距离）
                threshold: 0.01,
                skeletonClass: 'skeleton-image',
                fadeInDuration: 300,
                // 新增：图片加载超时时间
                timeout: 10000,
                // 新增：重试次数
                retryCount: 2,
                ...options
            };
            
            this.observer = null;
            this.images = new Set();
            this.init();
        }

        init() {
            // 检查浏览器是否支持 Intersection Observer
            if ('IntersectionObserver' in window) {
                this.observer = new IntersectionObserver(
                    this.handleIntersection.bind(this),
                    {
                        root: this.options.root,
                        rootMargin: this.options.rootMargin,
                        threshold: this.options.threshold
                    }
                );
            } else {
                // 降级方案：直接加载所有图片
                this.loadAllImages();
            }
        }

        handleIntersection(entries) {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const imgElement = entry.target;
                    this.loadImage(imgElement);
                    if (this.observer) {
                        this.observer.unobserve(imgElement);
                    }
                }
            });
        }

        loadImage(imgElement, retryCount = 0) {
            // 如果图片已经在加载或已加载完成，跳过
            if (imgElement.dataset.loaded === 'true' || imgElement.dataset.loading === 'true') {
                return;
            }

            imgElement.dataset.loading = 'true';
            
            // 获取真实图片路径
            let realSrc = imgElement.dataset.src || imgElement.getAttribute('data-lazy-src') || imgElement.src;
            
            if (!realSrc || realSrc === '') {
                return;
            }

            // 优化：添加图片尺寸参数（如果后端支持）
            // 根据容器大小优化图片尺寸
            const container = imgElement.parentElement;
            if (container) {
                const containerWidth = container.offsetWidth || window.innerWidth;
                // 如果容器宽度小于屏幕宽度，使用容器宽度
                // 这里可以添加图片尺寸优化逻辑
            }

            // 创建图片对象预加载
            const img = new Image();
            
            // 优化：设置超时
            let timeoutId = null;
            if (this.options.timeout > 0) {
                timeoutId = setTimeout(() => {
                    if (!img.complete) {
                        img.onerror();
                    }
                }, this.options.timeout);
            }
            
            img.onload = () => {
                if (timeoutId) clearTimeout(timeoutId);
                
                // 图片加载成功
                imgElement.dataset.loaded = 'true';
                imgElement.dataset.loading = 'false';
                
                // 淡入效果
                imgElement.style.opacity = '0';
                imgElement.style.transition = `opacity ${this.options.fadeInDuration}ms ease-in-out`;
                
                // 设置真实图片源
                if (imgElement.tagName === 'IMG') {
                    imgElement.src = realSrc;
                } else {
                    // 如果是背景图片
                    imgElement.style.backgroundImage = `url(${realSrc})`;
                }
                
                // 移除骨架屏
                const skeleton = imgElement.parentElement?.querySelector(`.${this.options.skeletonClass}`);
                if (skeleton) {
                    setTimeout(() => {
                        skeleton.style.opacity = '0';
                        skeleton.style.transition = 'opacity 200ms ease-out';
                        setTimeout(() => {
                            if (skeleton.parentElement) {
                                skeleton.remove();
                            }
                        }, 200);
                    }, 50);
                }
                
                // 触发淡入动画
                requestAnimationFrame(() => {
                    imgElement.style.opacity = '1';
                });
                
                // 触发加载完成事件
                imgElement.dispatchEvent(new CustomEvent('lazyloaded', {
                    detail: { image: imgElement }
                }));
            };
            
            img.onerror = () => {
                if (timeoutId) clearTimeout(timeoutId);
                
                // 重试机制
                if (retryCount < this.options.retryCount) {
                    imgElement.dataset.loading = 'false';
                    // 延迟重试
                    setTimeout(() => {
                        this.loadImage(imgElement, retryCount + 1);
                    }, 1000 * (retryCount + 1));
                    return;
                }
                
                // 图片加载失败
                imgElement.dataset.loading = 'false';
                imgElement.dataset.error = 'true';
                
                // 移除骨架屏，显示错误提示
                const skeleton = imgElement.parentElement?.querySelector(`.${this.options.skeletonClass}`);
                if (skeleton) {
                    skeleton.innerHTML = '<div class="skeleton-error">图片加载失败</div>';
                    skeleton.style.background = '#f5f5f5';
                }
                
                // 触发加载失败事件
                imgElement.dispatchEvent(new CustomEvent('lazyloaderror', {
                    detail: { image: imgElement }
                }));
            };
            
            // 开始加载图片
            img.src = realSrc;
        }

        // 添加图片到观察列表
        addImage(imgElement, showSkeleton = true) {
            if (!imgElement) return;
            
            // 如果图片已经加载，直接显示
            if (imgElement.complete && imgElement.naturalWidth > 0) {
                imgElement.dataset.loaded = 'true';
                return;
            }
            
            // 保存原始src
            const originalSrc = imgElement.src || imgElement.getAttribute('data-src');
            if (originalSrc && originalSrc !== '') {
                imgElement.dataset.src = originalSrc;
                
                // 如果是IMG标签，先设置为空或占位图
                if (imgElement.tagName === 'IMG') {
                    imgElement.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="1" height="1"%3E%3C/svg%3E';
                }
            }
            
            // 添加骨架屏
            if (showSkeleton) {
                const container = imgElement.parentElement;
                if (container) {
                    const skeleton = createSkeleton(this.options.skeletonClass);
                    container.insertBefore(skeleton, imgElement);
                    
                    // 确保容器有相对定位
                    if (getComputedStyle(container).position === 'static') {
                        container.style.position = 'relative';
                    }
                }
            }
            
            // 添加到观察列表
            this.images.add(imgElement);
            
            if (this.observer) {
                this.observer.observe(imgElement);
            } else {
                // 降级方案：直接加载
                this.loadImage(imgElement);
            }
        }

        // 批量添加图片
        addImages(selector, container = document) {
            const images = container.querySelectorAll(selector);
            images.forEach(img => this.addImage(img));
        }

        // 降级方案：加载所有图片
        loadAllImages() {
            this.images.forEach(img => this.loadImage(img));
        }

        // 销毁观察器
        destroy() {
            if (this.observer) {
                this.observer.disconnect();
                this.observer = null;
            }
            this.images.clear();
        }
    }

    // 滚动动画类
    class ScrollReveal {
        constructor(options = {}) {
            this.options = {
                root: null,
                rootMargin: '0px',
                threshold: 0.1,
                animationClass: 'fade-in-up',
                ...options
            };
            
            this.observer = null;
            this.elements = new Set();
            this.init();
        }

        init() {
            if ('IntersectionObserver' in window) {
                this.observer = new IntersectionObserver(
                    this.handleIntersection.bind(this),
                    {
                        root: this.options.root,
                        rootMargin: this.options.rootMargin,
                        threshold: this.options.threshold
                    }
                );
            }
        }

        handleIntersection(entries) {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const element = entry.target;
                    element.classList.add(this.options.animationClass);
                    element.classList.add('revealed');
                    
                    if (this.observer) {
                        this.observer.unobserve(element);
                    }
                }
            });
        }

        addElement(element) {
            if (!element) return;
            
            element.classList.add('scroll-reveal');
            this.elements.add(element);
            
            if (this.observer) {
                this.observer.observe(element);
            } else {
                // 降级方案：直接显示
                element.classList.add(this.options.animationClass);
                element.classList.add('revealed');
            }
        }

        addElements(selector, container = document) {
            const elements = container.querySelectorAll(selector);
            elements.forEach(el => this.addElement(el));
        }

        destroy() {
            if (this.observer) {
                this.observer.disconnect();
                this.observer = null;
            }
            this.elements.clear();
        }
    }

    // 全局实例
    window.lazyImageLoader = new LazyImageLoader();
    window.scrollReveal = new ScrollReveal();

    // 自动初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            initLazyLoad();
        });
    } else {
        initLazyLoad();
    }

    function initLazyLoad() {
        // 优化：优先加载首屏图片
        const viewportHeight = window.innerHeight;
        const allImages = document.querySelectorAll('img[data-src], img[data-lazy-src], img[src]');
        
        // 分离首屏和后续图片
        const aboveFoldImages = [];
        const belowFoldImages = [];
        
        allImages.forEach(img => {
            const rect = img.getBoundingClientRect();
            if (rect.top < viewportHeight + 200) {
                // 首屏或接近首屏的图片
                aboveFoldImages.push(img);
            } else {
                belowFoldImages.push(img);
            }
        });
        
        // 优先加载首屏图片
        aboveFoldImages.forEach(img => {
            if (img.hasAttribute('data-src') || img.hasAttribute('data-lazy-src')) {
                img.setAttribute('fetchpriority', 'high');
                window.lazyImageLoader.addImage(img, true);
            }
        });
        
        // 延迟加载后续图片
        setTimeout(() => {
            belowFoldImages.forEach(img => {
                if (img.hasAttribute('data-src') || img.hasAttribute('data-lazy-src')) {
                    window.lazyImageLoader.addImage(img, true);
                }
            });
        }, 100);
        
        // 为所有需要滚动显示的元素添加动画
        window.scrollReveal.addElements('.gallery-item, .case-card, .product-card, .case-item-small, .case-item-large');
    }

    // 导出API
    window.LazyImageLoader = LazyImageLoader;
    window.ScrollReveal = ScrollReveal;
})();

