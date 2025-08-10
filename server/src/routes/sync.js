import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { dbGet, dbRun, dbAll } from '../database/init.js';
import { logger } from '../utils/logger.js';
import { authenticateToken } from './auth.js';

const router = express.Router();

// 获取同步数据
router.get('/data', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.user;
    const { lastSyncTime, limit = 100, offset = 0 } = req.query;

    let whereClause = 'ci.user_id = ? AND ci.is_deleted = 0';
    let params = [userId];

    if (lastSyncTime) {
      whereClause += ' AND ci.updated_at > ?';
      params.push(lastSyncTime);
    }

    const items = await dbAll(
      `SELECT ci.*, d.name as device_name, d.type as device_type
       FROM clipboard_items ci
       JOIN devices d ON ci.device_id = d.id
       WHERE ${whereClause}
       ORDER BY ci.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), parseInt(offset)]
    );

    // 获取总数
    const countResult = await dbGet(
      `SELECT COUNT(*) as total
       FROM clipboard_items ci
       WHERE ${whereClause}`,
      params
    );

    res.json({
      items: items.map(item => ({
        ...item,
        metadata: item.metadata ? JSON.parse(item.metadata) : {}
      })),
      total: countResult.total,
      syncTime: new Date().toISOString()
    });

  } catch (error) {
    logger.error('获取同步数据失败:', error);
    res.status(500).json({
      error: '获取同步数据失败'
    });
  }
});

// 上传剪贴板数据
router.post('/upload', authenticateToken, async (req, res) => {
  try {
    const { userId, deviceId } = req.user;
    const { items } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        error: '无效的数据格式'
      });
    }

    const results = [];
    const errors = [];

    for (const item of items) {
      try {
        const { id, type, content, metadata } = item;

        if (!id || !type || !content) {
          errors.push({
            item: id || 'unknown',
            error: '缺少必填字段'
          });
          continue;
        }

        // 生成内容哈希
        const hash = crypto.createHash('sha256').update(content).digest('hex');

        // 检查是否已存在
        const existing = await dbGet(
          'SELECT id FROM clipboard_items WHERE user_id = ? AND hash = ? AND is_deleted = 0',
          [userId, hash]
        );

        if (existing) {
          results.push({
            id,
            status: 'skipped',
            reason: 'duplicate'
          });
          continue;
        }

        // 插入新数据
        await dbRun(
          `INSERT INTO clipboard_items (id, user_id, device_id, type, content, metadata, hash, size)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            id,
            userId,
            deviceId,
            type,
            content,
            JSON.stringify(metadata || {}),
            hash,
            content.length
          ]
        );

        // 记录同步操作
        await dbRun(
          'INSERT INTO sync_records (user_id, device_id, item_id, action, status) VALUES (?, ?, ?, ?, ?)',
          [userId, deviceId, id, 'upload', 'completed']
        );

        results.push({
          id,
          status: 'success'
        });

      } catch (itemError) {
        logger.error(`处理项目失败 ${item.id}:`, itemError);
        errors.push({
          item: item.id || 'unknown',
          error: itemError.message
        });
      }
    }

    logger.info(`用户 ${userId} 设备 ${deviceId} 上传 ${results.length} 个项目`);

    res.json({
      message: '数据上传完成',
      results,
      errors,
      summary: {
        total: items.length,
        success: results.filter(r => r.status === 'success').length,
        skipped: results.filter(r => r.status === 'skipped').length,
        failed: errors.length
      }
    });

  } catch (error) {
    logger.error('上传剪贴板数据失败:', error);
    res.status(500).json({
      error: '上传数据失败'
    });
  }
});

// 删除剪贴板项目
router.delete('/items/:itemId', authenticateToken, async (req, res) => {
  try {
    const { userId, deviceId } = req.user;
    const { itemId } = req.params;

    // 验证项目所有权
    const item = await dbGet(
      'SELECT id FROM clipboard_items WHERE id = ? AND user_id = ?',
      [itemId, userId]
    );

    if (!item) {
      return res.status(404).json({
        error: '项目不存在'
      });
    }

    // 软删除
    await dbRun(
      'UPDATE clipboard_items SET is_deleted = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [itemId]
    );

    // 记录同步操作
    await dbRun(
      'INSERT INTO sync_records (user_id, device_id, item_id, action, status) VALUES (?, ?, ?, ?, ?)',
      [userId, deviceId, itemId, 'delete', 'completed']
    );

    logger.info(`用户 ${userId} 删除剪贴板项目 ${itemId}`);

    res.json({
      message: '项目删除成功'
    });

  } catch (error) {
    logger.error('删除剪贴板项目失败:', error);
    res.status(500).json({
      error: '删除项目失败'
    });
  }
});

