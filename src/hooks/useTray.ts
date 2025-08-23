import { emit } from "@tauri-apps/api/event";
import { Menu, MenuItem, PredefinedMenuItem } from "@tauri-apps/api/menu";
import { resolveResource } from "@tauri-apps/api/path";
import { TrayIcon, type TrayIconOptions } from "@tauri-apps/api/tray";
import { openUrl } from "@tauri-apps/plugin-opener";
import { exit, relaunch } from "@tauri-apps/plugin-process";

// 全局托盘状态管理
let globalTrayInstance: TrayIcon | null = null;
let isCreatingTray = false;

export const useTray = () => {
	const [startListen, { toggle }] = useBoolean(true);
	const { t } = useTranslation();

	// 监听是否显示菜单栏图标
	useSubscribeKey(globalStore.app, "showMenubarIcon", async (value) => {
		console.log('[useTray] showMenubarIcon 变化:', value, '全局托盘存在:', !!globalTrayInstance);
		
		// 优先使用全局托盘实例
		const tray = globalTrayInstance || await getTrayById();

		if (tray) {
			tray.setVisible(value);
			console.log('托盘显示状态已更新:', value);
		} else if (value && !globalTrayInstance && !isCreatingTray) {
			// 只在没有全局托盘且不在创建中时才创建
			console.log('需要显示但托盘不存在，创建托盘');
			createTray();
		} else {
			console.log('跳过托盘创建 - value:', value, '全局实例:', !!globalTrayInstance, '正在创建:', isCreatingTray);
		}
	});

	// 监听语言变更
	useSubscribeKey(globalStore.appearance, "language", () => {
		updateTrayMenu();
	});

	useUpdateEffect(() => {
		updateTrayMenu();

		emit(LISTEN_KEY.TOGGLE_LISTEN_CLIPBOARD, startListen);
	}, [startListen]);

	// 通过 id 获取托盘图标
	const getTrayById = () => {
		return TrayIcon.getById(TRAY_ID);
	};

	// 清理所有可能存在的托盘图标（包括后端创建的）
	const clearAllTrays = async () => {
		console.log('[clearAllTrays] 开始清理所有托盘图标');
		
		try {
			// 清理全局托盘实例
			if (globalTrayInstance) {
				await globalTrayInstance.close();
				globalTrayInstance = null;
				console.log('✅ 已清理全局托盘实例');
			}

			// 清理可能的后端托盘图标 (ID: "main")
			const backendTray = await TrayIcon.getById('main');
			if (backendTray) {
				await backendTray.close();
				console.log('✅ 已清理后端托盘图标: main');
			}
		} catch (error) {
			console.warn('清理后端托盘时出错:', error);
		}

		try {
			// 清理其他可能的重复图标 (ID: "app-tray")
			const existingTray = await getTrayById();
			if (existingTray && existingTray !== globalTrayInstance) {
				await existingTray.close();
				console.log('✅ 已清理存在的托盘图标:', TRAY_ID);
			}
		} catch (error) {
			console.warn('清理现有托盘时出错:', error);
		}
		
		// 清理其他可能的托盘 ID (避免处理遗留的托盘)
		const possibleIds = ['tray', 'system-tray', 'app', 'ecopaste'];
		for (const id of possibleIds) {
			try {
				const possibleTray = await TrayIcon.getById(id);
				if (possibleTray) {
					await possibleTray.close();
					console.log(`✅ 已清理可能的托盘图标: ${id}`);
				}
			} catch (error) {
				// 忽略，托盘可能不存在
			}
		}
		
		console.log('[clearAllTrays] 清理完成');
	};

	// 创建托盘
	const createTray = async () => {
		console.log('[createTray] 开始创建托盘 - showMenubarIcon:', globalStore.app.showMenubarIcon);
		
		if (!globalStore.app.showMenubarIcon) {
			console.log('[createTray] 菜单栏图标已禁用，跳过创建');
			return;
		}

		// 如果已经有全局托盘实例，直接返回
		if (globalTrayInstance) {
			console.log('[createTray] ✅ 托盘已存在，更新菜单:', TRAY_ID);
			await updateTrayMenu();
			return globalTrayInstance;
		}

		// 防止并发创建
		if (isCreatingTray) {
			console.log('[createTray] ⚠️ 正在创建托盘，跳过重复调用');
			return;
		}

		console.log('[createTray] ⚙️ 开始创建新托盘...');
		isCreatingTray = true;

		try {
			// 清理所有可能的重复托盘图标
			await clearAllTrays();

			const { appName, appVersion } = globalStore.env;

			const menu = await getTrayMenu();

			const iconPath = isMac ? "assets/tray-mac.ico" : "assets/tray.ico";
			const icon = await resolveResource(iconPath);

			const options: TrayIconOptions = {
				menu,
				icon,
				id: TRAY_ID,
				tooltip: `${appName} v${appVersion}`,
				iconAsTemplate: isMac, // macOS 上使用模板图标
				menuOnLeftClick: isMac, // macOS 上左键显示菜单
				action: (event) => {
					// macOS 通过 menuOnLeftClick 处理，这里主要处理非 macOS 平台
					if (isMac) return;

					if (event.type === "Click" && event.button === "Left") {
						showWindow("main");
					}
				},
			};

			console.log('[createTray] ⚙️ 正在创建托盘，配置:', { id: TRAY_ID, iconPath, tooltip: `${appName} v${appVersion}` });
			globalTrayInstance = await TrayIcon.new(options);
			console.log('[createTray] ✅ 全局托盘创建成功!', TRAY_ID);
			return globalTrayInstance;
		} catch (error) {
			console.error('[createTray] ❌ 创建托盘图标失败:', error);
			globalTrayInstance = null;
			throw error;
		} finally {
			isCreatingTray = false;
			console.log('[createTray] ⚙️ 创建流程结束，isCreatingTray =', isCreatingTray);
		}
	};

	// 获取托盘菜单
	const getTrayMenu = async () => {
		const { appVersion } = globalStore.env;

		const items = await Promise.all([
			MenuItem.new({
				text: t("component.tray.label.preference"),
				accelerator: isMac ? "Cmd+," : void 0,
				action: () => showWindow("preference"),
			}),
			MenuItem.new({
				text: startListen
					? t("component.tray.label.stop_listening")
					: t("component.tray.label.start_listening"),
				action: toggle,
			}),
			PredefinedMenuItem.new({ item: "Separator" }),
			MenuItem.new({
				text: t("component.tray.label.check_update"),
				action: () => {
					showWindow();

					emit(LISTEN_KEY.UPDATE_APP, true);
				},
			}),
			MenuItem.new({
				text: t("component.tray.label.open_source_address"),
				action: () => openUrl(GITHUB_LINK),
			}),
			PredefinedMenuItem.new({ item: "Separator" }),
			MenuItem.new({
				text: `${t("component.tray.label.version")} ${appVersion}`,
				enabled: false,
			}),
			MenuItem.new({
				text: t("component.tray.label.relaunch"),
				action: relaunch,
			}),
			MenuItem.new({
				text: t("component.tray.label.exit"),
				accelerator: isMac ? "Cmd+Q" : void 0,
				action: () => exit(0),
			}),
		]);

		return Menu.new({ items });
	};

	// 更新托盘菜单
	const updateTrayMenu = async () => {
		// 优先使用全局托盘实例
		const tray = globalTrayInstance || await getTrayById();

		if (!tray) return;

		const menu = await getTrayMenu();

		tray.setMenu(menu);
	};

	// 清理全局托盘状态（在应用退出时调用）
	const cleanupGlobalTray = async () => {
		if (globalTrayInstance) {
			try {
				await globalTrayInstance.close();
				console.log('全局托盘清理完成');
			} catch (error) {
				console.error('清理全局托盘失败:', error);
			}
			globalTrayInstance = null;
		}
		isCreatingTray = false;
	};

	return {
		createTray,
		clearAllTrays,
		updateTrayMenu,
		cleanupGlobalTray,
	};
};
