/**
 * 图片优化工具
 * 提供图片压缩、格式转换、响应式图片等功能
 */

(() => {
    'use strict';

    /**
     * 图片优化配置
     */
    const IMAGE_CONFIG = {
        // 不同设备的图片尺寸
        sizes: {
            mobile: 480,
            tablet: 768,
            desktop: 1200,
            large: 1920
        },
        // 图片质量（0-100）
        quality: {
            thumbnail: 60,
            normal: 75,
            high: 85
        },
        // 支持的格式
        formats: ['webp', 'jpg', 'png'],
        // 默认格式
        defaultFormat: 'jpg'
    };

    /**
     * 检测浏览器是否支持WebP
     */
    function supportsWebP() {
        if (window.webpSupport !== undefined) {
            return window.webpSupport;
        }
        
        const canvas = document.createElement('canvas');
        canvas.width = 1;
        canvas.height = 1;
        const ctx = canvas.getContext('2d');
        const dataURI = canvas.toDataURL('image/webp');
        window.webpSupport = dataURI.indexOf('data:image/webp') === 0;
        return window.webpSupport;
    }

    /**
     * 获取最优图片格式
     */
    function getOptimalFormat() {
        if (supportsWebP()) {
            return 'webp';
        }
        return 'jpg';
    }

    /**
     * 生成响应式图片URL
     * @param {string} originalUrl - 原始图片URL
     * @param {number} width - 目标宽度
     * @param {number} quality - 质量（0-100）
     * @returns {string} 优化后的图片URL
     */
    function getOptimizedImageUrl(originalUrl, width, quality = 75) {
        if (!originalUrl) return '';
        
        // 如果是外部URL或已经是优化后的URL，直接返回
        if (originalUrl.startsWith('http://') || originalUrl.startsWith('https://')) {
            return originalUrl;
        }
        
        // 如果是相对路径，添加基础路径
        let url = originalUrl;
        if (!url.startsWith('/') && !url.startsWith('./')) {
            url = '/' + url;
        }
        
        // 注意：这里假设后端有图片处理服务
        // 如果没有，可以返回原始URL，或者使用客户端压缩
        // 实际项目中，建议使用CDN或图片处理服务（如七牛云、阿里云OSS等）
        
        return url;
    }

    /**
     * 根据设备类型获取合适的图片尺寸
     */
    function getOptimalSize() {
        const width = window.innerWidth;
        if (width <= IMAGE_CONFIG.sizes.mobile) {
            return IMAGE_CONFIG.sizes.mobile;
        } else if (width <= IMAGE_CONFIG.sizes.tablet) {
            return IMAGE_CONFIG.sizes.tablet;
        } else if (width <= IMAGE_CONFIG.sizes.desktop) {
            return IMAGE_CONFIG.sizes.desktop;
        } else {
            return IMAGE_CONFIG.sizes.large;
        }
    }

    /**
     * 预加载关键图片
     * @param {Array<string>} imageUrls - 图片URL数组
     */
    function preloadImages(imageUrls) {
        if (!Array.isArray(imageUrls) || imageUrls.length === 0) return;
        
        imageUrls.forEach(url => {
            if (!url) return;
            
            const link = document.createElement('link');
            link.rel = 'preload';
            link.as = 'image';
            link.href = url;
            document.head.appendChild(link);
        });
    }

    /**
     * 创建响应式图片元素
     * @param {string} src - 图片源
     * @param {string} alt - 替代文本
     * @param {Object} options - 选项
     */
    function createResponsiveImage(src, alt = '', options = {}) {
        const {
            sizes = '(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw',
            loading = 'lazy',
            fetchpriority = 'auto'
        } = options;
        
        const img = document.createElement('img');
        img.src = src;
        img.alt = alt;
        img.loading = loading;
        img.fetchpriority = fetchpriority;
        img.sizes = sizes;
        
        // 添加data-src用于懒加载
        img.setAttribute('data-src', src);
        
        return img;
    }

    /**
     * 优化图片加载顺序
     * 优先加载首屏可见的图片
     */
    function prioritizeImages() {
        // 获取首屏可见的图片
        const viewportHeight = window.innerHeight;
        const images = document.querySelectorAll('img[data-src]');
        
        images.forEach((img, index) => {
            const rect = img.getBoundingClientRect();
            const isAboveFold = rect.top < viewportHeight;
            
            if (isAboveFold) {
                // 首屏图片优先加载
                img.setAttribute('fetchpriority', 'high');
                if (window.lazyImageLoader) {
                    window.lazyImageLoader.addImage(img, true);
                }
            }
        });
    }

    /**
     * 图片加载性能监控
     */
    function monitorImagePerformance() {
        if (!('PerformanceObserver' in window)) return;
        
        try {
            const observer = new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) {
                    if (entry.initiatorType === 'img') {
                        const loadTime = entry.responseEnd - entry.startTime;
                        
                        // 如果加载时间超过3秒，记录警告
                        if (loadTime > 3000) {
                            console.warn(`图片加载缓慢: ${entry.name}, 耗时: ${loadTime.toFixed(2)}ms`);
                        }
                    }
                }
            });
            
            observer.observe({ entryTypes: ['resource'] });
        } catch (e) {
            // 不支持PerformanceObserver，忽略
        }
    }

    // 初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            prioritizeImages();
            monitorImagePerformance();
        });
    } else {
        prioritizeImages();
        monitorImagePerformance();
    }

    // 导出API
    window.imageOptimizer = {
        supportsWebP,
        getOptimalFormat,
        getOptimizedImageUrl,
        getOptimalSize,
        preloadImages,
        createResponsiveImage,
        prioritizeImages,
        monitorImagePerformance
    };
})();

