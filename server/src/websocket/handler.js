import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger.js';
import { dbGet, dbRun, dbAll } from '../database/init.js';

// 存储活跃的WebSocket连接
const activeConnections = new Map();

// JWT密钥
const JWT_SECRET = process.env.JWT_SECRET || 'ecopaste-default-secret-key';

// 消息类型
const MESSAGE_TYPES = {
  AUTH: 'auth',
  SYNC: 'sync',
  PING: 'ping',
  PONG: 'pong',
  ERROR: 'error',
  SUCCESS: 'success',
  CLIPBOARD_UPDATE: 'clipboard_update',
  DEVICE_STATUS: 'device_status'
};

// WebSocket连接处理
export function handleWebSocketConnection(ws, req) {
  const connectionId = uuidv4();
  let userId = null;
  let deviceId = null;
  
  logger.info(`新的WebSocket连接: ${connectionId}`);
  
  // 连接超时处理
  const authTimeout = setTimeout(() => {
    if (!userId) {
      ws.close(1008, '认证超时');
      logger.warn(`连接 ${connectionId} 认证超时`);
    }
  }, 30000); // 30秒认证超时

  // 心跳检测
  let heartbeatInterval;
  
  ws.on('message', async (data) => {
    try {
      const message = JSON.parse(data.toString());
      await handleMessage(ws, message, connectionId);
    } catch (error) {
      logger.error(`处理消息失败 ${connectionId}:`, error);
      sendError(ws, '消息格式错误');
    }
  });

  ws.on('close', (code, reason) => {
    clearTimeout(authTimeout);
    clearInterval(heartbeatInterval);
    
    if (userId && deviceId) {
      activeConnections.delete(`${userId}-${deviceId}`);
      updateDeviceStatus(deviceId, false);
      broadcastDeviceStatus(userId, deviceId, false);
    }
    
    logger.info(`WebSocket连接关闭: ${connectionId}, 代码: ${code}, 原因: ${reason}`);
  });

  ws.on('error', (error) => {
    logger.error(`WebSocket错误 ${connectionId}:`, error);
  });

  // 处理消息
  async function handleMessage(ws, message, connectionId) {
    const { type, data } = message;

    switch (type) {
      case MESSAGE_TYPES.AUTH:
        await handleAuth(ws, data, connectionId);
        break;
        
      case MESSAGE_TYPES.SYNC:
        await handleSync(ws, data, connectionId);
        break;
        
      case MESSAGE_TYPES.PING:
        sendMessage(ws, MESSAGE_TYPES.PONG, { timestamp: Date.now() });
        break;
        
      case MESSAGE_TYPES.CLIPBOARD_UPDATE:
        await handleClipboardUpdate(ws, data, connectionId);
        break;
        
      default:
        sendError(ws, `未知消息类型: ${type}`);
    }
  }

  // 处理认证
  async function handleAuth(ws, data, connectionId) {
    try {
      const { token, deviceId: clientDeviceId } = data;
      
      if (!token || !clientDeviceId) {
        sendError(ws, '缺少认证信息');
        return;
      }

      // 验证JWT token
      const decoded = jwt.verify(token, JWT_SECRET);
      const { userId: tokenUserId, deviceId: tokenDeviceId } = decoded;

      if (tokenDeviceId !== clientDeviceId) {
        sendError(ws, '设备ID不匹配');
        return;
      }

      // 验证设备是否存在
      const device = await dbGet(
        'SELECT * FROM devices WHERE id = ? AND user_id = ? AND is_active = 1',
        [clientDeviceId, tokenUserId]
      );

      if (!device) {
        sendError(ws, '设备不存在或已禁用');
        return;
      }

      // 认证成功
      userId = tokenUserId;
      deviceId = clientDeviceId;
      
      clearTimeout(authTimeout);
      
      // 存储连接
      activeConnections.set(`${userId}-${deviceId}`, {
        ws,
        userId,
        deviceId,
        connectionId,
        connectedAt: new Date()
      });

      // 更新设备状态
      await updateDeviceStatus(deviceId, true);
      
      // 启动心跳
      startHeartbeat(ws);
      
      // 发送认证成功消息
      sendMessage(ws, MESSAGE_TYPES.SUCCESS, {
        message: '认证成功',
        userId,
        deviceId
      });
      
      // 广播设备上线状态
      broadcastDeviceStatus(userId, deviceId, true);
      
      logger.info(`用户 ${userId} 设备 ${deviceId} 认证成功`);
      
    } catch (error) {
      logger.error('认证失败:', error);
      sendError(ws, '认证失败');
    }
  }

  // 处理同步请求
  async function handleSync(ws, data, connectionId) {
    if (!userId || !deviceId) {
      sendError(ws, '未认证');
      return;
    }

    try {
      const { lastSyncTime } = data;
      
      // 获取自上次同步以来的更新
      const updates = await dbAll(
        `SELECT ci.*, d.name as device_name 
         FROM clipboard_items ci 
         JOIN devices d ON ci.device_id = d.id 
         WHERE ci.user_id = ? AND ci.updated_at > ? AND ci.is_deleted = 0
         ORDER BY ci.updated_at ASC`,
        [userId, lastSyncTime || '1970-01-01']
      );

      sendMessage(ws, MESSAGE_TYPES.SUCCESS, {
        type: 'sync_data',
        updates,
        syncTime: new Date().toISOString()
      });
      
      logger.debug(`为用户 ${userId} 设备 ${deviceId} 同步了 ${updates.length} 条记录`);
      
    } catch (error) {
      logger.error('同步失败:', error);
      sendError(ws, '同步失败');
    }
  }

  // 处理剪贴板更新
  async function handleClipboardUpdate(ws, data, connectionId) {
    if (!userId || !deviceId) {
      sendError(ws, '未认证');
      return;
    }

    try {
      const { id, type, content, metadata, hash } = data;
      
      if (!id || !type || !content || !hash) {
        sendError(ws, '剪贴板数据不完整');
        return;
      }

      // 检查是否已存在相同hash的数据
      const existing = await dbGet(
        'SELECT id FROM clipboard_items WHERE user_id = ? AND hash = ? AND is_deleted = 0',
        [userId, hash]
      );

      if (existing) {
        logger.debug(`重复的剪贴板数据，跳过: ${hash}`);
        return;
      }

      // 插入新的剪贴板数据
      await dbRun(
        `INSERT INTO clipboard_items (id, user_id, device_id, type, content, metadata, hash, size)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, userId, deviceId, type, content, JSON.stringify(metadata || {}), hash, content.length]
      );

      // 记录同步操作
      await dbRun(
        'INSERT INTO sync_records (user_id, device_id, item_id, action, status) VALUES (?, ?, ?, ?, ?)',
        [userId, deviceId, id, 'create', 'completed']
      );

      // 广播给其他设备
      broadcastToUserDevices(userId, deviceId, MESSAGE_TYPES.CLIPBOARD_UPDATE, {
        id,
        type,
        content,
        metadata,
        hash,
        deviceId,
        timestamp: new Date().toISOString()
      });

      sendMessage(ws, MESSAGE_TYPES.SUCCESS, {
        message: '剪贴板数据已同步',
        itemId: id
      });
      
      logger.info(`用户 ${userId} 设备 ${deviceId} 更新剪贴板: ${type}`);
      
    } catch (error) {
      logger.error('处理剪贴板更新失败:', error);
      sendError(ws, '剪贴板更新失败');
    }
  }

  // 启动心跳
  function startHeartbeat(ws) {
    heartbeatInterval = setInterval(() => {
      if (ws.readyState === ws.OPEN) {
        sendMessage(ws, MESSAGE_TYPES.PING, { timestamp: Date.now() });
      } else {
        clearInterval(heartbeatInterval);
      }
    }, 30000); // 30秒心跳
  }
}

// 发送消息
function sendMessage(ws, type, data) {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify({ type, data, timestamp: Date.now() }));
  }
}

// 发送错误消息
function sendError(ws, message) {
  sendMessage(ws, MESSAGE_TYPES.ERROR, { message });
}

// 更新设备状态
async function updateDeviceStatus(deviceId, isActive) {
  try {
    await dbRun(
      'UPDATE devices SET is_active = ?, last_seen = CURRENT_TIMESTAMP WHERE id = ?',
      [isActive ? 1 : 0, deviceId]
    );
  } catch (error) {
    logger.error('更新设备状态失败:', error);
  }
}

// 广播设备状态
function broadcastDeviceStatus(userId, deviceId, isOnline) {
  broadcastToUserDevices(userId, deviceId, MESSAGE_TYPES.DEVICE_STATUS, {
    deviceId,
    isOnline,
    timestamp: new Date().toISOString()
  });
}

// 广播消息给用户的其他设备
function broadcastToUserDevices(userId, excludeDeviceId, messageType, data) {
  activeConnections.forEach((connection, key) => {
    const [connUserId, connDeviceId] = key.split('-');
    
    if (connUserId === userId.toString() && connDeviceId !== excludeDeviceId) {
      sendMessage(connection.ws, messageType, data);
    }
  });
}

// 获取活跃连接统计
export function getConnectionStats() {
  const stats = {
    totalConnections: activeConnections.size,
    userConnections: {},
    deviceConnections: []
  };

  activeConnections.forEach((connection, key) => {
    const [userId, deviceId] = key.split('-');
    
    if (!stats.userConnections[userId]) {
      stats.userConnections[userId] = 0;
    }
    stats.userConnections[userId]++;
    
    stats.deviceConnections.push({
      userId,
      deviceId,
      connectedAt: connection.connectedAt
    });
  });

  return stats;
}

export { activeConnections };