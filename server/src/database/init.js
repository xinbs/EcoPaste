import { existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sqlite3 from "sqlite3";
import { logger } from "../utils/logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 数据库文件路径
const DB_DIR = join(__dirname, "../../data");
const DB_PATH = join(DB_DIR, "ecopaste.db");

// 确保数据目录存在
if (!existsSync(DB_DIR)) {
	mkdirSync(DB_DIR, { recursive: true });
}

// 创建数据库连接
const db = new sqlite3.Database(DB_PATH, (err) => {
	if (err) {
		logger.error("数据库连接失败:", err);
	} else {
		logger.info("数据库连接成功:", DB_PATH);
	}
});

// 启用外键约束
db.run("PRAGMA foreign_keys = ON");

// 数据库表结构
const TABLES = {
	// 用户表
	users: `
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      email TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `,

	// 设备表
	devices: `
    CREATE TABLE IF NOT EXISTS devices (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      platform TEXT,
      last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
      is_active BOOLEAN DEFAULT 1,
      encryption_key TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    )
  `,

	// 剪贴板数据表
	clipboard_items: `
    CREATE TABLE IF NOT EXISTS clipboard_items (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      device_id TEXT NOT NULL,
      type TEXT NOT NULL,
      content TEXT NOT NULL,
      metadata TEXT,
      hash TEXT NOT NULL,
      size INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      is_deleted BOOLEAN DEFAULT 0,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
      FOREIGN KEY (device_id) REFERENCES devices (id) ON DELETE CASCADE
    )
  `,

	// 同步记录表
	sync_records: `
    CREATE TABLE IF NOT EXISTS sync_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      device_id TEXT NOT NULL,
      item_id TEXT,
      action TEXT NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      status TEXT DEFAULT 'pending',
      error_message TEXT,
      metadata TEXT,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
      FOREIGN KEY (device_id) REFERENCES devices (id) ON DELETE CASCADE,
      FOREIGN KEY (item_id) REFERENCES clipboard_items (id) ON DELETE SET NULL
    )
  `,

	// 会话表
	sessions: `
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      device_id TEXT NOT NULL,
      token TEXT NOT NULL,
      expires_at DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
      FOREIGN KEY (device_id) REFERENCES devices (id) ON DELETE CASCADE
    )
  `,
};

// 索引定义
const INDEXES = [
	"CREATE INDEX IF NOT EXISTS idx_devices_user_id ON devices (user_id)",
	"CREATE INDEX IF NOT EXISTS idx_devices_last_seen ON devices (last_seen)",
	"CREATE INDEX IF NOT EXISTS idx_clipboard_items_user_id ON clipboard_items (user_id)",
	"CREATE INDEX IF NOT EXISTS idx_clipboard_items_device_id ON clipboard_items (device_id)",
	"CREATE INDEX IF NOT EXISTS idx_clipboard_items_created_at ON clipboard_items (created_at)",
	"CREATE INDEX IF NOT EXISTS idx_clipboard_items_hash ON clipboard_items (hash)",
	"CREATE INDEX IF NOT EXISTS idx_sync_records_user_id ON sync_records (user_id)",
	"CREATE INDEX IF NOT EXISTS idx_sync_records_device_id ON sync_records (device_id)",
	"CREATE INDEX IF NOT EXISTS idx_sync_records_timestamp ON sync_records (timestamp)",
	"CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions (user_id)",
	"CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions (token)",
	"CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions (expires_at)",
];

// 初始化数据库
export async function initDatabase() {
	return new Promise((resolve, _reject) => {
		db.serialize(() => {
			// 创建表
			Object.entries(TABLES).forEach(([tableName, sql]) => {
				db.run(sql, (err) => {
					if (err) {
						logger.error(`创建表 ${tableName} 失败:`, err);
					} else {
						logger.info(`表 ${tableName} 创建成功`);
					}
				});
			});

			// 创建索引
			INDEXES.forEach((indexSql) => {
				db.run(indexSql, (err) => {
					if (err) {
						logger.error("创建索引失败:", err);
					}
				});
			});

			// 清理过期会话
			db.run(
				'DELETE FROM sessions WHERE expires_at < datetime("now")',
				(err) => {
					if (err) {
						logger.error("清理过期会话失败:", err);
					} else {
						logger.info("过期会话清理完成");
					}
				},
			);

			resolve();
		});
	});
}

// 获取数据库实例
export function getDatabase() {
	return db;
}

// 关闭数据库连接
export function closeDatabase() {
	return new Promise((resolve) => {
		db.close((err) => {
			if (err) {
				logger.error("关闭数据库失败:", err);
			} else {
				logger.info("数据库连接已关闭");
			}
			resolve();
		});
	});
}

// 数据库查询辅助函数
export function dbGet(sql, params = []) {
	return new Promise((resolve, reject) => {
		db.get(sql, params, (err, row) => {
			if (err) {
				reject(err);
			} else {
				resolve(row);
			}
		});
	});
}

export function dbAll(sql, params = []) {
	return new Promise((resolve, reject) => {
		db.all(sql, params, (err, rows) => {
			if (err) {
				reject(err);
			} else {
				resolve(rows);
			}
		});
	});
}

export function dbRun(sql, params = []) {
	return new Promise((resolve, reject) => {
		db.run(sql, params, function (err) {
			if (err) {
				reject(err);
			} else {
				resolve({ lastID: this.lastID, changes: this.changes });
			}
		});
	});
}

export { DB_PATH };
