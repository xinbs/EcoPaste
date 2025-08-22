import path from "node:path";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import axios from "axios";
import sqlite3 from "sqlite3";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * 同步功能测试脚本
 * 用于测试自动同步和强制同步功能
 */

// 配置
const DB_PATH = path.join(__dirname, "src-tauri", "history.db");
const SERVER_URL = "http://localhost:3001";

// 测试用户凭据
const TEST_USER = {
	email: "test@example.com",
	password: "test123456",
};

// 模拟剪贴板数据
const MOCK_CLIPBOARD_DATA = [
	{
		id: "test-1",
		type: "text",
		value: "这是第一条测试文本数据",
		search: "这是第一条测试文本数据",
		group: "text",
		subtype: null,
		count: 12,
		createTime: new Date().toISOString(),
		favorite: false,
	},
	{
		id: "test-2",
		type: "text",
		value: "https://www.example.com",
		search: "https://www.example.com",
		group: "text",
		subtype: "url",
		count: 23,
		createTime: new Date(Date.now() - 60000).toISOString(),
		favorite: false,
	},
	{
		id: "test-3",
		type: "text",
		value: "test@email.com",
		search: "test@email.com",
		group: "text",
		subtype: "email",
		count: 14,
		createTime: new Date(Date.now() - 120000).toISOString(),
		favorite: true,
	},
];

/**
 * 创建本地数据库和测试数据
 */
async function setupLocalDatabase() {
	return new Promise((resolve, reject) => {
		const db = new sqlite3.Database(DB_PATH);

		db.serialize(() => {
			// 创建history表
			db.run(
				`
        CREATE TABLE IF NOT EXISTS history (
          id TEXT PRIMARY KEY,
          type TEXT NOT NULL,
          value TEXT NOT NULL,
          search TEXT,
          "group" TEXT,
          subtype TEXT,
          count INTEGER,
          width INTEGER,
          height INTEGER,
          createTime TEXT,
          favorite BOOLEAN DEFAULT 0
        )
      `,
				(err) => {
					if (err) {
						console.error("创建表失败:", err);
						reject(err);
						return;
					}
				},
			);

			// 清空旧数据
			db.run("DELETE FROM history", (err) => {
				if (err) {
					console.error("清空数据失败:", err);
					reject(err);
					return;
				}
			});

			// 插入测试数据
			const stmt = db.prepare(`
        INSERT INTO history (id, type, value, search, "group", subtype, count, createTime, favorite)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

			let insertedCount = 0;

			MOCK_CLIPBOARD_DATA.forEach((item, index) => {
				stmt.run(
					[
						item.id,
						item.type,
						item.value,
						item.search,
						item.group,
						item.subtype,
						item.count,
						item.createTime,
						item.favorite ? 1 : 0,
					],
					(err) => {
						if (err) {
							console.error(`插入数据 ${index + 1} 失败:`, err);
						} else {
						}

						insertedCount++;
						if (insertedCount === MOCK_CLIPBOARD_DATA.length) {
							stmt.finalize();
							db.close();
							resolve();
						}
					},
				);
			});
		});
	});
}

/**
 * 检查服务器状态
 */
async function checkServerStatus() {
	try {
		const _response = await axios.get(`${SERVER_URL}/health`);
		return true;
	} catch (error) {
		console.error("❌ 服务器连接失败:", error.message);
		return false;
	}
}

/**
 * 用户登录获取token
 */
async function loginUser() {
	try {
		const response = await axios.post(`${SERVER_URL}/api/auth/login`, {
			username: TEST_USER.email,
			password: TEST_USER.password,
			deviceName: "Test Device",
			deviceType: "desktop",
			platform: "test",
		});
		return response.data.token;
	} catch (_error) {
		// 尝试注册
		try {
			await axios.post(`${SERVER_URL}/api/auth/register`, {
				username: TEST_USER.email,
				password: TEST_USER.password,
				email: TEST_USER.email,
				deviceName: "Test Device",
				deviceType: "desktop",
				platform: "test",
			});

			// 注册后登录
			const loginResponse = await axios.post(`${SERVER_URL}/api/auth/login`, {
				username: TEST_USER.email,
				password: TEST_USER.password,
				deviceName: "Test Device",
				deviceType: "desktop",
				platform: "test",
			});

			return loginResponse.data.token;
		} catch (registerError) {
			console.error(
				"❌ 注册失败:",
				registerError.response?.data || registerError.message,
			);
			throw registerError;
		}
	}
}

/**
 * 检查云端数据
 */
async function checkCloudData(token) {
	try {
		const response = await axios.get(`${SERVER_URL}/api/sync/data`, {
			headers: {
				Authorization: `Bearer ${token}`,
			},
		});

		response.data.items.forEach((_item, _index) => {});

		return response.data;
	} catch (error) {
		console.error(
			"❌ 获取云端数据失败:",
			error.response?.data || error.message,
		);
		return { items: [], total: 0 };
	}
}

/**
 * 主测试流程
 */
async function main() {
	try {
		const serverOk = await checkServerStatus();
		if (!serverOk) {
			process.exit(1);
		}
		await setupLocalDatabase();
		const token = await loginUser();
		const _beforeData = await checkCloudData(token);
	} catch (error) {
		console.error("❌ 测试失败:", error.message);
		process.exit(1);
	}
}

/**
 * 检查模式：只查看云端数据
 */
async function checkMode() {
	try {
		// 检查服务器
		const serverOk = await checkServerStatus();
		if (!serverOk) {
			process.exit(1);
		}

		// 登录获取数据
		const token = await loginUser();
		await checkCloudData(token);
	} catch (error) {
		console.error("❌ 检查失败:", error.message);
	}
}

// 解析命令行参数
const mode = process.argv[2];

if (mode === "check") {
	checkMode();
} else {
	main();
}