// 清空剪贴板历史
router.delete('/clear', authenticateToken, async (req, res) => {
  try {
    const { userId, deviceId } = req.user;
    const { olderThan } = req.query;

    let whereClause = 'user_id = ? AND is_deleted = 0';
    let params = [userId];

    if (olderThan) {
      whereClause += ' AND created_at < ?';
      params.push(olderThan);
    }

    // 获取要删除的项目数量
    const countResult = await dbGet(
      `SELECT COUNT(*) as count FROM clipboard_items WHERE ${whereClause}`,
      params
    );

    // 软删除所有匹配的项目
    const result = await dbRun(
      `UPDATE clipboard_items SET is_deleted = 1, updated_at = CURRENT_TIMESTAMP WHERE ${whereClause}`,
      params
    );

    // 记录批量删除操作
    await dbRun(
      'INSERT INTO sync_records (user_id, device_id, item_id, action, status) VALUES (?, ?, ?, ?, ?)',
      [userId, deviceId, 'bulk_clear', 'clear', 'completed']
    );

    logger.info(`用户 ${userId} 清空 ${countResult.count} 个剪贴板项目`);

    res.json({
      message: '剪贴板历史清空成功',
      deletedCount: countResult.count
    });

  } catch (error) {
    logger.error('清空剪贴板历史失败:', error);
    res.status(500).json({
      error: '清空历史失败'
    });
  }
});

// 获取同步状态
router.get('/status', authenticateToken, async (req, res) => {
  try {
    const { userId, deviceId } = req.user;

    // 获取用户基本信息
    const user = await dbGet(
      'SELECT id, email, created_at FROM users WHERE id = ?',
      [userId]
    );

    // 获取当前设备信息
    const currentDevice = await dbGet(
      'SELECT * FROM devices WHERE id = ? AND user_id = ?',
      [deviceId, userId]
    );

    // 获取所有设备
    const devices = await dbAll(
      'SELECT * FROM devices WHERE user_id = ? ORDER BY last_active DESC',
      [userId]
    );

    // 获取最近同步记录
    const lastSync = await dbGet(
      'SELECT * FROM sync_records WHERE user_id = ? ORDER BY timestamp DESC LIMIT 1',
      [userId]
    );

    // 获取待处理的冲突数量
    const conflictCount = await dbGet(
      'SELECT COUNT(*) as count FROM sync_conflicts WHERE user_id = ? AND resolved = 0',
      [userId]
    );

    res.json({
      user: {
        id: user.id,
        email: user.email,
        joinedAt: user.created_at
      },
      currentDevice: {
        id: currentDevice.id,
        name: currentDevice.name,
        type: currentDevice.type,
        lastActive: currentDevice.last_active
      },
      devices: devices.map(device => ({
        id: device.id,
        name: device.name,
        type: device.type,
        isOnline: device.is_online,
        lastActive: device.last_active,
        isCurrent: device.id === deviceId
      })),
      sync: {
        lastSyncTime: lastSync?.timestamp || null,
        status: 'idle', // 可以根据实际情况动态设置
        conflictCount: conflictCount.count || 0
      },
      serverTime: new Date().toISOString()
    });

  } catch (error) {
    logger.error('获取同步状态失败:', error);
    res.status(500).json({
      error: '获取状态失败'
    });
  }
});

