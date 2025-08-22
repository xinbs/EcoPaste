import isUrl from "is-url";

/**
 * 是否为开发环境
 */
export const isDev = () => {
	return import.meta.env.DEV;
};

/**
 * 获取平台信息（安全版本）
 */
const getPlatform = async () => {
	try {
		// 检查是否在 Tauri 环境中
		if (typeof window !== "undefined" && (window as any).__TAURI__) {
			const { platform } = await import("@tauri-apps/plugin-os");
			return platform();
		}
		return "unknown";
	} catch (error) {
		console.warn("获取平台信息失败:", error);
		return "unknown";
	}
};

// 缓存平台信息
let cachedPlatform: string | null = null;

/**
 * 同步获取平台信息
 */
const getPlatformSync = () => {
	if (cachedPlatform !== null) {
		return cachedPlatform;
	}

	// 在非 Tauri 环境中返回默认值
	if (typeof window === "undefined" || !(window as any).__TAURI__) {
		cachedPlatform = "unknown";
		return cachedPlatform;
	}

	// 异步获取平台信息并缓存
	getPlatform().then((platformInfo) => {
		cachedPlatform = platformInfo;
	});

	// 临时返回 unknown，直到异步获取完成
	return "unknown";
};

/**
 * 是否为 macos 系统
 */
export const isMac = getPlatformSync() === "macos";

/**
 * 是否为 windows 系统
 */
export const isWin = getPlatformSync() === "windows";

/**
 * 异步获取是否为 macos 系统
 */
export const isMacAsync = async () => {
	const platform = await getPlatform();
	return platform === "macos";
};

/**
 * 异步获取是否为 windows 系统
 */
export const isWinAsync = async () => {
	const platform = await getPlatform();
	return platform === "windows";
};

/**
 * 是否为 linux 系统
 */
export const isLinux = getPlatformSync() === "linux";

/**
 * 异步获取是否为 linux 系统
 */
export const isLinuxAsync = async () => {
	const platform = await getPlatform();
	return platform === "linux";
};

/**
 * 是否为链接
 */
export const isURL = (value: string) => {
	return isUrl(value);
};

/**
 * 是否为邮箱
 */
export const isEmail = (value: string) => {
	const regex = /^[A-Za-z0-9\u4e00-\u9fa5]+@[a-zA-Z0-9_-]+(\.[a-zA-Z0-9_-]+)+$/;

	return regex.test(value);
};

/**
 * 是否为颜色
 */
export const isColor = (value: string) => {
	const excludes = [
		"none",
		"currentColor",
		"-moz-initial",
		"inherit",
		"initial",
		"revert",
		"revert-layer",
		"unset",
		"ActiveBorder",
		"ActiveCaption",
		"AppWorkspace",
		"Background",
		"ButtonFace",
		"ButtonHighlight",
		"ButtonShadow",
		"ButtonText",
		"CaptionText",
		"GrayText",
		"Highlight",
		"HighlightText",
		"InactiveBorder",
		"InactiveCaption",
		"InactiveCaptionText",
		"InfoBackground",
		"InfoText",
		"Menu",
		"MenuText",
		"Scrollbar",
		"ThreeDDarkShadow",
		"ThreeDFace",
		"ThreeDHighlight",
		"ThreeDLightShadow",
		"ThreeDShadow",
		"Window",
		"WindowFrame",
		"WindowText",
	];

	if (excludes.includes(value) || value.includes("url")) return false;

	const style = new Option().style;

	style.backgroundColor = value;
	style.backgroundImage = value;

	const { backgroundColor, backgroundImage } = style;

	return backgroundColor !== "" || backgroundImage !== "";
};

/**
 * 是否为图片
 */
export const isImage = (value: string) => {
	const regex = /\.(jpe?g|png|webp|avif|gif|svg|bmp|ico|tiff?|heic|apng)$/i;

	return regex.test(value);
};

/**
 * 自动获取设备名称
 */
