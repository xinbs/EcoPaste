import express from "express";
import { v4 as uuidv4 } from "uuid";
import { dbAll, dbGet, dbRun } from "../database/init.js";
import { logger } from "../utils/logger.js";
import { getConnectionStats } from "../websocket/handler.js";
import { authenticateToken } from "./auth.js";

const router = express.Router();

// 获取用户设备列表
router.get("/list", authenticateToken, async (req, res) => {
	try {
		const { userId } = req.user;

		const devices = await dbAll(
			`SELECT id, name, type, platform, last_seen, is_active, created_at
       FROM devices 
       WHERE user_id = ? 
       ORDER BY last_seen DESC`,
			[userId],
		);

		// 获取连接状态
		const connectionStats = getConnectionStats();
		const connectedDevices = new Set(
			connectionStats.deviceConnections
				.filter((conn) => conn.userId === userId.toString())
				.map((conn) => conn.deviceId),
		);

		const devicesWithStatus = devices.map((device) => ({
			...device,
			isOnline: connectedDevices.has(device.id),
			lastSeen: device.last_seen,
		}));

		res.json({
			devices: devicesWithStatus,
			total: devices.length,
			online: connectedDevices.size,
		});
	} catch (error) {
		logger.error("获取设备列表失败:", error);
		res.status(500).json({
			error: "获取设备列表失败",
		});
	}
});

// 注册新设备
router.post("/register", authenticateToken, async (req, res) => {
	try {
		const { userId } = req.user;
		const { name, type, platform } = req.body;

		if (!name) {
			return res.status(400).json({
				error: "设备名称不能为空",
			});
		}

		// 检查设备名称是否已存在
		const existingDevice = await dbGet(
			"SELECT id FROM devices WHERE user_id = ? AND name = ?",
			[userId, name],
		);

		if (existingDevice) {
			return res.status(409).json({
				error: "设备名称已存在",
			});
		}

		// 创建新设备
		const deviceId = uuidv4();
		await dbRun(
			"INSERT INTO devices (id, user_id, name, type, platform) VALUES (?, ?, ?, ?, ?)",
			[deviceId, userId, name, type || "desktop", platform || "unknown"],
		);

		const device = await dbGet(
			"SELECT id, name, type, platform, created_at FROM devices WHERE id = ?",
			[deviceId],
		);

		logger.info(`用户 ${userId} 注册新设备: ${name} (${deviceId})`);

		res.status(201).json({
			message: "设备注册成功",
			device,
		});
	} catch (error) {
		logger.error("设备注册失败:", error);
		res.status(500).json({
			error: "设备注册失败",
		});
	}
});

// 更新设备信息
router.put("/:deviceId", authenticateToken, async (req, res) => {
	try {
		const { userId } = req.user;
		const { deviceId } = req.params;
		const { name, type, platform } = req.body;

		// 验证设备所有权
		const device = await dbGet(
			"SELECT id FROM devices WHERE id = ? AND user_id = ?",
			[deviceId, userId],
		);

		if (!device) {
			return res.status(404).json({
				error: "设备不存在",
			});
		}

		// 如果更新名称，检查是否重复
		if (name) {
			const existingDevice = await dbGet(
				"SELECT id FROM devices WHERE user_id = ? AND name = ? AND id != ?",
				[userId, name, deviceId],
			);

			if (existingDevice) {
				return res.status(409).json({
					error: "设备名称已存在",
				});
			}
		}

		// 构建更新字段
		const updates = [];
		const values = [];

		if (name !== undefined) {
			updates.push("name = ?");
			values.push(name);
		}
		if (type !== undefined) {
			updates.push("type = ?");
			values.push(type);
		}
		if (platform !== undefined) {
			updates.push("platform = ?");
			values.push(platform);
		}

		if (updates.length === 0) {
			return res.status(400).json({
				error: "没有提供更新字段",
			});
		}

		updates.push("updated_at = CURRENT_TIMESTAMP");
		values.push(deviceId);

		await dbRun(
			`UPDATE devices SET ${updates.join(", ")} WHERE id = ?`,
			values,
		);

		const updatedDevice = await dbGet(
			"SELECT id, name, type, platform, last_seen, is_active, created_at FROM devices WHERE id = ?",
			[deviceId],
		);

		logger.info(`用户 ${userId} 更新设备 ${deviceId}`);

		res.json({
			message: "设备更新成功",
			device: updatedDevice,
		});
	} catch (error) {
		logger.error("设备更新失败:", error);
		res.status(500).json({
			error: "设备更新失败",
		});
	}
});

