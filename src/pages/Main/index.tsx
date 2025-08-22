import type { AudioRef } from "@/components/Audio";
import Audio from "@/components/Audio";
import type { HistoryTablePayload, TablePayload } from "@/types/database";
import type { Store } from "@/types/store";
import type { EventEmitter } from "ahooks/lib/useEventEmitter";
import { find, findIndex, isNil, last, range } from "lodash-es";
import { nanoid } from "nanoid";
import { createContext } from "react";
import { useSnapshot } from "valtio";
import { syncStore } from "@/stores/sync";
import syncPlugin from "@/plugins/sync";
import Dock from "./components/Dock";
import Float from "./components/Float";

interface State extends TablePayload {
	pin?: boolean;
	list: HistoryTablePayload[];
	activeId?: string;
	eventBusId?: string;
	$eventBus?: EventEmitter<string>;
	quickPasteKeys: string[];
}

const INITIAL_STATE: State = {
	list: [],
	quickPasteKeys: [],
};

interface MainContextValue {
	state: State;
	getList?: (payload?: HistoryTablePayload) => Promise<void>;
}

export const MainContext = createContext<MainContextValue>({
	state: INITIAL_STATE,
});

const Main = () => {
	const { shortcut } = useSnapshot(globalStore);
	const { window } = useSnapshot(clipboardStore);
	const state = useReactive<State>(INITIAL_STATE);
	const audioRef = useRef<AudioRef>(null);
	const $eventBus = useEventEmitter<string>();
	const { createTray } = useTray();

	useMount(() => {
		state.$eventBus = $eventBus;

		// 创建托盘图标
		createTray();

		// 开启剪贴板监听
		startListen();

		// 监听剪贴板更新
		onClipboardUpdate(async (payload) => {
			if (clipboardStore.audio.copy) {
				audioRef.current?.play();
			}

			const { type, value, group } = payload;

			const findItem = find(state.list, { type, value });

			const createTime = formatDate();

			let itemData: HistoryTablePayload;

			if (findItem) {
				if (!clipboardStore.content.autoSort) return;

				const { id } = findItem;

				const index = findIndex(state.list, { id });

				const [targetItem] = state.list.splice(index, 1);

				itemData = { ...targetItem, createTime };
				state.list.unshift(itemData);

				updateSQL("history", { id, createTime });
			} else {
				itemData = {
					...payload,
					createTime,
					id: nanoid(),
					favorite: false,
				};

				if (state.group === group || (isNil(state.group) && !state.favorite)) {
					state.list.unshift(itemData);
				}

				insertSQL("history", itemData);
			}

			// 🚀 自动同步功能：如果启用同步且启用自动同步，上传到云端
			try {
				const { sync } = syncStore;
				if (sync.enabled && sync.autoSync) {
					// 检查数据类型是否在同步范围内
					const shouldSync = (
						(type === 'text' && sync.syncTypes.includes('text')) ||
						(type === 'image' && sync.syncTypes.includes('image')) ||
						(type === 'files' && sync.syncTypes.includes('file'))
					);

					if (shouldSync) {
						// 生成内容hash用于去重（使用简单的字符串hash）
						const hash = 'auto_' + itemData.id + '_' + value.length + '_' + Date.now();
						
						// 构造完整的同步数据，包含所有剩贴板历史字段
						const syncItem = {
							id: itemData.id,
							type: type,
							content: value,
							hash: hash,
							metadata: {
								group: group || 'text',
								subtype: payload.subtype,
								count: payload.count || value.length,
								width: payload.width,
								height: payload.height,
								search: payload.search || value,
								createTime: createTime,
								favorite: itemData.favorite || false,
								note: null, // 新创建的项目默认没有备注
								// 额外信息
								originalId: itemData.id,
								syncedAt: new Date().toISOString(),
								source: 'auto_sync'
							}
						};

						// 上传到云端（不阻塞UI）
						syncPlugin.uploadClipboardItems([syncItem]).then(() => {
							console.log('✅ 剩贴板历史记录自动同步成功:', type, value.substring(0, 50) + '...');
							// 更新最后同步时间
							syncStore.sync.lastSyncTime = new Date().toISOString();
						}).catch((error) => {
							console.warn('⚠️ 剩贴板历史记录自动同步失败:', error.message);
							// 同步失败不影响本地功能
						});
					}
				}
			} catch (error) {
				console.warn('自动同步功能异常:', error);
				// 同步异常不影响本地功能
			}
		});
	});

	// 监听快速粘贴的启用状态变更
	useImmediateKey(globalStore.shortcut.quickPaste, "enable", () => {
		setQuickPasteKeys();
	});

	// 监听快速粘贴的快捷键变更
	useSubscribeKey(globalStore.shortcut.quickPaste, "value", () => {
		setQuickPasteKeys();
	});

	// 监听是否显示任务栏图标
	useImmediateKey(globalStore.app, "showTaskbarIcon", showTaskbarIcon);

	// 监听刷新列表
	useTauriListen(LISTEN_KEY.REFRESH_CLIPBOARD_LIST, () => getList());

	// 监听配置项变化
	useTauriListen<Store>(LISTEN_KEY.STORE_CHANGED, ({ payload }) => {
		deepAssign(globalStore, payload.globalStore);
		deepAssign(clipboardStore, payload.clipboardStore);
	});

	// 切换剪贴板监听状态
	useTauriListen<boolean>(LISTEN_KEY.TOGGLE_LISTEN_CLIPBOARD, ({ payload }) => {
		toggleListen(payload);
	});

	// 监听窗口焦点
	useTauriFocus({
		onBlur() {
			if (state.pin) return;

			hideWindow();
		},
	});

	// 监听窗口显隐的快捷键
	useRegister(toggleWindowVisible, [shortcut.clipboard]);

	// 监听粘贴为纯文本的快捷键
	useKeyPress(shortcut.pastePlain, (event) => {
		event.preventDefault();

		const data = find(state.list, { id: state.activeId });

		pasteClipboard(data, true);
	});

	// 监听快速粘贴的快捷键
	useRegister(
		async (event) => {
			if (!globalStore.shortcut.quickPaste.enable) return;

			const index = Number(last(event.shortcut));

			const data = state.list[index - 1];

			pasteClipboard(data);
		},
		[state.quickPasteKeys],
	);

	// 打开偏好设置窗口
	useKeyPress(PRESET_SHORTCUT.OPEN_PREFERENCES, () => {
		showWindow("preference");
	});

	// 获取剪切板内容
	const getList = async () => {
		const { group, search, favorite } = state;

		state.list = await selectSQL<HistoryTablePayload[]>("history", {
			group,
			search,
			favorite,
		});
	};

	// 设置快捷粘贴的快捷键
	const setQuickPasteKeys = () => {
		const { enable, value } = globalStore.shortcut.quickPaste;

		if (!enable) {
			state.quickPasteKeys = [];

			return;
		}

		state.quickPasteKeys = range(1, 10).map((item) => [value, item].join("+"));
	};

	return (
		<>
			<Audio hiddenIcon ref={audioRef} />

			<MainContext.Provider
				value={{
					state,
					getList,
				}}
			>
				{window.style === "float" ? <Float /> : <Dock />}
			</MainContext.Provider>
		</>
	);
};

export default Main;