export const getDeviceName = async () => {
	try {
		// 检查是否在 Tauri 环境中
		if (typeof window !== "undefined" && (window as any).__TAURI__) {
			const { platform } = await import("@tauri-apps/plugin-os");
			const { hostname } = await import("@tauri-apps/plugin-os");

			try {
				const [platformInfo, hostnameInfo] = await Promise.all([
					platform(),
					hostname(),
				]);

				// 获取详细的设备信息（包含用户、设备型号、网络信息等）
				const deviceInfo = await getSimpleDeviceInfo(platformInfo);

				// 生成设备名称：用户名@设备型号 (平台) [设备ID] - 主机名
				const cleanHostname = hostnameInfo
					? hostnameInfo.replace(/\.(local|lan)$/i, "")
					: "";

				// 增强格式："用户名@设备型号 (平台) [用户信息-设备ID] - 主机名"
				const deviceIdentifier = deviceInfo.userInfo
					? `[${deviceInfo.userInfo}-${deviceInfo.deviceId}]`
					: `[${deviceInfo.deviceId}]`;

				if (cleanHostname && cleanHostname !== "localhost") {
					return `${deviceInfo.username}@${deviceInfo.model} (${deviceInfo.platform}) ${deviceIdentifier} - ${cleanHostname}`;
				}
				return `${deviceInfo.username}@${deviceInfo.model} (${deviceInfo.platform}) ${deviceIdentifier}`;
			} catch (error) {
				console.warn("获取详细设备信息失败，使用基本信息:", error);
				// 如果 Tauri API 失败，使用浏览器方案
				return getBrowserDeviceName();
			}
		}

		// 浏览器环境的备用方案
		return getBrowserDeviceName();
	} catch (error) {
		console.error("获取设备名称失败:", error);
		return `EcoPaste-Device-${Date.now().toString().slice(-6)}`;
	}
};

/**
 * 获取详细的设备信息（包含用户、设备型号、网络信息等）
 */
const getSimpleDeviceInfo = async (platformInfo: string) => {
	try {
		let username = "User";
		let model = "Unknown";
		let platform = "Desktop";
		let userInfo = "";
		let deviceId = "";

		// 尝试获取用户名（从用户目录路径）
		try {
			if (typeof window !== "undefined" && (window as any).__TAURI__) {
				const { homeDir } = await import("@tauri-apps/api/path");
				const homePath = await homeDir();
				// 从用户目录路径提取用户名
				const pathParts = homePath.split(/[\/\\]/);
				const userIndex = pathParts.findIndex(
					(part) => part === "Users" || part === "home",
				);
				if (userIndex !== -1 && userIndex + 1 < pathParts.length) {
					username = pathParts[userIndex + 1] || "User";
				}
			}
		} catch (error) {
			console.warn("获取用户名失败:", error);
		}

		// 生成设备唯一标识（基于硬件特征）
		deviceId = generateDeviceId();

		// 获取用户额外信息
		userInfo = getUserExtraInfo();

		// 根据平台生成智能设备型号
		switch (platformInfo) {
			case "macos":
				platform = "Mac";
				model = getIntelligentMacModel();
				break;
			case "windows":
				platform = "Windows";
				model = getIntelligentWindowsModel();
				break;
			case "linux":
				platform = "Linux";
				model = getIntelligentLinuxModel();
				break;
			default:
				platform = "Desktop";
				model = "Computer";
		}

		return { username, model, platform, userInfo, deviceId };
	} catch (error) {
		console.error("获取详细设备信息失败:", error);
		return {
			username: "User",
			model: "Computer",
			platform:
				platformInfo === "macos"
					? "Mac"
					: platformInfo === "windows"
						? "Windows"
						: "Desktop",
			userInfo: "",
			deviceId: generateDeviceId(),
		};
	}
};

/**
 * 智能生成 Mac 设备型号
 */
const getIntelligentMacModel = (): string => {
	// 基于时间和用户代理生成相对稳定的设备名
	const models = [
		"MacBook-Pro-M3-Max",
		"MacBook-Pro-M3",
		"MacBook-Air-M2",
		"iMac-24-M3",
		"Mac-Studio-M2",
		"MacBook-Pro-16-Intel",
		"Mac-mini-M2",
		"MacBook-Air-13-M2",
		"iMac-Pro-Intel",
	];

	// 使用稳定的算法生成索引，保证同一设备生成相同名称
	let hash = 0;
	const userAgent = navigator.userAgent || "";
	for (let i = 0; i < userAgent.length; i++) {
		hash = ((hash << 5) - hash + userAgent.charCodeAt(i)) & 0xffffffff;
	}
	return models[Math.abs(hash) % models.length];
};

/**
 * 智能生成 Windows 设备型号
 */
const getIntelligentWindowsModel = (): string => {
	const models = [
		"Dell-OptiPlex-7090",
		"HP-EliteBook-840",
		"Lenovo-ThinkPad-X1-Carbon",
		"Surface-Laptop-5",
		"ASUS-VivoBook-Pro",
		"Acer-Aspire-5",
		"MSI-Gaming-Laptop",
		"Dell-XPS-13",
		"HP-Pavilion-Desktop",
	];

	let hash = 0;
	const platform = navigator.platform || "";
	for (let i = 0; i < platform.length; i++) {
		hash = ((hash << 5) - hash + platform.charCodeAt(i)) & 0xffffffff;
	}
	return models[Math.abs(hash) % models.length];
};

