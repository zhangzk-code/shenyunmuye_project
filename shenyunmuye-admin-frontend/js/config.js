// 配置模块 - 包含所有配置常量和映射

// API配置
export const getApiBaseUrl = () => {
    const hostname = window.location.hostname;
    const protocol = window.location.protocol;
    
    // 开发环境
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return 'http://localhost:3001/api/admin';
    }
    
    // 生产环境：动态获取当前访问的主机名和协议，后端API使用3001端口
    return `${protocol}//${hostname}:3001/api/admin`;
};

export const API_BASE_URL = getApiBaseUrl();
export const REQUEST_TIMEOUT = 5000;

// 页面标签映射
export const PAGE_LABELS = {
    global: '全站公用',
    home: '首页',
    products: '产品系列',
    cases: '高定案例',
    service: '定制服务',
    about: '关于我们',
    contact: '联系我们'
};

// 栏目图标映射
export const SECTION_ICONS = {
    // 全局
    brand: '🏢',
    nav: '📋',
    languages: '🌐',
    footer: '📄',
    floatingSidebar: '🔗',
    // 首页
    hero: '🖼️',
    qrCards: '📱',
    productSeries: '🏷️',
    productGallery: '🖼️',
    cases: '📸',
    cta: '🔘',
    // 产品系列
    header: '📄',
    filters: '🏷️',
    productCards: '📦',
    categories: '📁',
    // 高定案例
    featured: '⭐',
    casesGrid: '📋',
    // 定制服务
    process: '⚙️',
    advantages: '✨',
    appointment: '📝',
    // 关于我们
    heroImage: '🖼️',
    story: '📖',
    timeline: '📅',
    // 联系我们
    service: '💼',
    company: '🏢',
    form: '📝'
};

// 字段标签映射
export const FIELD_LABELS = {
    title: '标题',
    subtitle: '副标题',
    description: '描述',
    content: '内容',
    image: '图片',
    images: '图片列表',
    link: '链接',
    url: '网址',
    icon: '图标',
    text: '文本',
    button: '按钮',
    name: '名称',
    phone: '电话',
    email: '邮箱',
    address: '地址',
    hotline: '服务热线',
    mapLink: '地图链接',
    year: '年份',
    heroImage: '头图',
    backgroundImage: '背景图片',
    showConsultation: '显示在线咨询',
    showCustomerService: '显示在线客服',
    tagline: '品牌标语',
    logo: '品牌logo',
    slogan: '品牌口号',
    hours: '服务时间',
    copyright: '版权信息',
    icp: 'ICP备案号',
    label: '系列标签',
    number: '序号'
};

// 栏目标签映射
export const SECTION_LABELS = {
    global: {
        brand: '品牌信息',
        nav: '导航菜单',
        languages: '语言切换',
        footer: '页脚信息',
        floatingSidebar: '浮动侧边栏'
    },
    home: {
        hero: '首页头图',
        qrCards: '二维码区域',
        productSeries: '产品系列标签',
        productGallery: '产品画廊',
        cases: '精选案例',
        cta: '跳转按钮'
    },
    products: {
        header: '页面头部',
        filters: '筛选标签',
        productCards: '产品列表',
        categories: '按空间分类'
    },
    cases: {
        header: '页面头部',
        featured: '重点案例',
        casesGrid: '案例网格'
    },
    service: {
        header: '页面头部',
        process: '服务流程',
        advantages: '服务优势',
        appointment: '预约表单'
    },
    about: {
        heroImage: '头图',
        story: '品牌故事',
        advantages: '公司优势',
        timeline: '发展历程'
    },
    contact: {
        header: '页面头部',
        service: '客户服务',
        company: '公司信息',
        form: '在线留言'
    }
};

// 状态文本映射
export const STATUS_TEXTS = {
    pending: '待处理',
    processed: '已处理',
    archived: '已归档',
    contacted: '已联系',
    confirmed: '已确认',
    completed: '已完成'
};

// 获取状态文本
export const getStatusText = (status) => {
    return STATUS_TEXTS[status] || status;
};

export const getAppointmentStatusText = (status) => {
    return STATUS_TEXTS[status] || status;
};

// 获取官网URL
export const getWebsiteUrl = () => {
    const hostname = window.location.hostname;
    const protocol = window.location.protocol;
    
    // 开发环境
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return 'http://localhost:8080/index.html';
    }
    
    // 生产环境：动态获取当前访问的主机名和协议，前端网站使用8080端口
    return `${protocol}//${hostname}:8080/index.html`;
};