// 获取同步统计
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.user;

    // 基本统计
    const basicStats = await dbGet(
      `SELECT 
         COUNT(*) as total_items,
         COUNT(CASE WHEN created_at >= datetime('now', '-1 day') THEN 1 END) as today_items,
         COUNT(CASE WHEN created_at >= datetime('now', '-7 days') THEN 1 END) as week_items,
         SUM(size) as total_size
       FROM clipboard_items 
       WHERE user_id = ? AND is_deleted = 0`,
      [userId]
    );

    // 按类型统计
    const typeStats = await dbAll(
      `SELECT type, COUNT(*) as count
       FROM clipboard_items 
       WHERE user_id = ? AND is_deleted = 0
       GROUP BY type
       ORDER BY count DESC`,
      [userId]
    );

    // 按设备统计
    const deviceStats = await dbAll(
      `SELECT d.name, d.type, COUNT(ci.id) as count
       FROM devices d
       LEFT JOIN clipboard_items ci ON d.id = ci.device_id AND ci.is_deleted = 0
       WHERE d.user_id = ?
       GROUP BY d.id, d.name, d.type
       ORDER BY count DESC`,
      [userId]
    );

    // 同步记录统计
    const syncStats = await dbGet(
      `SELECT 
         COUNT(*) as total_syncs,
         COUNT(CASE WHEN status = 'completed' THEN 1 END) as successful_syncs,
         COUNT(CASE WHEN timestamp >= datetime('now', '-1 day') THEN 1 END) as today_syncs
       FROM sync_records 
       WHERE user_id = ?`,
      [userId]
    );

    // 最近活动
    const recentActivity = await dbAll(
      `SELECT 
         DATE(created_at) as date,
         COUNT(*) as count
       FROM clipboard_items 
       WHERE user_id = ? AND is_deleted = 0 AND created_at >= datetime('now', '-30 days')
       GROUP BY DATE(created_at)
       ORDER BY date DESC
       LIMIT 30`,
      [userId]
    );

    res.json({
      basic: {
        totalItems: basicStats.total_items || 0,
        todayItems: basicStats.today_items || 0,
        weekItems: basicStats.week_items || 0,
        totalSize: basicStats.total_size || 0
      },
      byType: typeStats,
      byDevice: deviceStats,
      sync: {
        totalSyncs: syncStats.total_syncs || 0,
        successfulSyncs: syncStats.successful_syncs || 0,
        todaySyncs: syncStats.today_syncs || 0,
        successRate: syncStats.total_syncs > 0 
          ? ((syncStats.successful_syncs || 0) / syncStats.total_syncs * 100).toFixed(2)
          : '0.00'
      },
      recentActivity
    });

  } catch (error) {
    logger.error('获取同步统计失败:', error);
    res.status(500).json({
      error: '获取统计失败'
    });
  }
});

// 搜索剪贴板内容
router.get('/search', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.user;
    const { q, type, limit = 50, offset = 0 } = req.query;

    if (!q || q.trim().length === 0) {
      return res.status(400).json({
        error: '搜索关键词不能为空'
      });
    }

    let whereClause = 'ci.user_id = ? AND ci.is_deleted = 0 AND ci.content LIKE ?';
    let params = [userId, `%${q.trim()}%`];

    if (type) {
      whereClause += ' AND ci.type = ?';
      params.push(type);
    }

    const items = await dbAll(
      `SELECT ci.*, d.name as device_name, d.type as device_type
       FROM clipboard_items ci
       JOIN devices d ON ci.device_id = d.id
       WHERE ${whereClause}
       ORDER BY ci.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), parseInt(offset)]
    );

    // 获取搜索结果总数
    const countResult = await dbGet(
      `SELECT COUNT(*) as total
       FROM clipboard_items ci
       WHERE ${whereClause}`,
      params
    );

    res.json({
      items: items.map(item => ({
        ...item,
        metadata: item.metadata ? JSON.parse(item.metadata) : {}
      })),
      total: countResult.total,
      query: q,
      type: type || 'all'
    });

  } catch (error) {
    logger.error('搜索剪贴板内容失败:', error);
    res.status(500).json({
      error: '搜索失败'
    });
  }
});

// 导出数据
router.get('/export', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.user;
    const { format = 'json', includeDeleted = false } = req.query;

    let whereClause = 'ci.user_id = ?';
    let params = [userId];

    if (!includeDeleted) {
      whereClause += ' AND ci.is_deleted = 0';
    }

    const items = await dbAll(
      `SELECT ci.*, d.name as device_name, d.type as device_type
       FROM clipboard_items ci
       JOIN devices d ON ci.device_id = d.id
       WHERE ${whereClause}
       ORDER BY ci.created_at DESC`,
      params
    );

    const exportData = {
      exportTime: new Date().toISOString(),
      userId,
      totalItems: items.length,
      items: items.map(item => ({
        ...item,
        metadata: item.metadata ? JSON.parse(item.metadata) : {}
      }))
    };

    if (format === 'csv') {
      // 简单的CSV导出
      const csvHeader = 'ID,Type,Content,Device,Created At\n';
      const csvRows = items.map(item => 
        `"${item.id}","${item.type}","${item.content.replace(/"/g, '""')}","${item.device_name}","${item.created_at}"`
      ).join('\n');
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="clipboard_export.csv"');
      res.send(csvHeader + csvRows);
    } else {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename="clipboard_export.json"');
      res.json(exportData);
    }

    logger.info(`用户 ${userId} 导出 ${items.length} 个剪贴板项目`);

  } catch (error) {
    logger.error('导出数据失败:', error);
    res.status(500).json({
      error: '导出失败'
    });
  }
});

export default router;