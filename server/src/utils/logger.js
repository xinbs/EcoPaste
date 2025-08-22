import { appendFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 日志目录
const LOG_DIR = join(__dirname, "../../logs");

// 确保日志目录存在
if (!existsSync(LOG_DIR)) {
	mkdirSync(LOG_DIR, { recursive: true });
}

// 日志级别
const LOG_LEVELS = {
	ERROR: 0,
	WARN: 1,
	INFO: 2,
	DEBUG: 3,
};

// 当前日志级别
const CURRENT_LEVEL =
	LOG_LEVELS[process.env.LOG_LEVEL?.toUpperCase()] ?? LOG_LEVELS.INFO;

// 颜色代码
const COLORS = {
	ERROR: "\x1b[31m", // 红色
	WARN: "\x1b[33m", // 黄色
	INFO: "\x1b[36m", // 青色
	DEBUG: "\x1b[37m", // 白色
	RESET: "\x1b[0m", // 重置
};

// 格式化时间戳
function formatTimestamp() {
	return new Date().toISOString();
}

// 格式化日志消息
function formatMessage(level, message, ...args) {
	const timestamp = formatTimestamp();
	const formattedArgs = args
		.map((arg) =>
			typeof arg === "object" ? JSON.stringify(arg, null, 2) : String(arg),
		)
		.join(" ");

	const fullMessage = formattedArgs ? `${message} ${formattedArgs}` : message;
	return `[${timestamp}] [${level}] ${fullMessage}`;
}

// 写入日志文件
function writeToFile(_level, message) {
	try {
		const today = new Date().toISOString().split("T")[0];
		const logFile = join(LOG_DIR, `${today}.log`);
		appendFileSync(logFile, `${message}\n`, "utf8");
	} catch (error) {
		console.error("写入日志文件失败:", error);
	}
}

// 输出到控制台
function writeToConsole(level, message) {
	const color = COLORS[level] || COLORS.RESET;
	const coloredMessage = `${color}${message}${COLORS.RESET}`;

	switch (level) {
		case "ERROR":
			console.error(coloredMessage);
			break;
		case "WARN":
			console.warn(coloredMessage);
			break;
		case "DEBUG":
			console.debug(coloredMessage);
			break;
		default:
	}
}

// 通用日志函数
function log(level, message, ...args) {
	if (LOG_LEVELS[level] > CURRENT_LEVEL) {
		return;
	}

	const formattedMessage = formatMessage(level, message, ...args);

	// 输出到控制台
	writeToConsole(level, formattedMessage);

	// 写入文件（生产环境）
	if (process.env.NODE_ENV === "production") {
		writeToFile(level, formattedMessage);
	}
}

// 导出日志器
export const logger = {
	error: (message, ...args) => log("ERROR", message, ...args),
	warn: (message, ...args) => log("WARN", message, ...args),
	info: (message, ...args) => log("INFO", message, ...args),
	debug: (message, ...args) => log("DEBUG", message, ...args),

	// 请求日志中间件
	middleware: (req, res, next) => {
		const start = Date.now();
		const { method, url, ip } = req;

		res.on("finish", () => {
			const duration = Date.now() - start;
			const { statusCode } = res;
			const level = statusCode >= 400 ? "WARN" : "INFO";

			log(level, `${method} ${url} ${statusCode} ${duration}ms ${ip}`);
		});

		next();
	},

	// WebSocket 连接日志
	wsConnection: (ws, req) => {
		const ip = req.socket.remoteAddress;
		log("INFO", `WebSocket 连接建立: ${ip}`);

		ws.on("close", () => {
			log("INFO", `WebSocket 连接关闭: ${ip}`);
		});

		ws.on("error", (error) => {
			log("ERROR", `WebSocket 错误: ${ip}`, error);
		});
	},
};

// 未捕获异常处理
process.on("uncaughtException", (error) => {
	logger.error("未捕获异常:", error);
	process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
	logger.error("未处理的 Promise 拒绝:", reason, "at:", promise);
});

export default logger;