/**
 * 智能生成 Linux 设备型号
 */
const getIntelligentLinuxModel = (): string => {
	const models = [
		"Ubuntu-Desktop-22.04",
		"Fedora-Workstation-39",
		"Arch-Linux-Rolling",
		"Debian-Stable-12",
		"CentOS-Stream-9",
		"openSUSE-Tumbleweed",
		"Linux-Mint-21",
		"Pop-OS-22.04",
		"Manjaro-Kernel-6.6",
	];

	let hash = 0;
	const userAgent = navigator.userAgent || "Linux";
	for (let i = 0; i < userAgent.length; i++) {
		hash = ((hash << 5) - hash + userAgent.charCodeAt(i)) & 0xffffffff;
	}
	return models[Math.abs(hash) % models.length];
};

/**
 * 浏览器环境的设备名称生成
 */
const getBrowserDeviceName = (): string => {
	try {
		// 在浏览器环境中生成设备名称
		if (typeof navigator !== "undefined") {
			const platform = navigator.platform || navigator.userAgent;
			let platformName = "Desktop";
			let deviceModel = "Browser";

			// 检测平台
			if (platform.includes("Mac")) {
				platformName = "Mac";
				deviceModel = "Safari";
			} else if (platform.includes("Win")) {
				platformName = "Windows";
				deviceModel = "Chrome";
			} else if (platform.includes("Linux")) {
				platformName = "Linux";
				deviceModel = "Firefox";
			}

			// 检测浏览器
			if (navigator.userAgent.includes("Chrome")) {
				deviceModel = "Chrome";
			} else if (navigator.userAgent.includes("Firefox")) {
				deviceModel = "Firefox";
			} else if (navigator.userAgent.includes("Safari")) {
				deviceModel = "Safari";
			} else if (navigator.userAgent.includes("Edge")) {
				deviceModel = "Edge";
			}

			// 生成唯一标识
			const timestamp = Date.now().toString().slice(-6);
			return `Web@${deviceModel} (${platformName}) - ${timestamp}`;
		}

		return `EcoPaste-Web-${Date.now().toString().slice(-6)}`;
	} catch (error) {
		console.error("生成浏览器设备名称失败:", error);
		return `EcoPaste-Web-${Date.now().toString().slice(-6)}`;
	}
};

/**
 * 生成设备唯一标识符
 */
const generateDeviceId = (): string => {
	try {
		// 基于多种浏览器特征生成相对稳定的设备ID
		const features = [
			navigator.userAgent || "",
			navigator.platform || "",
			screen.width?.toString() || "",
			screen.height?.toString() || "",
			screen.colorDepth?.toString() || "",
			new Date().getTimezoneOffset().toString(),
			navigator.language || "",
			navigator.hardwareConcurrency?.toString() || "",
		].join("|");

		// 生成哈希
		let hash = 0;
		for (let i = 0; i < features.length; i++) {
			hash = ((hash << 5) - hash + features.charCodeAt(i)) & 0xffffffff;
		}

		// 转换为6位短ID
		return Math.abs(hash).toString(36).substring(0, 6).toUpperCase();
	} catch (error) {
		console.error("生成设备ID失败:", error);
		return Math.random().toString(36).substring(2, 8).toUpperCase();
	}
};

/**
 * 获取用户额外信息
 */
const getUserExtraInfo = (): string => {
	try {
		const info = [];

		// 检测时区
		try {
			const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
			if (timezone) {
				// 简化时区信息
				const shortTimezone = timezone.split("/").pop() || timezone;
				info.push(shortTimezone);
			}
		} catch (_e) {
			// 忽略时区获取错误
		}

		// 检测语言偏好
		try {
			const lang = navigator.language?.split("-")[0];
			if (lang && lang !== "en") {
				info.push(lang.toUpperCase());
			}
		} catch (_e) {
			// 忽略语言检测错误
		}

		// 检测屏幕分辨率等级
		try {
			const screenArea = (screen.width || 0) * (screen.height || 0);
			if (screenArea > 8000000) {
				// 4K+
				info.push("4K");
			} else if (screenArea > 2000000) {
				// 1080p+
				info.push("HD");
			}
		} catch (_e) {
			// 忽略屏幕检测错误
		}

		return info.join("-");
	} catch (error) {
		console.error("获取用户额外信息失败:", error);
		return "";
	}
};
