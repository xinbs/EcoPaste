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
		if (typeof window !== 'undefined' && (window as any).__TAURI__) {
			const { platform } = await import('@tauri-apps/plugin-os');
			return platform();
		}
		return 'unknown';
	} catch (error) {
		console.warn('获取平台信息失败:', error);
		return 'unknown';
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
	if (typeof window === 'undefined' || !(window as any).__TAURI__) {
		cachedPlatform = 'unknown';
		return cachedPlatform;
	}
	
	// 异步获取平台信息并缓存
	getPlatform().then(platformInfo => {
		cachedPlatform = platformInfo;
	});
	
	// 临时返回 unknown，直到异步获取完成
	return 'unknown';
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