// 删除设备
router.delete("/:deviceId", authenticateToken, async (req, res) => {
	try {
		const { userId, deviceId: currentDeviceId } = req.user;
		const { deviceId } = req.params;

		// 不能删除当前设备
		if (deviceId === currentDeviceId) {
			return res.status(400).json({
				error: "不能删除当前设备",
			});
		}

		// 验证设备所有权
		const device = await dbGet(
			"SELECT id FROM devices WHERE id = ? AND user_id = ?",
			[deviceId, userId],
		);

		if (!device) {
			return res.status(404).json({
				error: "设备不存在",
			});
		}

		// 删除设备（级联删除相关数据）
		await dbRun("DELETE FROM devices WHERE id = ?", [deviceId]);

		logger.info(`用户 ${userId} 删除设备 ${deviceId}`);

		res.json({
			message: "设备删除成功",
		});
	} catch (error) {
		logger.error("设备删除失败:", error);
		res.status(500).json({
			error: "设备删除失败",
		});
	}
});

// 获取设备详情
router.get("/:deviceId", authenticateToken, async (req, res) => {
	try {
		const { userId } = req.user;
		const { deviceId } = req.params;

		const device = await dbGet(
			`SELECT d.*, 
              COUNT(ci.id) as clipboard_count,
              MAX(ci.created_at) as last_clipboard_time
       FROM devices d
       LEFT JOIN clipboard_items ci ON d.id = ci.device_id AND ci.is_deleted = 0
       WHERE d.id = ? AND d.user_id = ?
       GROUP BY d.id`,
			[deviceId, userId],
		);

		if (!device) {
			return res.status(404).json({
				error: "设备不存在",
			});
		}

		// 获取连接状态
		const connectionStats = getConnectionStats();
		const isOnline = connectionStats.deviceConnections.some(
			(conn) => conn.userId === userId.toString() && conn.deviceId === deviceId,
		);

		res.json({
			...device,
			isOnline,
			clipboardCount: device.clipboard_count || 0,
			lastClipboardTime: device.last_clipboard_time,
		});
	} catch (error) {
		logger.error("获取设备详情失败:", error);
		res.status(500).json({
			error: "获取设备详情失败",
		});
	}
});

// 获取设备同步统计
router.get("/:deviceId/stats", authenticateToken, async (req, res) => {
	try {
		const { userId } = req.user;
		const { deviceId } = req.params;

		// 验证设备所有权
		const device = await dbGet(
			"SELECT id FROM devices WHERE id = ? AND user_id = ?",
			[deviceId, userId],
		);

		if (!device) {
			return res.status(404).json({
				error: "设备不存在",
			});
		}

		// 获取同步统计
		const stats = await dbGet(
			`SELECT 
         COUNT(*) as total_syncs,
         COUNT(CASE WHEN status = 'completed' THEN 1 END) as successful_syncs,
         COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_syncs,
         MAX(timestamp) as last_sync_time
       FROM sync_records 
       WHERE device_id = ?`,
			[deviceId],
		);

		// 获取最近7天的同步活动
		const recentActivity = await dbAll(
			`SELECT 
         DATE(timestamp) as date,
         COUNT(*) as sync_count
       FROM sync_records 
       WHERE device_id = ? AND timestamp >= datetime('now', '-7 days')
       GROUP BY DATE(timestamp)
       ORDER BY date DESC`,
			[deviceId],
		);

		res.json({
			deviceId,
			stats: {
				totalSyncs: stats.total_syncs || 0,
				successfulSyncs: stats.successful_syncs || 0,
				failedSyncs: stats.failed_syncs || 0,
				lastSyncTime: stats.last_sync_time,
				successRate:
					stats.total_syncs > 0
						? (
								((stats.successful_syncs || 0) / stats.total_syncs) *
								100
							).toFixed(2)
						: "0.00",
			},
			recentActivity,
		});
	} catch (error) {
		logger.error("获取设备统计失败:", error);
		res.status(500).json({
			error: "获取设备统计失败",
		});
	}
});

// 重置设备加密密钥
router.post("/:deviceId/reset-key", authenticateToken, async (req, res) => {
	try {
		const { userId } = req.user;
		const { deviceId } = req.params;

		// 验证设备所有权
		const device = await dbGet(
			"SELECT id FROM devices WHERE id = ? AND user_id = ?",
			[deviceId, userId],
		);

		if (!device) {
			return res.status(404).json({
				error: "设备不存在",
			});
		}

		// 生成新的加密密钥
		const newEncryptionKey = uuidv4();

		await dbRun("UPDATE devices SET encryption_key = ? WHERE id = ?", [
			newEncryptionKey,
			deviceId,
		]);

		logger.info(`用户 ${userId} 重置设备 ${deviceId} 的加密密钥`);

		res.json({
			message: "加密密钥重置成功",
			encryptionKey: newEncryptionKey,
		});
	} catch (error) {
		logger.error("重置加密密钥失败:", error);
		res.status(500).json({
			error: "重置加密密钥失败",
		});
	}
});

export default router;
