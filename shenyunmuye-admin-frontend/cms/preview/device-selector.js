/**
 * 设备选择器
 */
export const DEVICES = {
    mobile: [
        {
            id: 'iphone-14-pro',
            name: 'iPhone 14 Pro',
            width: 393,
            height: 852,
            scale: 3,
            userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1'
        },
        {
            id: 'iphone-se',
            name: 'iPhone SE',
            width: 375,
            height: 667,
            scale: 2,
            userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1'
        },
        {
            id: 'samsung-galaxy-s21',
            name: 'Samsung Galaxy S21',
            width: 360,
            height: 800,
            scale: 3,
            userAgent: 'Mozilla/5.0 (Linux; Android 11; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36'
        }
    ],
    tablet: [
        {
            id: 'ipad-pro',
            name: 'iPad Pro',
            width: 1024,
            height: 1366,
            scale: 2,
            userAgent: 'Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1'
        },
        {
            id: 'ipad-air',
            name: 'iPad Air',
            width: 820,
            height: 1180,
            scale: 2,
            userAgent: 'Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1'
        }
    ],
    desktop: [
        {
            id: 'desktop-1920',
            name: 'Desktop (1920px)',
            width: 1920,
            height: 1080,
            scale: 1,
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Safari/537.36'
        },
        {
            id: 'laptop-1366',
            name: 'Laptop (1366px)',
            width: 1366,
            height: 768,
            scale: 1,
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Safari/537.36'
        }
    ]
};

/**
 * 获取所有设备
 */
export function getAllDevices() {
    return [
        ...DEVICES.mobile,
        ...DEVICES.tablet,
        ...DEVICES.desktop
    ];
}

/**
 * 根据ID获取设备
 */
export function getDeviceById(id) {
    const allDevices = getAllDevices();
    return allDevices.find(device => device.id === id);
}

/**
 * 创建自定义设备
 */
export function createCustomDevice(width, height) {
    return {
        id: `custom-${width}x${height}`,
        name: `自定义 (${width}×${height})`,
        width: width,
        height: height,
        scale: 1,
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Safari/537.36'
    };
}

/**
 * 获取设备分类
 */
export function getDeviceCategory(deviceId) {
    if (DEVICES.mobile.find(d => d.id === deviceId)) return 'mobile';
    if (DEVICES.tablet.find(d => d.id === deviceId)) return 'tablet';
    if (DEVICES.desktop.find(d => d.id === deviceId)) return 'desktop';
    return 'custom';
}

