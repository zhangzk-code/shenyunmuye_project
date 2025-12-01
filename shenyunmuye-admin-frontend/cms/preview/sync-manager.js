/**
 * 预览同步管理器
 */
import { debounce } from '../utils/debounce.js';
import { api } from '../utils/api.js';

export class SyncManager {
    constructor(previewWindow) {
        this.previewWindow = previewWindow;
        this.isSyncing = false;
        this.syncQueue = [];
        this.currentPage = 'home';
        this.currentContent = null;
        
        // 创建防抖的同步函数
        this.syncPreview = debounce(this._syncPreview.bind(this), 500);
    }

    /**
     * 设置当前页面
     */
    setPage(page) {
        this.currentPage = page;
    }

    /**
     * 更新内容并同步预览
     */
    updateContent(content) {
        this.currentContent = content;
        this.syncPreview();
    }

    /**
     * 同步预览（防抖处理）
     */
    _syncPreview() {
        if (!this.previewWindow || !this.currentContent) {
            return;
        }

        this.isSyncing = true;
        this._notifySyncStatus('syncing');

        // 通过postMessage发送内容到预览窗口
        try {
            const message = {
                type: 'update-content',
                page: this.currentPage,
                content: this.currentContent,
                timestamp: Date.now()
            };
            
            this.previewWindow.postMessage(message, '*');
            
            // 模拟同步完成（实际应该等待预览窗口确认）
            setTimeout(() => {
                this.isSyncing = false;
                this._notifySyncStatus('synced');
            }, 100);
        } catch (error) {
            this.isSyncing = false;
            this._notifySyncStatus('error');
        }
    }

    /**
     * 通知同步状态
     */
    _notifySyncStatus(status) {
        const event = new CustomEvent('preview-sync-status', {
            detail: { status }
        });
        document.dispatchEvent(event);
    }

    /**
     * 强制刷新预览
     */
    async refreshPreview() {
        if (!this.previewWindow) {
            return;
        }

        this._notifySyncStatus('refreshing');
        
        try {
            // 重新加载预览URL，保留preview=true参数
            const previewUrl = this.previewWindow.src;
            const url = new URL(previewUrl);
            // 确保preview=true参数存在
            url.searchParams.set('preview', 'true');
            url.searchParams.set('t', Date.now().toString());
            this.previewWindow.src = url.toString();
            
            // 等待iframe加载完成
            this.previewWindow.onload = () => {
                this._notifySyncStatus('synced');
            };
        } catch (error) {
            this._notifySyncStatus('error');
        }
    }

    /**
     * 获取同步状态
     */
    getSyncStatus() {
        return {
            isSyncing: this.isSyncing,
            hasContent: !!this.currentContent
        };
    }
}

