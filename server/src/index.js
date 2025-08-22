import express from 'express';
import { WebSocketServer } from 'ws';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// 导入路由和服务
import authRoutes from './routes/auth.js';
import deviceRoutes from './routes/device.js';
import syncRoutes from './routes/sync.js';
import { initDatabase } from './database/init.js';
import { handleWebSocketConnection } from './websocket/handler.js';
import { logger } from './utils/logger.js';

// 配置环境变量
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// 中间件配置
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || [
    'http://localhost:1420',
    'http://localhost:3000', 
    'http://127.0.0.1:1420',
    'file://', // 允许本地文件访问
    null // 允许null origin的请求
  ],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// 静态文件服务
app.use('/static', express.static(join(__dirname, '../public')));

// API 路由
app.use('/api/auth', authRoutes);
app.use('/api/device', deviceRoutes);
app.use('/api/sync', syncRoutes);

// 健康检查
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// 根路径
app.get('/', (req, res) => {
  res.json({
    name: 'EcoPaste Sync Server',
    version: '1.0.0',
    description: '简单易部署的剪贴板同步服务器',
    endpoints: {
      health: '/health',
      auth: '/api/auth',
      device: '/api/device',
      sync: '/api/sync',
      websocket: 'ws://localhost:' + PORT + '/ws'
    }
  });
});

// 错误处理中间件
app.use((err, req, res, next) => {
  logger.error('服务器错误:', err);
  res.status(500).json({
    error: '服务器内部错误',
    message: process.env.NODE_ENV === 'development' ? err.message : '请稍后重试'
  });
});

// 404 处理
app.use('*', (req, res) => {
  res.status(404).json({
    error: '接口不存在',
    path: req.originalUrl
  });
});

// 创建 HTTP 服务器
const server = createServer(app);

// 创建 WebSocket 服务器
const wss = new WebSocketServer({ 
  server,
  path: '/ws'
});

// WebSocket 连接处理
wss.on('connection', handleWebSocketConnection);

// 启动服务器
async function startServer() {
  try {
    // 初始化数据库
    await initDatabase();
    logger.info('数据库初始化完成');

    // 启动服务器
    server.listen(PORT, () => {
      logger.info(`🚀 EcoPaste 同步服务器启动成功!`);
      logger.info(`📡 HTTP 服务: http://localhost:${PORT}`);
      logger.info(`🔌 WebSocket 服务: ws://localhost:${PORT}/ws`);
      logger.info(`📊 健康检查: http://localhost:${PORT}/health`);
      logger.info(`📖 API 文档: http://localhost:${PORT}`);
    });

    // 优雅关闭
    process.on('SIGTERM', gracefulShutdown);
    process.on('SIGINT', gracefulShutdown);

  } catch (error) {
    logger.error('服务器启动失败:', error);
    process.exit(1);
  }
}

// 优雅关闭函数
function gracefulShutdown(signal) {
  logger.info(`收到 ${signal} 信号，开始优雅关闭...`);
  
  server.close(() => {
    logger.info('HTTP 服务器已关闭');
    
    wss.close(() => {
      logger.info('WebSocket 服务器已关闭');
      process.exit(0);
    });
  });

  // 强制关闭超时
  setTimeout(() => {
    logger.error('强制关闭服务器');
    process.exit(1);
  }, 10000);
}

// 启动服务器
startServer();

export { app, wss };