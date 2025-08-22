import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { dbGet, dbRun, dbAll } from '../database/init.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

// JWT配置
const JWT_SECRET = process.env.JWT_SECRET || 'ecopaste-default-secret-key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

// 密码加密轮数
const SALT_ROUNDS = 12;

// 用户注册
router.post('/register', async (req, res) => {
  try {
    const { username, password, email, deviceName, deviceType, platform } = req.body;
    
    // 记录注册请求详情
    logger.info('收到注册请求:', {
      username,
      email,
      deviceName,
      deviceType,
      platform,
      hasPassword: !!password,
      requestBody: JSON.stringify(req.body)
    });

    // 验证必填字段
    if (!username || !password || !deviceName) {
      logger.warn('注册请求缺少必填字段:', {
        username: !!username,
        password: !!password,
        deviceName: !!deviceName
      });
      return res.status(400).json({
        error: '缺少必填字段',
        required: ['username', 'password', 'deviceName']
      });
    }

    // 验证用户名长度
    if (username.length < 3 || username.length > 50) {
      logger.warn('用户名长度不符合要求:', { username, length: username.length });
      return res.status(400).json({
        error: '用户名长度必须在3-50个字符之间'
      });
    }

    // 验证密码强度
    if (password.length < 6) {
      logger.warn('密码长度不符合要求:', { passwordLength: password.length });
      return res.status(400).json({
        error: '密码长度至少6个字符'
      });
    }

    // 检查用户名是否已存在
    const existingUser = await dbGet(
      'SELECT id FROM users WHERE username = ?',
      [username]
    );

    if (existingUser) {
      logger.warn('用户名已存在:', { username });
      return res.status(409).json({
        error: '用户名已存在'
      });
    }

    // 加密密码
    logger.info('开始创建用户:', { username });
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    // 创建用户
    const userResult = await dbRun(
      'INSERT INTO users (username, password_hash, email) VALUES (?, ?, ?)',
      [username, passwordHash, email || null]
    );

    const userId = userResult.lastID;
    const deviceId = uuidv4();
    logger.info('用户创建成功:', { userId, username });

    // 创建设备
    logger.info('开始创建设备:', { deviceId, deviceName, deviceType, platform });
    await dbRun(
      'INSERT INTO devices (id, user_id, name, type, platform) VALUES (?, ?, ?, ?, ?)',
      [deviceId, userId, deviceName, deviceType || 'desktop', platform || 'unknown']
    );
    logger.info('设备创建成功:', { deviceId, deviceName });

    // 生成JWT token
    const token = jwt.sign(
      { userId, deviceId, username },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    // 创建会话
    const sessionId = uuidv4();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7天后过期
    
    await dbRun(
      'INSERT INTO sessions (id, user_id, device_id, token, expires_at) VALUES (?, ?, ?, ?, ?)',
      [sessionId, userId, deviceId, token, expiresAt.toISOString()]
    );

    logger.info('注册流程完成，准备返回响应:', {
      userId,
      username,
      deviceId,
      deviceName,
      sessionId
    });

    const response = {
      success: true,
      message: '注册成功',
      user: {
        id: userId,
        username,
        email
      },
      device: {
        id: deviceId,
        name: deviceName,
        type: deviceType || 'desktop'
      },
      token,
      expiresAt: expiresAt.toISOString()
    };

    logger.info('发送注册成功响应:', { userId, username, deviceId });
    res.status(201).json(response);

  } catch (error) {
    logger.error('用户注册失败:', {
      error: error.message,
      stack: error.stack,
      requestBody: { username, email, deviceName, deviceType, platform }
    });
    res.status(500).json({
      success: false,
      error: '注册失败',
      message: '服务器内部错误'
    });
  }
});

// 用户登录
router.post('/login', async (req, res) => {
  try {
    const { username, password, deviceName, deviceType, platform } = req.body;

    if (!username || !password || !deviceName) {
      return res.status(400).json({
        error: '缺少必填字段',
        required: ['username', 'password', 'deviceName']
      });
    }

    // 查找用户
    const user = await dbGet(
      'SELECT id, username, password_hash, email FROM users WHERE username = ?',
      [username]
    );

    if (!user) {
      return res.status(401).json({
        error: '用户名或密码错误'
      });
    }

    // 验证密码
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({
        error: '用户名或密码错误'
      });
    }

    // 查找或创建设备
    let device = await dbGet(
      'SELECT id, name, type FROM devices WHERE user_id = ? AND name = ?',
      [user.id, deviceName]
    );

    let deviceId;
    if (device) {
      deviceId = device.id;
      // 更新设备信息
      await dbRun(
        'UPDATE devices SET type = ?, platform = ?, last_seen = CURRENT_TIMESTAMP WHERE id = ?',
        [deviceType || device.type, platform || 'unknown', deviceId]
      );
    } else {
      // 创建新设备
      deviceId = uuidv4();
      await dbRun(
        'INSERT INTO devices (id, user_id, name, type, platform) VALUES (?, ?, ?, ?, ?)',
        [deviceId, user.id, deviceName, deviceType || 'desktop', platform || 'unknown']
      );
    }

    // 生成JWT token
    const token = jwt.sign(
      { userId: user.id, deviceId, username: user.username },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    // 创建会话
    const sessionId = uuidv4();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    
    await dbRun(
      'INSERT INTO sessions (id, user_id, device_id, token, expires_at) VALUES (?, ?, ?, ?, ?)',
      [sessionId, user.id, deviceId, token, expiresAt.toISOString()]
    );

    logger.info(`用户登录成功: ${username} (${user.id}) 设备: ${deviceName}`);

    res.json({
      message: '登录成功',
      user: {
        id: user.id,
        username: user.username,
        email: user.email
      },
      device: {
        id: deviceId,
        name: deviceName,
        type: deviceType || 'desktop'
      },
      token,
      expiresAt: expiresAt.toISOString()
    });

  } catch (error) {
    logger.error('用户登录失败:', error);
    res.status(500).json({
      error: '登录失败',
      message: '服务器内部错误'
    });
  }
});

// 刷新token
router.post('/refresh', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        error: '缺少token'
      });
    }

    // 验证token
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (error) {
      return res.status(401).json({
        error: 'token无效或已过期'
      });
    }

    const { userId, deviceId, username } = decoded;

    // 检查会话是否存在
    const session = await dbGet(
      'SELECT id FROM sessions WHERE user_id = ? AND device_id = ? AND token = ? AND expires_at > datetime("now")',
      [userId, deviceId, token]
    );

    if (!session) {
      return res.status(401).json({
        error: '会话不存在或已过期'
      });
    }

    // 生成新token
    const newToken = jwt.sign(
      { userId, deviceId, username },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    // 更新会话
    await dbRun(
      'UPDATE sessions SET token = ?, expires_at = ? WHERE id = ?',
      [newToken, newExpiresAt.toISOString(), session.id]
    );

    res.json({
      message: 'token刷新成功',
      token: newToken,
      expiresAt: newExpiresAt.toISOString()
    });

  } catch (error) {
    logger.error('token刷新失败:', error);
    res.status(500).json({
      error: 'token刷新失败',
      message: '服务器内部错误'
    });
  }
});

