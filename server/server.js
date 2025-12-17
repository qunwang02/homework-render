const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const rateLimit = require('express-rate-limit');
const database = require('./database'); // 立即导入

const app = express();

// 基础中间件
	app.use(
	  helmet({
		contentSecurityPolicy: {
		  directives: {
			defaultSrc: ["'self'"],
			scriptSrc: ["'self'", "'unsafe-inline'"], // 允许内联脚本
			 scriptSrcAttr: ["'unsafe-inline'"], // ⭐ 新增：允许onclick等内联事件处理器
			styleSrc: ["'self'", "'unsafe-inline'"],
			imgSrc: ["'self'", "data:", "https:"],
		  },
		},
	  })
	);
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 请求日志
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { success: false, error: '请求过于频繁，请稍后再试' }, // 保持JSON格式
  standardHeaders: true,
  legacyHeaders: false,
  // 🔐 关键修复配置：
  validate: { trustProxy: false }, // 告诉限流器我们已自行处理代理信任问题
  keyGenerator: (req, res) => {
    // 从X-Forwarded-For头部安全地提取客户端IP
    const forwarded = req.headers['x-forwarded-for'];
    const clientIp = forwarded ? forwarded.split(',')[0].trim() : req.ip;
    console.log(`[限流] 客户端IP: ${clientIp}`); // 可选：日志记录
    return clientIp;
  }
});

// ✅ 正确的顺序：先加载API路由
const routes = require('./routes');
app.use('/api', routes); // 所有 `/api` 开头的请求都由 `routes.js` 处理
console.log('✅ API路由已加载');

// ✅ 然后，再提供静态文件（如HTML、CSS、JS）
app.use(express.static(path.join(__dirname, '../public')));

// ✅ 主页和管理页面路由（这些不是API，应放在静态文件服务之后或之前，但需确保路径不冲突）
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});
app.get('/manage', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/admin.html'));
});

// 404处理
app.use((req, res) => {
  res.status(404).json({ 
    success: false, 
    error: '请求的资源不存在',
    path: req.path
  });
});

// 错误处理
app.use((err, req, res, next) => {
  console.error('服务器错误:', err);
  res.status(500).json({ 
    success: false, 
    error: process.env.NODE_ENV === 'development' ? err.message : '服务器内部错误'
  });
});

// 启动服务器
const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log(`🚀 服务器正在端口 ${PORT} 上运行`);
  console.log(`📡 访问地址: http://localhost:${PORT}`);
  console.log(`🔧 环境: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📊 管理页面: http://localhost:${PORT}/manage`);
  
  // 延迟连接数据库
  setTimeout(async () => {
    try {
      await database.connect();
      console.log('✅ 数据库连接成功');
    } catch (error) {
      console.error('⚠️ 数据库连接失败，但服务器继续运行:', error.message);
    }
  }, 3000);
});
