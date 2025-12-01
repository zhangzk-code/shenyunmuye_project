/**
 * 预览窗口管理器
 */
import { getDeviceById, getAllDevices, createCustomDevice } from './device-selector.js';
import { SyncManager } from './sync-manager.js';
import { api } from '../utils/api.js';

export class PreviewManager {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.previewIframe = null;
        this.currentDevice = getDeviceById('iphone-se');
        this.syncManager = null;
        this.isVisible = false;
        this.isFullscreen = false;
        this.isDragging = false;
        this.dragStartX = 0;
        this.dragStartY = 0;
        this.dragStartLeft = 0;
        this.dragStartTop = 0;
        
        this.init();
    }

    /**
     * 初始化
     */
    init() {
        this.createPreviewContainer();
        this.createPreviewControls();
        this.createDeviceSelector();
        this.syncManager = new SyncManager(this.previewIframe?.contentWindow);
        
        // 监听预览窗口消息
        window.addEventListener('message', this.handlePreviewMessage.bind(this));
        
        // 监听窗口大小变化，自动调整预览尺寸
        this.resizeObserver = new ResizeObserver(() => {
            if (this.isVisible && this.previewIframe) {
                this.updateIframeSize();
            }
        });
        
        // 观察预览容器的大小变化
        if (this.container) {
            this.resizeObserver.observe(this.container);
        }
    }

    /**
     * 创建预览容器
     */
    createPreviewContainer() {
        if (!this.container) return;

        this.container.innerHTML = `
            <div class="preview-window" id="previewWindow">
                <div class="preview-controls" id="previewControls">
                    <div class="preview-controls-left">
                        <span class="preview-title">实时预览</span>
                        <div class="preview-status" id="previewStatus">
                            <span class="status-indicator" id="statusIndicator"></span>
                            <span class="status-text" id="statusText">就绪</span>
                        </div>
                    </div>
                    <div class="preview-controls-right">
                        <button class="preview-btn" id="refreshBtn" title="刷新">
                            <span>🔄</span>
                        </button>
                        <button class="preview-btn" id="fullscreenBtn" title="全屏">
                            <span>⛶</span>
                        </button>
                        <button class="preview-btn" id="closeBtn" title="关闭">
                            <span>✕</span>
                        </button>
                    </div>
                </div>
                <div class="preview-device-selector" id="deviceSelectorContainer">
                    <select class="device-select" id="deviceSelect">
                        <option value="">选择设备...</option>
                    </select>
                    <button class="preview-btn" id="customSizeBtn" title="自定义尺寸">
                        <span>📐</span>
                    </button>
                </div>
                <div class="preview-content" id="previewContent">
                    <iframe 
                        id="previewIframe" 
                        class="preview-iframe"
                        frameborder="0"
                        allowfullscreen>
                    </iframe>
                </div>
                <div class="preview-info" id="previewInfo">
                    <span id="deviceInfo">393 × 852</span>
                    <span id="scaleInfo">缩放: 100%</span>
                    <span id="orientationInfo">方向: 竖屏</span>
                </div>
            </div>
        `;

        this.previewIframe = document.getElementById('previewIframe');
        this.bindEvents();
    }

    /**
     * 创建预览控制栏
     */
    createPreviewControls() {
        // 已在createPreviewContainer中创建
    }

    /**
     * 创建设备选择器
     */
    createDeviceSelector() {
        const deviceSelect = document.getElementById('deviceSelect');
        if (!deviceSelect) return;

        const devices = getAllDevices();
        
        // 按分类分组
        const groups = {
            '移动设备': devices.filter(d => d.width < 768),
            '平板设备': devices.filter(d => d.width >= 768 && d.width < 1024),
            '桌面设备': devices.filter(d => d.width >= 1024)
        };

        deviceSelect.innerHTML = '<option value="">选择设备...</option>';
        
        for (const [groupName, groupDevices] of Object.entries(groups)) {
            const optgroup = document.createElement('optgroup');
            optgroup.label = groupName;
            
            groupDevices.forEach(device => {
                const option = document.createElement('option');
                option.value = device.id;
                option.textContent = `${device.name} (${device.width}×${device.height})`;
                optgroup.appendChild(option);
            });
            
            deviceSelect.appendChild(optgroup);
        }

        // 设置默认设备
        if (this.currentDevice) {
            deviceSelect.value = this.currentDevice.id;
        }
    }

    /**
     * 绑定事件
     */
    bindEvents() {
        const refreshBtn = document.getElementById('refreshBtn');
        const fullscreenBtn = document.getElementById('fullscreenBtn');
        const closeBtn = document.getElementById('closeBtn');
        const deviceSelect = document.getElementById('deviceSelect');
        const customSizeBtn = document.getElementById('customSizeBtn');
        const previewControls = document.getElementById('previewControls');

        refreshBtn?.addEventListener('click', () => this.refresh());
        fullscreenBtn?.addEventListener('click', () => this.toggleFullscreen());
        closeBtn?.addEventListener('click', () => this.hide());
        deviceSelect?.addEventListener('change', (e) => this.switchDevice(e.target.value));
        customSizeBtn?.addEventListener('click', () => this.showCustomSizeDialog());

        // 拖拽功能
        if (previewControls) {
            this.initDrag(previewControls);
        }

        // 监听同步状态
        document.addEventListener('preview-sync-status', (e) => {
            this.updateSyncStatus(e.detail.status);
        });
    }

    /**
     * 初始化拖拽功能
     */
    initDrag(handleElement) {
        if (!this.container) return;

        // 鼠标按下
        handleElement.addEventListener('mousedown', (e) => {
            // 如果点击的是按钮，不触发拖拽
            if (e.target.closest('button')) {
                return;
            }

            // 全屏模式下不启用拖拽
            if (this.isFullscreen) {
                return;
            }

            this.isDragging = true;
            handleElement.classList.add('dragging');

            // 获取当前容器位置
            const rect = this.container.getBoundingClientRect();
            this.dragStartX = e.clientX;
            this.dragStartY = e.clientY;
            this.dragStartLeft = rect.left;
            this.dragStartTop = rect.top;

            // 移除固定的right和bottom，改用left和top
            this.container.style.right = 'auto';
            this.container.style.bottom = 'auto';
            this.container.style.left = `${rect.left}px`;
            this.container.style.top = `${rect.top}px`;
            this.container.style.width = `${rect.width}px`;
            this.container.style.height = `${rect.height}px`;

            e.preventDefault();
        });

        // 鼠标移动
        const handleMouseMove = (e) => {
            if (!this.isDragging || this.isFullscreen) return;

            const deltaX = e.clientX - this.dragStartX;
            const deltaY = e.clientY - this.dragStartY;

            let newLeft = this.dragStartLeft + deltaX;
            let newTop = this.dragStartTop + deltaY;

            // 限制在视口内
            const maxLeft = window.innerWidth - this.container.offsetWidth;
            const maxTop = window.innerHeight - this.container.offsetHeight;

            newLeft = Math.max(0, Math.min(newLeft, maxLeft));
            newTop = Math.max(64, Math.min(newTop, maxTop)); // 顶部留出64px给顶部栏

            this.container.style.left = `${newLeft}px`;
            this.container.style.top = `${newTop}px`;
        };

        // 鼠标释放
        const handleMouseUp = () => {
            if (this.isDragging) {
                this.isDragging = false;
                handleElement.classList.remove('dragging');
            }
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);

        // 保存事件处理器引用，以便后续清理（如果需要）
        this._dragMouseMoveHandler = handleMouseMove;
        this._dragMouseUpHandler = handleMouseUp;
    }

    /**
     * 显示预览窗口
     */
    async show(page = 'home') {
        if (!this.container) return;

        this.isVisible = true;
        this.container.style.display = 'flex';
        this.container.classList.add('visible');
        this.syncManager?.setPage(page);
        
        // 等待DOM更新后更新尺寸
        setTimeout(() => {
            this.updateDeviceInfo();
        }, 100);
        
        await this.loadPreview(page);
    }

    /**
     * 隐藏预览窗口
     */
    hide() {
        if (!this.container) return;
        
        this.isVisible = false;
        this.container.style.display = 'none';
        this.container.classList.remove('visible');
    }

    /**
     * 切换显示/隐藏
     */
    toggle() {
        if (this.isVisible) {
            this.hide();
        } else {
            this.show();
        }
    }

    /**
     * 页面名称到文件名的映射
     */
    getPageFileName(page) {
        const pageMap = {
            'global': 'index.html',  // 全站设置预览首页
            'home': 'index.html',
            'products': 'products.html',
            'cases': 'cases.html',
            'service': 'service.html',
            'about': 'about.html',
            'contact': 'contact.html'
        };
        return pageMap[page] || 'index.html';
    }

    /**
     * 加载预览
     */
    async loadPreview(page) {
        if (!this.previewIframe) return;

        try {
            // 确保页面参数有效
            const currentPage = page || this.syncManager?.currentPage || 'home';
            
            // 构建预览URL（添加preview=true参数，让网站前端读取草稿内容）
            const websiteBaseUrl = this.getWebsiteBaseUrl();
            const pageFileName = this.getPageFileName(currentPage);
            // 确保preview=true参数总是被添加
            const previewUrl = `${websiteBaseUrl}/${pageFileName}?preview=true&device=${this.currentDevice.id}&t=${Date.now()}`;
            
            // 添加错误处理
            this.previewIframe.onerror = (error) => {
                this.updateSyncStatus('error');
                this.showPreviewError(`无法加载预览页面: ${previewUrl}<br>请确保网站前端服务正在运行（端口8080或3000）`);
            };
            
            // 监听iframe加载
            this.previewIframe.onload = () => {
                // 检查iframe内容是否加载成功
                try {
                    const iframeDoc = this.previewIframe.contentDocument || this.previewIframe.contentWindow.document;
                    if (iframeDoc) {
                        this.updateSyncStatus('ready');
                        // 移除错误信息
                        const errorDiv = document.querySelector('.preview-error');
                        if (errorDiv) {
                            errorDiv.remove();
                        }
                    }
                } catch (e) {
                    // 跨域限制，无法访问iframe内容，但可能已加载
                    this.updateSyncStatus('ready');
                }
                
                // 加载完成后更新尺寸（确保尺寸正确）
                setTimeout(() => {
                    this.updateIframeSize();
                }, 100);
            };
            
            // 设置超时检测
            const timeoutId = setTimeout(() => {
                if (this.previewIframe.src && !this.previewIframe.contentDocument) {
                    this.updateSyncStatus('error');
                    this.showPreviewError(`预览加载超时: ${previewUrl}<br>请检查网站前端服务是否正常运行`);
                }
            }, 10000); // 10秒超时
            
            // 加载成功后清除超时
            this.previewIframe.addEventListener('load', () => {
                clearTimeout(timeoutId);
            }, { once: true });
            
            // 确保 URL 包含 preview=true 参数
            const finalUrl = previewUrl.includes('preview=true') 
                ? previewUrl 
                : `${previewUrl}${previewUrl.includes('?') ? '&' : '?'}preview=true`;
            
            this.previewIframe.src = finalUrl;
            this.updateDeviceInfo();
            this.updateSyncStatus('refreshing');
            
            // 在 iframe 加载后验证 URL 是否包含 preview=true
            setTimeout(() => {
                if (this.previewIframe && this.previewIframe.src) {
                    const currentSrc = this.previewIframe.src;
                    if (!currentSrc.includes('preview=true')) {
                        // 如果 URL 丢失了 preview=true，重新设置
                        const url = new URL(currentSrc);
                        url.searchParams.set('preview', 'true');
                        url.searchParams.set('t', Date.now().toString());
                        this.previewIframe.src = url.toString();
                    }
                }
            }, 100);
        } catch (error) {
            this.updateSyncStatus('error');
            this.showPreviewError('加载预览失败: ' + error.message);
        }
    }

    /**
     * 显示预览错误信息
     */
    showPreviewError(message) {
        const previewContent = document.getElementById('previewContent');
        if (previewContent && this.previewIframe) {
            // 在iframe位置显示错误信息
            const errorDiv = document.createElement('div');
            errorDiv.className = 'preview-error';
            errorDiv.style.cssText = `
                padding: 40px;
                text-align: center;
                color: #ef4444;
                background: #fee2e2;
                border-radius: 8px;
                margin: 20px;
            `;
            errorDiv.innerHTML = `
                <div style="font-size: 48px; margin-bottom: 16px;">⚠️</div>
                <div style="font-size: 16px; font-weight: 600; margin-bottom: 8px;">预览加载失败</div>
                <div style="font-size: 14px; color: #6b7280;">${message}</div>
                <div style="margin-top: 16px; font-size: 12px; color: #9ca3af;">
                    请检查：<br>
                    1. 网站前端服务是否运行（端口8080或3000）<br>
                    2. 预览URL是否正确
                </div>
            `;
            
            // 如果已有错误信息，先移除
            const existingError = previewContent.querySelector('.preview-error');
            if (existingError) {
                existingError.remove();
            }
            
            previewContent.insertBefore(errorDiv, this.previewIframe);
        }
    }

    /**
     * 获取网站基础URL
     */
    getWebsiteBaseUrl() {
        const hostname = window.location.hostname;
        const currentPort = window.location.port;
        
        // 管理后台运行在8081端口，网站前端运行在8080或3000端口
        let websitePort;
        if (hostname === 'localhost' || hostname === '127.0.0.1') {
            // 本地开发环境，尝试8080，如果不行再尝试3000
            websitePort = '8080';
        } else {
            // 生产环境，使用相同的端口映射逻辑
            websitePort = currentPort === '8081' ? '8080' : '3000';
        }
        
        const protocol = window.location.protocol;
        return `${protocol}//${hostname}:${websitePort}`;
    }

    /**
     * 切换设备
     */
    switchDevice(deviceId) {
        if (!deviceId) return;

        const device = getDeviceById(deviceId);
        if (!device) return;

        this.currentDevice = device;
        // 延迟更新，确保DOM已更新
        setTimeout(() => {
            this.updateDeviceInfo();
        }, 50);
        this.loadPreview(this.syncManager?.currentPage || 'home');
    }

    /**
     * 更新设备信息
     */
    updateDeviceInfo() {
        if (!this.currentDevice) return;

        const deviceInfo = document.getElementById('deviceInfo');
        const scaleInfo = document.getElementById('scaleInfo');
        const orientationInfo = document.getElementById('orientationInfo');

        if (deviceInfo) {
            deviceInfo.textContent = `${this.currentDevice.width} × ${this.currentDevice.height}`;
        }
        if (scaleInfo) {
            scaleInfo.textContent = `缩放: ${Math.round(this.currentDevice.scale * 100)}%`;
        }
        if (orientationInfo) {
            const isPortrait = this.currentDevice.height > this.currentDevice.width;
            orientationInfo.textContent = `方向: ${isPortrait ? '竖屏' : '横屏'}`;
        }

        // 更新iframe尺寸
        if (this.previewIframe) {
            this.updateIframeSize();
        }
    }

    /**
     * 更新iframe尺寸（智能缩放）
     */
    updateIframeSize() {
        if (!this.previewIframe || !this.currentDevice) return;

        const previewContent = document.getElementById('previewContent');
        if (!previewContent) return;

        // 获取预览容器的可用空间（减去padding）
        const containerPadding = 40; // 左右padding总和
        const containerHeight = previewContent.clientHeight - 40; // 减去上下padding
        const containerWidth = previewContent.clientWidth - containerPadding;

        const deviceWidth = this.currentDevice.width;
        const deviceHeight = this.currentDevice.height;
        const deviceAspectRatio = deviceWidth / deviceHeight;

        let displayWidth, displayHeight, scale;

        // 判断设备类型
        const isMobile = deviceWidth < 768;
        const isTablet = deviceWidth >= 768 && deviceWidth < 1024;
        const isDesktop = deviceWidth >= 1024;

        if (isDesktop) {
            // 桌面设备：使用容器宽度，保持宽高比，允许滚动
            displayWidth = Math.min(deviceWidth, containerWidth);
            displayHeight = displayWidth / deviceAspectRatio;
            scale = displayWidth / deviceWidth;
            
            // 如果高度超过容器，则按高度缩放
            if (displayHeight > containerHeight) {
                displayHeight = containerHeight;
                displayWidth = displayHeight * deviceAspectRatio;
                scale = displayWidth / deviceWidth;
            }
        } else if (isTablet) {
            // 平板设备：适应容器，保持宽高比
            const widthScale = containerWidth / deviceWidth;
            const heightScale = containerHeight / deviceHeight;
            scale = Math.min(widthScale, heightScale, 1); // 不超过原始尺寸
            
            displayWidth = deviceWidth * scale;
            displayHeight = deviceHeight * scale;
        } else {
            // 移动设备：可以适当放大以便查看
            const widthScale = containerWidth / deviceWidth;
            const heightScale = containerHeight / deviceHeight;
            scale = Math.min(widthScale, heightScale, 2); // 最多放大2倍
            
            displayWidth = deviceWidth * scale;
            displayHeight = deviceHeight * scale;
        }

        // 应用尺寸
        this.previewIframe.style.width = `${displayWidth}px`;
        this.previewIframe.style.height = `${displayHeight}px`;
        this.previewIframe.style.maxWidth = '100%';
        this.previewIframe.style.maxHeight = '100%';

        // 更新缩放信息显示
        const scaleInfo = document.getElementById('scaleInfo');
        if (scaleInfo) {
            scaleInfo.textContent = `缩放: ${Math.round(scale * 100)}%`;
        }

    }

    /**
     * 刷新预览
     */
    refresh() {
        if (!this.previewIframe) return;
        
        // 始终重新加载预览，确保preview=true参数正确添加
        const currentPage = this.syncManager?.currentPage || 'home';
        this.loadPreview(currentPage);
    }

    /**
     * 切换全屏
     */
    toggleFullscreen() {
        const previewWindow = document.getElementById('previewWindow');
        if (!previewWindow) return;

        if (!this.isFullscreen) {
            if (previewWindow.requestFullscreen) {
                previewWindow.requestFullscreen();
            } else if (previewWindow.webkitRequestFullscreen) {
                previewWindow.webkitRequestFullscreen();
            } else if (previewWindow.msRequestFullscreen) {
                previewWindow.msRequestFullscreen();
            }
            this.isFullscreen = true;
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            } else if (document.webkitExitFullscreen) {
                document.webkitExitFullscreen();
            } else if (document.msExitFullscreen) {
                document.msExitFullscreen();
            }
            this.isFullscreen = false;
        }
    }

    /**
     * 显示自定义尺寸对话框
     */
    showCustomSizeDialog() {
        const width = prompt('请输入宽度 (px):', this.currentDevice?.width || 375);
        const height = prompt('请输入高度 (px):', this.currentDevice?.height || 667);

        if (width && height && !isNaN(width) && !isNaN(height)) {
            const customDevice = createCustomDevice(parseInt(width), parseInt(height));
            this.currentDevice = customDevice;
            this.updateDeviceInfo();
            this.loadPreview(this.syncManager?.currentPage || 'home');
        }
    }

    /**
     * 更新同步状态
     */
    updateSyncStatus(status) {
        const indicator = document.getElementById('statusIndicator');
        const statusText = document.getElementById('statusText');

        if (!indicator || !statusText) return;

        const statusMap = {
            'syncing': { text: '同步中...', color: '#f59e0b' },
            'synced': { text: '已同步', color: '#16a34a' },
            'refreshing': { text: '刷新中...', color: '#3b82f6' },
            'error': { text: '同步失败', color: '#ef4444' },
            'ready': { text: '就绪', color: '#6b7280' }
        };

        const statusInfo = statusMap[status] || statusMap['ready'];
        indicator.style.backgroundColor = statusInfo.color;
        statusText.textContent = statusInfo.text;
    }

    /**
     * 处理预览窗口消息
     */
    handlePreviewMessage(event) {
        // 处理来自预览iframe的消息
        if (event.data && event.data.type === 'preview-ready') {
            this.updateSyncStatus('ready');
        }
    }

    /**
     * 获取同步管理器
     */
    getSyncManager() {
        return this.syncManager;
    }
}

