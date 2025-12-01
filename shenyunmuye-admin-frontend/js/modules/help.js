// 帮助文档模块

// 显示帮助模态框
export function showHelpModal() {
    const helpModal = document.getElementById('helpModal');
    const helpContent = document.getElementById('helpContent');
    if (!helpModal || !helpContent) return;
    
    helpContent.innerHTML = generateHelpContent();
    helpModal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    
    // 为锚点链接添加点击事件处理，实现定位效果
    setTimeout(() => {
        // 获取正确的滚动容器（.modal-content，而不是.modal-body）
        const modalContent = helpContent.closest('.modal-content');
        const scrollContainer = modalContent || helpContent;
        
        // 滚动到目标元素的辅助函数
        const scrollToTarget = (targetElement) => {
            if (!targetElement || !scrollContainer) return;
            
            // 计算目标元素相对于滚动容器的位置
            const containerRect = scrollContainer.getBoundingClientRect();
            const targetRect = targetElement.getBoundingClientRect();
            const currentScrollTop = scrollContainer.scrollTop || 0;
            
            // 计算目标位置（考虑 sticky header 的高度）
            const stickyHeader = scrollContainer.querySelector('.modal-header');
            const headerHeight = stickyHeader ? stickyHeader.offsetHeight : 0;
            const targetTop = targetRect.top - containerRect.top + currentScrollTop - headerHeight - 20;
            
            // 使用 scrollTo 方法滚动
            if (scrollContainer.scrollTo) {
                scrollContainer.scrollTo({
                    top: Math.max(0, targetTop), // 确保不为负数
                    behavior: 'smooth'
                });
            } else {
                // 兼容不支持 scrollTo 的浏览器
                scrollContainer.scrollTop = Math.max(0, targetTop);
            }
        };
        
        const anchorLinks = helpContent.querySelectorAll('a[href^="#"]');
        anchorLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const targetId = link.getAttribute('href').substring(1);
                const targetElement = document.getElementById(targetId);
                if (targetElement) {
                    scrollToTarget(targetElement);
                }
            });
        });
        
        // 检查URL中是否有锚点，如果有则自动滚动
        const hash = window.location.hash;
        if (hash) {
            const targetId = hash.substring(1);
            const targetElement = document.getElementById(targetId);
            if (targetElement) {
                setTimeout(() => {
                    scrollToTarget(targetElement);
                }, 150);
            }
        }
    }, 100);
}

// 关闭帮助模态框
export function closeHelpModal() {
    const helpModal = document.getElementById('helpModal');
    if (!helpModal) return;
    helpModal.style.display = 'none';
    document.body.style.overflow = '';
}