// 登出
router.post('/logout', async (req, res) => {
  try {
    const { token } = req.body;

    if (token) {
      // 删除会话
      await dbRun(
        'DELETE FROM sessions WHERE token = ?',
        [token]
      );
    }

    res.json({
      message: '登出成功'
    });

  } catch (error) {
    logger.error('登出失败:', error);
    res.status(500).json({
      error: '登出失败',
      message: '服务器内部错误'
    });
  }
});

// 获取当前用户信息
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await dbGet(
      'SELECT id, username, email, created_at FROM users WHERE id = ?',
      [req.user.userId]
    );

    if (!user) {
      return res.status(404).json({
        error: '用户不存在'
      });
    }

    res.json({
      id: user.id,
      username: user.username,
      email: user.email,
      created_at: user.created_at
    });

  } catch (error) {
    logger.error('获取用户信息失败:', error);
    res.status(500).json({
      error: '获取用户信息失败',
      message: '服务器内部错误'
    });
  }
});

// 验证token中间件
export function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      error: '缺少访问token'
    });
  }

  jwt.verify(token, JWT_SECRET, async (err, decoded) => {
    if (err) {
      return res.status(403).json({
        error: 'token无效或已过期'
      });
    }

    // 检查会话是否有效
    try {
      const session = await dbGet(
        'SELECT id FROM sessions WHERE user_id = ? AND device_id = ? AND token = ? AND expires_at > datetime("now")',
        [decoded.userId, decoded.deviceId, token]
      );

      if (!session) {
        return res.status(403).json({
          error: '会话已过期'
        });
      }

      req.user = decoded;
      next();
    } catch (error) {
      logger.error('验证会话失败:', error);
      res.status(500).json({
        error: '验证失败'
      });
    }
  });
}

export default router;