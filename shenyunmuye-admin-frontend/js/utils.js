// 工具函数模块

import { API_BASE_URL, REQUEST_TIMEOUT } from './config.js';

// 带超时的fetch封装
export async function fetchWithTimeout(url, options = {}, timeout = REQUEST_TIMEOUT) {
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

// 深度比较两个对象
export function deepEqual(obj1, obj2) {
    if (obj1 === obj2) return true;
    
    if (obj1 == null || obj2 == null) return false;
    if (typeof obj1 !== 'object' || typeof obj2 !== 'object') return false;
    
    const keys1 = Object.keys(obj1);
    const keys2 = Object.keys(obj2);
    
    if (keys1.length !== keys2.length) return false;
    
    for (const key of keys1) {
        if (!keys2.includes(key)) return false;
        if (!deepEqual(obj1[key], obj2[key])) return false;
    }
    
    return true;
}

// 通过路径获取对象值
export function getValueByPath(obj, path) {
    return path.reduce((current, key) => {
        return current && current[key] !== undefined ? current[key] : undefined;
    }, obj);
}

// 通过路径设置对象值
export function setValueByPath(obj, path, value) {
    const lastKey = path[path.length - 1];
    const parentPath = path.slice(0, -1);
    const parent = parentPath.reduce((current, key) => {
        if (!current[key] || typeof current[key] !== 'object') {
            current[key] = {};
        }
        return current[key];
    }, obj);
    parent[lastKey] = value;
}

// 格式化标签（需要传入FIELD_LABELS，避免循环依赖）
export function formatLabel(key, path = [], currentContentPage = '', currentSection = '', FIELD_LABELS = {}) {
    
    // 特殊处理：产品描述
    if (key === 'description') {
        const isProductDescription = (path.length >= 2 && path[path.length - 2] === 'productGallery' && (path.includes('home') || currentContentPage === 'home')) ||
                                    (currentContentPage === 'home' && currentSection === 'productGallery' && path.length >= 1 && path[path.length - 1] === 'description');
        if (isProductDescription) {
            return '产品描述';
        }
        const isContactServiceDescription = (path.length >= 2 && path[path.length - 2] === 'service' && (path.includes('contact') || currentContentPage === 'contact')) ||
                                            (currentContentPage === 'contact' && currentSection === 'service' && path.length >= 1 && path[path.length - 1] === 'description');
        if (isContactServiceDescription) {
            return '服务描述';
        }
        return '描述';
    }
    
    // 特殊处理：在线留言表单中的 button 字段显示为"提交按钮"
    const isFormButton = key === 'button' && 
        ((path.length >= 2 && path[path.length - 2] === 'form' && (path.includes('contact') || currentContentPage === 'contact')) ||
         (currentContentPage === 'contact' && currentSection === 'form'));
    if (isFormButton) {
        return '提交按钮';
    }
    
    // 使用字段标签映射
    return FIELD_LABELS[key] || key;
}

// 转义HTML
export function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 防抖函数
export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// 节流函数
export function throttle(func, limit) {
    let inThrottle;
    return function(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

