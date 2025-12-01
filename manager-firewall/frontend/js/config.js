// API 配置
// 使用相对路径，通过 Nginx 代理访问后端 API
const getApiBaseUrl = () => {
    // 开发环境：直接访问后端端口
    const hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return 'http://localhost:3002/api';
    }
    
    // 生产环境：使用相对路径，通过 Nginx 代理（/api -> localhost:3002）
    return '/api';
};

const API_BASE_URL = getApiBaseUrl();