// 生成帮助内容
function generateHelpContent() {
    return `
        <div style="line-height: 1.9; color: #1f2937; font-size: 16px;">
            <div style="margin-bottom: 32px; padding: 20px; background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); border-radius: 12px; border: 2px solid #0ea5e9;">
                <h3 style="color: #0ea5e9; font-size: 20px; font-weight: 700; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 2px solid #0ea5e9;">📋 目录</h3>
                <ul style="list-style: none; padding: 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px;">
                    <li style="margin: 0;"><a href="#basic" style="color: #0ea5e9; text-decoration: none; font-weight: 500; padding: 8px 12px; background: #ffffff; border-radius: 8px; display: block; transition: all 0.2s;" onmouseover="this.style.background='#e0f2fe'; this.style.transform='translateX(4px)'" onmouseout="this.style.background='#ffffff'; this.style.transform='translateX(0)'">基础操作</a></li>
                    <li style="margin: 0;"><a href="#global" style="color: #10b981; text-decoration: none; font-weight: 500; padding: 8px 12px; background: #ffffff; border-radius: 8px; display: block; transition: all 0.2s;" onmouseover="this.style.background='#d1fae5'; this.style.transform='translateX(4px)'" onmouseout="this.style.background='#ffffff'; this.style.transform='translateX(0)'">全站设置</a></li>
                    <li style="margin: 0;"><a href="#home" style="color: #f59e0b; text-decoration: none; font-weight: 500; padding: 8px 12px; background: #ffffff; border-radius: 8px; display: block; transition: all 0.2s;" onmouseover="this.style.background='#fef3c7'; this.style.transform='translateX(4px)'" onmouseout="this.style.background='#ffffff'; this.style.transform='translateX(0)'">首页管理</a></li>
                    <li style="margin: 0;"><a href="#products" style="color: #8b5cf6; text-decoration: none; font-weight: 500; padding: 8px 12px; background: #ffffff; border-radius: 8px; display: block; transition: all 0.2s;" onmouseover="this.style.background='#ede9fe'; this.style.transform='translateX(4px)'" onmouseout="this.style.background='#ffffff'; this.style.transform='translateX(0)'">产品系列</a></li>
                    <li style="margin: 0;"><a href="#cases" style="color: #ec4899; text-decoration: none; font-weight: 500; padding: 8px 12px; background: #ffffff; border-radius: 8px; display: block; transition: all 0.2s;" onmouseover="this.style.background='#fce7f3'; this.style.transform='translateX(4px)'" onmouseout="this.style.background='#ffffff'; this.style.transform='translateX(0)'">高定案例</a></li>
                    <li style="margin: 0;"><a href="#service" style="color: #06b6d4; text-decoration: none; font-weight: 500; padding: 8px 12px; background: #ffffff; border-radius: 8px; display: block; transition: all 0.2s;" onmouseover="this.style.background='#cffafe'; this.style.transform='translateX(4px)'" onmouseout="this.style.background='#ffffff'; this.style.transform='translateX(0)'">服务流程</a></li>
                    <li style="margin: 0;"><a href="#about" style="color: #14b8a6; text-decoration: none; font-weight: 500; padding: 8px 12px; background: #ffffff; border-radius: 8px; display: block; transition: all 0.2s;" onmouseover="this.style.background='#ccfbf1'; this.style.transform='translateX(4px)'" onmouseout="this.style.background='#ffffff'; this.style.transform='translateX(0)'">关于我们</a></li>
                    <li style="margin: 0;"><a href="#contact" style="color: #f97316; text-decoration: none; font-weight: 500; padding: 8px 12px; background: #ffffff; border-radius: 8px; display: block; transition: all 0.2s;" onmouseover="this.style.background='#fed7aa'; this.style.transform='translateX(4px)'" onmouseout="this.style.background='#ffffff'; this.style.transform='translateX(0)'">联系我们</a></li>
                    <li style="margin: 0;"><a href="#tips" style="color: #f59e0b; text-decoration: none; font-weight: 500; padding: 8px 12px; background: #ffffff; border-radius: 8px; display: block; transition: all 0.2s;" onmouseover="this.style.background='#fef3c7'; this.style.transform='translateX(4px)'" onmouseout="this.style.background='#ffffff'; this.style.transform='translateX(0)'">操作提示</a></li>
                </ul>
            </div>
            
            <div id="basic" style="margin-bottom: 40px; padding: 24px; background: #f8fafc; border-radius: 12px; border-left: 4px solid #0ea5e9; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
                <h3 style="color: #0ea5e9; font-size: 20px; font-weight: 700; margin-bottom: 20px; display: flex; align-items: center; gap: 8px;">🔧 基础操作</h3>
                <div style="margin-bottom: 20px;">
                    <h4 style="color: #1f2937; font-size: 16px; font-weight: 600; margin-bottom: 12px;">1. 导航与选择</h4>
                    <p style="margin: 0 0 10px 0; color: #374151; line-height: 1.8;">• 在左侧导航栏选择要编辑的页面（如"首页"、"产品系列"等）</p>
                    <p style="margin: 0 0 10px 0; color: #374151; line-height: 1.8;">• 点击页面下的栏目名称（如"产品画廊"、"重点案例"等）进入编辑</p>
                    <p style="margin: 0; color: #374151; line-height: 1.8;">• 移动端可通过右下角菜单按钮（☰）打开导航栏</p>
                </div>
                <div style="margin-bottom: 20px;">
                    <h4 style="color: #1f2937; font-size: 16px; font-weight: 600; margin-bottom: 12px;">2. 编辑内容</h4>
                    <p style="margin: 0 0 10px 0; color: #374151; line-height: 1.8;">• 直接在输入框中修改文本内容</p>
                    <p style="margin: 0 0 10px 0; color: #374151; line-height: 1.8;">• 图片字段可点击"上传图片"按钮上传新图片，或直接输入图片路径</p>
                    <p style="margin: 0 0 10px 0; color: #374151; line-height: 1.8;">• 开关类字段（如"显示在线咨询"）通过点击开关切换状态</p>
                    <p style="margin: 0; color: #374151; line-height: 1.8;">• 修改后会自动标记为"已修改"状态</p>
                </div>
                <div style="margin-bottom: 20px;">
                    <h4 style="color: #1f2937; font-size: 16px; font-weight: 600; margin-bottom: 12px;">3. 保存与发布</h4>
                    <p style="margin: 0 0 10px 0; color: #374151; line-height: 1.8;">• <strong style="color: #1f2937;">保存</strong>：将修改保存到草稿，不会影响网站显示</p>
                    <p style="margin: 0 0 10px 0; color: #374151; line-height: 1.8;">• <strong style="color: #1f2937;">发布</strong>：将草稿内容发布到网站，用户才能看到最新内容</p>
                    <p style="margin: 0 0 10px 0; color: #374151; line-height: 1.8;">• 发布前可使用"预览"功能查看效果</p>
                    <p style="margin: 0; color: #374151; line-height: 1.8;">• 有未发布内容时，发布按钮会显示警告颜色</p>
                </div>
                <div>
                    <h4 style="color: #1f2937; font-size: 16px; font-weight: 600; margin-bottom: 12px;">4. 恢复默认</h4>
                    <p style="margin: 0; color: #374151; line-height: 1.8;">• 每个栏目都有"恢复默认"按钮，可将内容恢复为初始值</p>
                </div>
            </div>
            
            <div id="global" style="margin-bottom: 40px; padding: 20px; background: #f8fafc; border-radius: 12px; border-left: 4px solid #10b981;">
                <h3 style="color: #10b981; font-size: 20px; margin-bottom: 16px;">🌐 全站设置</h3>
                <div style="margin-bottom: 16px;">
                    <h4 style="color: #1f2937; font-size: 16px; margin-bottom: 8px; font-weight: 600;">品牌信息</h4>
                    <p style="margin: 0 0 8px 0; color: #374151;">• <strong>品牌名称</strong>：网站的品牌名称</p>
                    <p style="margin: 0 0 8px 0; color: #374151;">• <strong>品牌标语</strong>：品牌的口号或标语</p>
                    <p style="margin: 0 0 8px 0; color: #374151;">• <strong>品牌Logo</strong>：上传Logo图片后，导航栏将显示Logo，品牌名称和标语会被隐藏</p>
                    <p style="margin: 0; color: #374151;"><strong>操作效果</strong>：修改后会在网站导航栏显示</p>
                </div>
                <div style="margin-bottom: 16px;">
                    <h4 style="color: #1f2937; font-size: 16px; margin-bottom: 8px; font-weight: 600;">页脚相关信息</h4>
                    <p style="margin: 0 0 8px 0; color: #374151;">• 管理网站页脚的内容，包括描述、版权信息、备案信息等</p>
                    <p style="margin: 0 0 8px 0; color: #374151;">• 页脚描述可添加多条，每条会以段落形式显示</p>
                    <p style="margin: 0; color: #374151;"><strong>操作效果</strong>：修改后会在网站底部页脚区域显示</p>
                </div>
                <div style="margin-bottom: 16px;">
                    <h4 style="color: #1f2937; font-size: 16px; margin-bottom: 8px; font-weight: 600;">浮动侧边栏</h4>
                    <p style="margin: 0 0 8px 0; color: #374151;">• 控制网站右侧浮动侧边栏的显示/隐藏</p>
                    <p style="margin: 0 0 8px 0; color: #374151;">• 可分别控制"在线咨询"和"在线客服"的显示</p>
                    <p style="margin: 0; color: #374151;"><strong>操作效果</strong>：修改后会在网站右侧显示或隐藏浮动图标</p>
                </div>
            </div>
            
            <div id="home" style="margin-bottom: 40px; padding: 20px; background: #f8fafc; border-radius: 12px; border-left: 4px solid #f59e0b;">
                <h3 style="color: #f59e0b; font-size: 20px; margin-bottom: 16px;">🏠 首页管理</h3>
                <div style="margin-bottom: 16px;">
                    <h4 style="color: #1f2937; font-size: 16px; margin-bottom: 8px; font-weight: 600;">产品系列标签</h4>
                    <p style="margin: 0 0 8px 0; color: #374151;">• 管理首页产品系列标签，每个标签标题可编辑</p>
                    <p style="margin: 0 0 8px 0; color: #374151;">• 标签与产品系列页面一一对应，点击标签可跳转到对应页面</p>
                    <p style="margin: 0; color: #374151;"><strong>操作效果</strong>：修改后会在首页产品系列区域显示，点击可跳转到对应页面</p>
                </div>
                <div style="margin-bottom: 16px;">
                    <h4 style="color: #1f2937; font-size: 16px; margin-bottom: 8px; font-weight: 600;">产品画廊</h4>
                    <p style="margin: 0 0 8px 0; color: #374151;">• 管理首页产品展示区域，每个产品包含标题、图片、描述</p>
                    <p style="margin: 0 0 8px 0; color: #374151;">• 可添加、删除产品项</p>
                    <p style="margin: 0 0 8px 0; color: #374151;">• 点击产品图片可查看大图和详细描述</p>
                    <p style="margin: 0; color: #374151;"><strong>操作效果</strong>：修改后会在首页产品画廊区域显示</p>
                </div>
                <div>
                    <h4 style="color: #1f2937; font-size: 16px; margin-bottom: 8px; font-weight: 600;">精选案例</h4>
                    <p style="margin: 0 0 8px 0; color: #374151;">• 管理首页案例展示区域，每个案例包含标题、图片、描述</p>
                    <p style="margin: 0 0 8px 0; color: #374151;">• 可添加、删除案例项</p>
                    <p style="margin: 0; color: #374151;"><strong>操作效果</strong>：修改后会在首页精选案例区域显示</p>
                </div>
            </div>
            
            <div id="products" style="margin-bottom: 40px; padding: 20px; background: #f8fafc; border-radius: 12px; border-left: 4px solid #8b5cf6;">
                <h3 style="color: #8b5cf6; font-size: 20px; margin-bottom: 16px;">📦 产品系列</h3>
                <div style="margin-bottom: 16px;">
                    <h4 style="color: #1f2937; font-size: 16px; margin-bottom: 8px; font-weight: 600;">页面头部</h4>
                    <p style="margin: 0 0 8px 0; color: #374151;">• 设置产品系列页面的标题、副标题和背景图片</p>
                    <p style="margin: 0; color: #374151;"><strong>操作效果</strong>：修改后会在产品系列页面顶部显示</p>
                </div>
                <div style="margin-bottom: 16px;">
                    <h4 style="color: #1f2937; font-size: 16px; margin-bottom: 8px; font-weight: 600;">筛选标签</h4>
                    <p style="margin: 0 0 8px 0; color: #374151;">• 管理产品筛选标签，每个标签对应一个产品分类</p>
                    <p style="margin: 0 0 8px 0; color: #374151;">• 可添加、删除标签，删除标签会同时删除该分类下的所有产品</p>
                    <p style="margin: 0 0 8px 0; color: #374151;">• 标签分类不可直接编辑，由系统自动管理</p>
                    <p style="margin: 0; color: #374151;"><strong>操作效果</strong>：修改后会在产品系列页面左侧显示筛选菜单</p>
                </div>
                <div>
                    <h4 style="color: #1f2937; font-size: 16px; margin-bottom: 8px; font-weight: 600;">产品列表</h4>
                    <p style="margin: 0 0 8px 0; color: #374151;">• 管理所有产品卡片，每个产品包含标题、图片、描述、分类</p>
                    <p style="margin: 0 0 8px 0; color: #374151;">• 左侧导航可按分类筛选产品</p>
                    <p style="margin: 0 0 8px 0; color: #374151;">• 可添加、删除产品项，每个分类可独立管理</p>
                    <p style="margin: 0; color: #374151;"><strong>操作效果</strong>：修改后会在产品系列页面主区域显示，用户可通过筛选标签查看不同分类的产品</p>
                </div>
            </div>
            
            <div id="cases" style="margin-bottom: 40px; padding: 20px; background: #f8fafc; border-radius: 12px; border-left: 4px solid #ec4899;">
                <h3 style="color: #ec4899; font-size: 20px; margin-bottom: 16px;">🏛️ 高定案例</h3>
                <div style="margin-bottom: 16px;">
                    <h4 style="color: #1f2937; font-size: 16px; margin-bottom: 8px; font-weight: 600;">页面头部</h4>
                    <p style="margin: 0 0 8px 0; color: #374151;">• 设置案例页面的标题、副标题和背景图片</p>
                    <p style="margin: 0; color: #374151;"><strong>操作效果</strong>：修改后会在案例页面顶部显示</p>
                </div>
                <div style="margin-bottom: 16px;">
                    <h4 style="color: #1f2937; font-size: 16px; margin-bottom: 8px; font-weight: 600;">重点案例</h4>
                    <p style="margin: 0 0 8px 0; color: #374151;">• 管理重点展示的案例，分为"small区域"和"large区域"</p>
                    <p style="margin: 0 0 8px 0; color: #374151;">• small区域显示3个案例，large区域显示2个案例</p>
                    <p style="margin: 0 0 8px 0; color: #374151;">• 每个案例可设置标题、描述、主图片和图片列表</p>
                    <p style="margin: 0 0 8px 0; color: #374151;">• 图片列表可添加多张图片，点击案例图片可查看大图和所有图片</p>
                    <p style="margin: 0; color: #374151;"><strong>操作效果</strong>：修改后会在案例页面顶部重点展示区域显示</p>
                </div>
                <div>
                    <h4 style="color: #1f2937; font-size: 16px; margin-bottom: 8px; font-weight: 600;">案例网格</h4>
                    <p style="margin: 0 0 8px 0; color: #374151;">• 管理案例网格展示区域，每个案例组包含标题、描述、图片和图片列表</p>
                    <p style="margin: 0 0 8px 0; color: #374151;">• 可添加、删除案例组</p>
                    <p style="margin: 0 0 8px 0; color: #374151;">• 点击案例图片可查看大图和所有图片</p>
                    <p style="margin: 0; color: #374151;"><strong>操作效果</strong>：修改后会在案例页面网格区域显示</p>
                </div>
            </div>
            
            <div id="service" style="margin-bottom: 40px; padding: 20px; background: #f8fafc; border-radius: 12px; border-left: 4px solid #06b6d4;">
                <h3 style="color: #06b6d4; font-size: 20px; margin-bottom: 16px;">⚙️ 服务流程</h3>
                <div style="margin-bottom: 16px;">
                    <h4 style="color: #1f2937; font-size: 16px; margin-bottom: 8px; font-weight: 600;">服务流程</h4>
                    <p style="margin: 0 0 8px 0; color: #374151;">• 管理服务流程步骤，每个步骤包含标题、描述、图标</p>
                    <p style="margin: 0 0 8px 0; color: #374151;">• 可添加、删除流程步骤</p>
                    <p style="margin: 0; color: #374151;"><strong>操作效果</strong>：修改后会在服务流程页面显示</p>
                </div>
                <div style="margin-bottom: 16px;">
                    <h4 style="color: #1f2937; font-size: 16px; margin-bottom: 8px; font-weight: 600;">服务优势</h4>
                    <p style="margin: 0 0 8px 0; color: #374151;">• 管理服务优势展示，每个优势包含标题、描述</p>
                    <p style="margin: 0 0 8px 0; color: #374151;">• 优势项会显示编号（01、02等）</p>
                    <p style="margin: 0 0 8px 0; color: #374151;">• 可添加、删除优势项</p>
                    <p style="margin: 0; color: #374151;"><strong>操作效果</strong>：修改后会在服务流程页面显示</p>
                </div>
                <div>
                    <h4 style="color: #1f2937; font-size: 16px; margin-bottom: 8px; font-weight: 600;">预约表单</h4>
                    <p style="margin: 0 0 8px 0; color: #374151;">• 管理预约表单的标题和按钮文本</p>
                    <p style="margin: 0; color: #374151;"><strong>操作效果</strong>：修改后会在服务流程页面预约表单区域显示</p>
                </div>
            </div>
            
            <div id="about" style="margin-bottom: 40px; padding: 20px; background: #f8fafc; border-radius: 12px; border-left: 4px solid #14b8a6;">
                <h3 style="color: #14b8a6; font-size: 20px; margin-bottom: 16px;">ℹ️ 关于我们</h3>
                <div style="margin-bottom: 16px;">
                    <h4 style="color: #1f2937; font-size: 16px; margin-bottom: 8px; font-weight: 600;">头图</h4>
                    <p style="margin: 0 0 8px 0; color: #374151;">• 设置关于我们页面的顶部大图</p>
                    <p style="margin: 0; color: #374151;"><strong>操作效果</strong>：修改后会在关于我们页面顶部显示</p>
                </div>
                <div style="margin-bottom: 16px;">
                    <h4 style="color: #1f2937; font-size: 16px; margin-bottom: 8px; font-weight: 600;">品牌故事</h4>
                    <p style="margin: 0 0 8px 0; color: #374151;">• 管理品牌故事内容，可添加多个段落</p>
                    <p style="margin: 0 0 8px 0; color: #374151;">• 每个段落使用文本域编辑，支持长文本</p>
                    <p style="margin: 0 0 8px 0; color: #374151;">• 可添加、删除段落</p>
                    <p style="margin: 0; color: #374151;"><strong>操作效果</strong>：修改后会在关于我们页面品牌故事区域显示</p>
                </div>
                <div>
                    <h4 style="color: #1f2937; font-size: 16px; margin-bottom: 8px; font-weight: 600;">发展历程</h4>
                    <p style="margin: 0 0 8px 0; color: #374151;">• 管理公司发展历程时间线，每个时间点包含年份、标题、描述</p>
                    <p style="margin: 0 0 8px 0; color: #374151;">• 可添加、删除时间线项</p>
                    <p style="margin: 0; color: #374151;"><strong>操作效果</strong>：修改后会在关于我们页面发展历程区域显示</p>
                </div>
            </div>
            
            <div id="contact" style="margin-bottom: 40px; padding: 20px; background: #f8fafc; border-radius: 12px; border-left: 4px solid #f97316;">
                <h3 style="color: #f97316; font-size: 20px; margin-bottom: 16px;">📞 联系我们</h3>
                <div style="margin-bottom: 16px;">
                    <h4 style="color: #1f2937; font-size: 16px; margin-bottom: 8px; font-weight: 600;">页面头部</h4>
                    <p style="margin: 0 0 8px 0; color: #374151;">• 设置联系我们页面的标题和副标题</p>
                    <p style="margin: 0; color: #374151;"><strong>操作效果</strong>：修改后会在联系我们页面顶部显示</p>
                </div>
                <div style="margin-bottom: 16px;">
                    <h4 style="color: #1f2937; font-size: 16px; margin-bottom: 8px; font-weight: 600;">客户服务</h4>
                    <p style="margin: 0 0 8px 0; color: #374151;">• 管理客户服务信息，包括服务描述、营业时间</p>
                    <p style="margin: 0 0 8px 0; color: #374151;">• 营业时间可添加多条，每条显示为一行</p>
                    <p style="margin: 0 0 8px 0; color: #374151;">• 可控制"在线咨询"和"在线客服"图标的显示/隐藏</p>
                    <p style="margin: 0; color: #374151;"><strong>操作效果</strong>：修改后会在联系我们页面客户服务区域显示</p>
                </div>
                <div style="margin-bottom: 16px;">
                    <h4 style="color: #1f2937; font-size: 16px; margin-bottom: 8px; font-weight: 600;">公司信息</h4>
                    <p style="margin: 0 0 8px 0; color: #374151;">• 管理公司信息，包括服务热线、公司地址</p>
                    <p style="margin: 0; color: #374151;"><strong>操作效果</strong>：修改后会在联系我们页面公司信息区域显示</p>
                </div>
                <div>
                    <h4 style="color: #1f2937; font-size: 16px; margin-bottom: 8px; font-weight: 600;">在线留言</h4>
                    <p style="margin: 0 0 8px 0; color: #374151;">• 管理在线留言表单的标题和提交按钮文本</p>
                    <p style="margin: 0; color: #374151;"><strong>操作效果</strong>：修改后会在联系我们页面在线留言表单区域显示</p>
                </div>
            </div>
            
            <div id="tips" style="margin-bottom: 40px; padding: 20px; background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border-radius: 12px; border-left: 4px solid #f59e0b;">
                <h3 style="color: #f59e0b; font-size: 20px; margin-bottom: 16px;">💡 操作提示</h3>
                <div style="margin-bottom: 16px;">
                    <h4 style="color: #1f2937; font-size: 16px; margin-bottom: 8px; font-weight: 600;">图片上传</h4>
                    <p style="margin: 0 0 8px 0; color: #374151;">• 点击"上传图片"按钮选择图片文件</p>
                    <p style="margin: 0 0 8px 0; color: #374151;">• 上传成功后图片路径会自动填入输入框</p>
                    <p style="margin: 0 0 8px 0; color: #374151;">• 也可以直接输入图片路径（如：images/xxx.jpg）</p>
                </div>
                <div style="margin-bottom: 16px;">
                    <h4 style="color: #1f2937; font-size: 16px; margin-bottom: 8px; font-weight: 600;">预览功能</h4>
                    <p style="margin: 0 0 8px 0; color: #374151;">• 使用预览功能可在新窗口中查看修改效果</p>
                    <p style="margin: 0 0 8px 0; color: #374151;">• 预览窗口支持不同设备尺寸查看（桌面、平板、手机）</p>
                    <p style="margin: 0; color: #374151;">• 预览内容基于草稿，不会影响正式网站</p>
                </div>
                <div style="margin-bottom: 16px;">
                    <h4 style="color: #1f2937; font-size: 16px; margin-bottom: 8px; font-weight: 600;">保存与发布</h4>
                    <p style="margin: 0 0 8px 0; color: #374151;">• <strong>保存</strong>：将修改保存到草稿，可随时继续编辑</p>
                    <p style="margin: 0 0 8px 0; color: #374151;">• <strong>发布</strong>：将草稿内容发布到网站，用户才能看到</p>
                    <p style="margin: 0 0 8px 0; color: #374151;">• 有未发布内容时，系统会提示需要发布的内容</p>
                    <p style="margin: 0; color: #374151;">• 建议先保存草稿，确认无误后再发布</p>
                </div>
                <div>
                    <h4 style="color: #1f2937; font-size: 16px; margin-bottom: 8px; font-weight: 600;">注意事项</h4>
                    <p style="margin: 0 0 8px 0; color: #374151;">• 修改内容后必须点击"保存"才能保存到草稿</p>
                    <p style="margin: 0 0 8px 0; color: #374151;">• 只有发布后，用户才能看到最新内容</p>
                    <p style="margin: 0 0 8px 0; color: #374151;">• "恢复默认"操作不可撤销，请谨慎使用</p>
                    <p style="margin: 0 0 8px 0; color: #374151;">• 删除操作（如删除产品、案例等）会立即生效，点击页面刷新可恢复</p>
                    <p style="margin: 0; color: #374151;">• 所有操作都会记录在操作日志中，可随时查看</p>
                </div>
            </div>
        </div>
    `;
}

// 初始化帮助模块
export function initHelpModule() {
    const helpBtn = document.getElementById('helpBtn');
    const helpModal = document.getElementById('helpModal');
    
    if (helpBtn) {
        helpBtn.addEventListener('click', () => {
            showHelpModal();
        });
    }
    
    // 点击模态框外部关闭
    if (helpModal) {
        helpModal.addEventListener('click', (e) => {
            if (e.target === helpModal) {
                closeHelpModal();
            }
        });
    }
    
    // 导出到全局，供HTML中的onclick使用
    window.showHelpModal = showHelpModal;
    window.closeHelpModal = closeHelpModal;
}

