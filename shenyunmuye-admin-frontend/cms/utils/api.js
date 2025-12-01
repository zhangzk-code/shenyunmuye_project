/**
 * API封装工具
 */
class API {
    constructor(baseURL) {
        this.baseURL = baseURL;
        this.timeout = 5000;
    }

    /**
     * 获取认证token
     */
    getToken() {
        return localStorage.getItem('admin_token');
    }

    /**
     * 带超时的fetch封装
     */
    async fetchWithTimeout(url, options = {}, timeout = this.timeout) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        
        try {
            const response = await fetch(url, {
                ...options,
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            return response;
        } catch (error) {
            clearTimeout(timeoutId);
            if (error.name === 'AbortError') {
                throw new Error('请求超时，请检查网络连接或后端服务是否正常运行');
            }
            throw error;
        }
    }

    /**
     * 通用请求方法
     */
    async request(endpoint, options = {}) {
        const token = this.getToken();
        const url = `${this.baseURL}${endpoint}`;
        
        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json',
                ...(token && { 'Authorization': `Bearer ${token}` })
            }
        };

        const config = {
            ...defaultOptions,
            ...options,
            headers: {
                ...defaultOptions.headers,
                ...(options.headers || {})
            }
        };

        try {
            const response = await this.fetchWithTimeout(url, config);
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.message || `请求失败: ${response.status}`);
            }
            
            return data;
        } catch (error) {
            throw error;
        }
    }

    /**
     * GET请求
     */
    async get(endpoint, params = {}) {
        const queryString = new URLSearchParams(params).toString();
        const url = queryString ? `${endpoint}?${queryString}` : endpoint;
        return this.request(url, { method: 'GET' });
    }

    /**
     * POST请求
     */
    async post(endpoint, data = {}) {
        return this.request(endpoint, {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    /**
     * PUT请求
     */
    async put(endpoint, data = {}) {
        return this.request(endpoint, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }

    /**
     * DELETE请求
     */
    async delete(endpoint) {
        return this.request(endpoint, { method: 'DELETE' });
    }

    /**
     * 文件上传
     */
    async upload(endpoint, file, onProgress = null) {
        const token = this.getToken();
        const formData = new FormData();
        formData.append('file', file);

        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            
            xhr.upload.addEventListener('progress', (e) => {
                if (e.lengthComputable && onProgress) {
                    const percentComplete = (e.loaded / e.total) * 100;
                    onProgress(percentComplete);
                }
            });

            xhr.addEventListener('load', () => {
                if (xhr.status === 200) {
                    try {
                        const response = JSON.parse(xhr.responseText);
                        resolve(response);
                    } catch (error) {
                        reject(new Error('响应解析失败'));
                    }
                } else {
                    reject(new Error(`上传失败: ${xhr.status}`));
                }
            });

            xhr.addEventListener('error', () => {
                reject(new Error('上传请求失败'));
            });

            xhr.open('POST', `${this.baseURL}${endpoint}`);
            if (token) {
                xhr.setRequestHeader('Authorization', `Bearer ${token}`);
            }
            xhr.send(formData);
        });
    }
}

// 根据当前域名自动判断API地址
function getApiBaseUrl() {
    const hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return 'http://localhost:3001/api/admin';
    }
    if (hostname === '152.32.209.245') {
        return 'http://152.32.209.245:3001/api/admin';
    }
    return `${window.location.protocol}//${hostname}:3001/api/admin`;
}

export const api = new API(getApiBaseUrl());

