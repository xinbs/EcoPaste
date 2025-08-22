import type {
	AuthResponse,
	BackupInfo,
	ClipboardItem,
	ConflictResolution,
	Device,
	LoginCredentials,
	NetworkStatus,
	RegisterData,
	RestoreOptions,
	SyncConfig,
	SyncConflict,
	SyncDataRequest,
	SyncDataResponse,
	SyncDevice,
	SyncOptions,
	SyncStats,
	SyncStatus,
	SyncUpdateEvent,
	User,
} from "@/types/sync";
import { getDeviceName } from "@/utils/is";
import { invoke } from "@tauri-apps/api/core";

// 服务端配置
interface ServerConfig {
	baseUrl: string;
	wsUrl: string;
	timeout: number;
}

// 默认服务端配置
const DEFAULT_SERVER_CONFIG: ServerConfig = {
	baseUrl: "http://localhost:3001",
	wsUrl: "ws://localhost:3001/ws",
	timeout: 10000,
};

/**
 * 同步插件类
 * 封装所有与同步相关的功能，包括服务端API调用和WebSocket连接
 */
export class SyncPlugin {
	private static instance: SyncPlugin;
	private eventListeners: Map<string, Function[]> = new Map();
	private serverConfig: ServerConfig = DEFAULT_SERVER_CONFIG;
	private ws: WebSocket | null = null;
	private authToken: string | null = null;
	private reconnectAttempts = 0;
	private maxReconnectAttempts = 5;
	private reconnectDelay = 1000;

	private constructor() {
		this.initEventListeners();
		this.loadServerConfig();
		this.startHeartbeat();
	}

	public static getInstance(): SyncPlugin {
		if (!SyncPlugin.instance) {
			SyncPlugin.instance = new SyncPlugin();
		}
		return SyncPlugin.instance;
	}

	/**
	 * 加载服务端配置
	 */
	private loadServerConfig() {
		try {
			const saved = localStorage.getItem("ecopaste-server-config");
			if (saved) {
				this.serverConfig = { ...DEFAULT_SERVER_CONFIG, ...JSON.parse(saved) };
			}
		} catch (error) {
			console.warn("加载服务端配置失败:", error);
		}
	}

	/**
	 * 保存服务端配置
	 */
	private saveServerConfig() {
		try {
			localStorage.setItem(
				"ecopaste-server-config",
				JSON.stringify(this.serverConfig),
			);
		} catch (error) {
			console.warn("保存服务端配置失败:", error);
		}
	}

	/**
	 * 设置服务端配置
	 */
	public setServerConfig(config: Partial<ServerConfig>) {
		this.serverConfig = { ...this.serverConfig, ...config };
		this.saveServerConfig();

		// 重新连接WebSocket
		if (this.ws) {
			this.disconnectWebSocket();
			if (this.authToken) {
				this.connectWebSocket();
			}
		}
	}

	/**
	 * 获取服务端配置
	 */
	public getServerConfig(): ServerConfig {
		return { ...this.serverConfig };
	}

	/**
	 * 初始化事件监听器
	 */
	private async initEventListeners() {
		// 检查是否在 Tauri 环境中
		if (typeof window !== "undefined" && (window as any).__TAURI__) {
			try {
				const { listen } = await import("@tauri-apps/api/event");
				// 监听同步更新事件
				await listen<SyncUpdateEvent>("sync-update", (event) => {
					this.emit("sync-update", event.payload);
				});

				// 监听冲突检测事件
				await listen<SyncConflict>("conflict-detected", (event) => {
					this.emit("conflict-detected", event.payload);
				});

				// 监听设备状态变化事件
				await listen<{ deviceId: string; isOnline: boolean }>(
					"device-status-changed",
					(event) => {
						this.emit("device-status-changed", event.payload);
					},
				);

				// 监听同步状态变化事件
				await listen<SyncStatus>("sync-status-changed", (event) => {
					this.emit("sync-status-changed", event.payload);
				});

				// 监听连接状态变化事件
				await listen<{ connected: boolean }>(
					"connection-status-changed",
					(event) => {
						this.emit("connection-status-changed", event.payload);
					},
				);

				// 监听错误事件
				await listen<{ message: string; code?: string }>(
					"sync-error",
					(event) => {
						this.emit("sync-error", event.payload);
					},
				);
			} catch (error) {
				console.warn("初始化 Tauri 事件监听器失败:", error);
			}
		}

		// 监听网络状态变化（浏览器和 Tauri 环境都支持）
		if (typeof window !== "undefined") {
			window.addEventListener("online", () => {
				this.emit("network-status", { online: true });
				if (this.authToken) {
					this.connectWebSocket();
				}
			});

			window.addEventListener("offline", () => {
				this.emit("network-status", { online: false });
				this.disconnectWebSocket();
			});
		}
	}

	/**
	 * 清理同步数据
	 */
	async cleanupSyncData(olderThan?: Date): Promise<void> {
		try {
			const params = new URLSearchParams();
			if (olderThan) {
				params.append("olderThan", olderThan.toISOString());
			}

			const url = `/api/sync/cleanup${params.toString() ? `?${params.toString()}` : ""}`;
			await this.apiRequest(url, {
				method: "POST",
			});

			this.emit("data-cleaned", { olderThan });
		} catch (error) {
			console.error("清理同步数据失败:", error);
			throw error;
		}
	}

	/**
	 * 导出同步数据
	 */
	async exportSyncData(format: "json" | "csv" = "json"): Promise<string> {
		try {
			const response = await this.apiRequest(
				`/api/sync/export?format=${format}`,
			);
			return response.data || "";
		} catch (error) {
			console.error("导出同步数据失败:", error);
			throw error;
		}
	}

	/**
	 * 导入同步数据
	 */
	async importSyncData(
		data: string,
		format: "json" | "csv" = "json",
	): Promise<void> {
		try {
			await this.apiRequest("/api/sync/import", {
				method: "POST",
				body: JSON.stringify({ data, format }),
			});

			this.emit("data-imported", { format });
		} catch (error) {
			console.error("导入同步数据失败:", error);
			throw error;
		}
	}

	/**
	 * 搜索同步数据
	 */
	async searchSyncData(
		query: string,
		options?: { limit?: number; offset?: number },
	): Promise<ClipboardItem[]> {
		try {
			const params = new URLSearchParams();
			params.append("q", query);
			if (options?.limit) {
				params.append("limit", options.limit.toString());
			}
			if (options?.offset) {
				params.append("offset", options.offset.toString());
			}

			const response = await this.apiRequest(
				`/api/sync/search?${params.toString()}`,
			);
			return response.items || [];
		} catch (error) {
			console.error("搜索同步数据失败:", error);
			return [];
		}
	}

	/**
	 * 发送心跳
	 */
	public sendHeartbeat(): void {
		this.sendWebSocketMessage({
			type: "PING",
			timestamp: Date.now(),
		});
	}

	/**
	 * 启动心跳检测
	 */
	private startHeartbeat(): void {
		// 每30秒发送一次心跳
		setInterval(() => {
			if (this.ws && this.ws.readyState === WebSocket.OPEN) {
				this.sendHeartbeat();
			}
		}, 30000);
	}

	/**
	 * 获取WebSocket连接状态
	 */
	public getWebSocketStatus(): { connected: boolean; readyState?: number } {
		return {
			connected: this.ws?.readyState === WebSocket.OPEN || false,
			readyState: this.ws?.readyState,
		};
	}

	/**
	 * 手动重连WebSocket
	 */
	public reconnectWebSocket(): void {
		this.disconnectWebSocket();
		if (this.authToken) {
			this.connectWebSocket();
		}
	}

	/**
	 * 添加事件监听器
	 */
	public on(event: string, callback: Function) {
		if (!this.eventListeners.has(event)) {
			this.eventListeners.set(event, []);
		}
		this.eventListeners.get(event)!.push(callback);
	}

	/**
	 * 移除事件监听器
	 */
	public off(event: string, callback: Function) {
		const listeners = this.eventListeners.get(event);
		if (listeners) {
			const index = listeners.indexOf(callback);
			if (index > -1) {
				listeners.splice(index, 1);
			}
		}
	}

	/**
	 * 触发事件
	 */
	private emit(event: string, data: any) {
		const listeners = this.eventListeners.get(event);
		if (listeners) {
			listeners.forEach((callback) => callback(data));
		}
	}

	// ==================== 认证相关 ====================// 认证相关方法

	/**
	 * 用户登录
	 */
	async login(credentials: LoginCredentials): Promise<AuthResponse> {
		try {
			// 自动获取设备名称
			const deviceName = await getDeviceName();

			const response = await this.apiRequest("/api/auth/login", {
				method: "POST",
				body: JSON.stringify({
					username: credentials.email,
					password: credentials.password,
					deviceName: deviceName,
					deviceType: "desktop",
					platform: navigator.platform,
				}),
			});

			if (response.token) {
				this.authToken = response.token;
				localStorage.setItem("ecopaste-auth-token", response.token);

				// 保存设备ID用于WebSocket认证
				if (response.device?.id) {
					localStorage.setItem("ecopaste-device-id", response.device.id);
				}

				// 连接WebSocket
				this.connectWebSocket();

				this.emit("auth-status", { authenticated: true, user: response.user });
			}

			return response;
		} catch (error) {
			this.emit("auth-status", { authenticated: false, error });
			throw error;
		}
	}

	/**
	 * 用户注册
	 */
	async register(data: RegisterData): Promise<AuthResponse> {
		try {
			// 验证必填字段
			if (!data.email || !data.password) {
				throw new Error("邮箱和密码不能为空");
			}

			// 自动获取设备名称
			const deviceName = await getDeviceName();

			const response = await this.apiRequest("/api/auth/register", {
				method: "POST",
				body: JSON.stringify({
					username: data.email, // 使用email作为username
					password: data.password,
					email: data.email,
					deviceName: deviceName,
					deviceType: "desktop",
					platform: navigator.platform,
				}),
			});

			if (response.token) {
				this.authToken = response.token;
				localStorage.setItem("ecopaste-auth-token", response.token);

				// 保存设备ID用于WebSocket认证
				if (response.device?.id) {
					localStorage.setItem("ecopaste-device-id", response.device.id);
				}

				// 连接WebSocket
				this.connectWebSocket();

				this.emit("auth-status", { authenticated: true, user: response.user });
			}

			return response;
		} catch (error) {
			this.emit("auth-status", { authenticated: false, error });
			throw error;
		}
	}

	/**
	 * 用户登出
	 */
	async logout(): Promise<void> {
		try {
			if (this.authToken) {
				await this.apiRequest("/api/auth/logout", {
					method: "POST",
					body: JSON.stringify({ token: this.authToken }),
				});
			}
		} catch (error) {
			console.warn("登出请求失败:", error);
		} finally {
			this.authToken = null;
			localStorage.removeItem("ecopaste-auth-token");
			localStorage.removeItem("ecopaste-device-id");
			this.disconnectWebSocket();
			this.emit("auth-status", { authenticated: false });
		}
	}

	/**
	 * 检查认证状态
	 */
	async checkAuthStatus(): Promise<boolean> {
		try {
			const token = localStorage.getItem("ecopaste-auth-token");
			if (!token) {
				return false;
			}

			this.authToken = token;

			// 验证token有效性
			await this.apiRequest("/api/sync/stats");

			// 连接WebSocket
			this.connectWebSocket();

			this.emit("auth-status", { authenticated: true });
			return true;
		} catch (_error) {
			this.authToken = null;
			localStorage.removeItem("ecopaste-auth-token");
			this.emit("auth-status", { authenticated: false });
			return false;
		}
	}

	/**
	 * 获取当前用户信息
	 */
	async getCurrentUser(): Promise<User | null> {
		try {
			if (!this.authToken) {
				return null;
			}

			const response = await this.apiRequest("/api/auth/me");
			return response.user || null;
		} catch (error) {
			console.warn("获取用户信息失败:", error);
			return null;
		}
	}

	/**
	 * 发起API请求
	 */
	private async apiRequest(
		endpoint: string,
		options: RequestInit = {},
	): Promise<any> {
		const url = `${this.serverConfig.baseUrl}${endpoint}`;

		const headers: Record<string, string> = {
			"Content-Type": "application/json",
			...((options.headers as Record<string, string>) || {}),
		};

		if (this.authToken) {
			headers.Authorization = `Bearer ${this.authToken}`;
		}

		const controller = new AbortController();
		const timeoutId = setTimeout(
			() => controller.abort(),
			this.serverConfig.timeout,
		);

		try {
			const response = await fetch(url, {
				...options,
				headers,
				signal: controller.signal,
			});

			clearTimeout(timeoutId);

			if (!response.ok) {
				// 处理401未授权错误
				if (response.status === 401) {
					const isAuthEndpoint =
						endpoint.includes("/api/auth/login") ||
						endpoint.includes("/api/auth/register") ||
						endpoint.includes("/api/auth/refresh");
					if (!isAuthEndpoint) {
						this.authToken = null;
						localStorage.removeItem("ecopaste-auth-token");
						this.emit("auth-status", { authenticated: false });
					}
				}

				const error = await response
					.json()
					.catch(() => ({ message: response.statusText }));
				throw new Error(error.message || `HTTP ${response.status}`);
			}

			return await response.json();
		} catch (error) {
			clearTimeout(timeoutId);
			if (error instanceof Error && error.name === "AbortError") {
				throw new Error("请求超时");
			}
			throw error;
		}
	}

	/**
	 * 连接WebSocket
	 */
	private connectWebSocket() {
		if (this.ws && this.ws.readyState === WebSocket.OPEN) {
			return;
		}

		if (!this.authToken) {
			console.warn("无认证token，跳过WebSocket连接");
			return;
		}

		try {
			this.ws = new WebSocket(this.serverConfig.wsUrl);

			this.ws.onopen = () => {
				this.reconnectAttempts = 0;

				// 发送认证消息（后端期望小写type，且需要data包含token和deviceId）
				const deviceId = localStorage.getItem("ecopaste-device-id");
				if (!deviceId) {
					console.warn("未找到设备ID，跳过WebSocket认证");
				} else if (!this.authToken) {
					console.warn("无认证token，跳过WebSocket认证");
				} else {
					this.sendWebSocketMessage({
						type: "auth",
						data: {
							token: this.authToken,
							deviceId,
						},
					});
				}

				this.emit("websocket-status", { connected: true });
			};

			this.ws.onmessage = (event) => {
				try {
					const message = JSON.parse(event.data);
					this.handleWebSocketMessage(message);
				} catch (error) {
					console.warn("解析WebSocket消息失败:", error);
				}
			};

			this.ws.onclose = (_event) => {
				this.emit("websocket-status", { connected: false });

				// 自动重连
				if (
					this.authToken &&
					this.reconnectAttempts < this.maxReconnectAttempts
				) {
					this.reconnectAttempts++;
					const delay = this.reconnectDelay * 2 ** (this.reconnectAttempts - 1);

					setTimeout(() => {
						this.connectWebSocket();
					}, delay);
				}
			};

			this.ws.onerror = (error) => {
				console.error("WebSocket错误:", error);
				this.emit("websocket-error", { error });
			};
		} catch (error) {
			console.error("创建WebSocket连接失败:", error);
		}
	}

	/**
	 * 断开WebSocket连接
	 */
	private disconnectWebSocket() {
		if (this.ws) {
			this.ws.close();
			this.ws = null;
		}
		this.reconnectAttempts = 0;
	}

	/**
	 * 发送WebSocket消息
	 */
	private sendWebSocketMessage(message: any) {
		if (this.ws && this.ws.readyState === WebSocket.OPEN) {
			this.ws.send(JSON.stringify(message));
		} else {
			console.warn("WebSocket未连接，无法发送消息");
		}
	}

	/**
	 * 处理WebSocket消息
	 */
	private handleWebSocketMessage(message: any) {
		switch (message.type) {
			case "SUCCESS":
			case "success": {
				if (
					message.message === "认证成功" ||
					message.message === "Authentication successful"
				) {
				}
				break;
			}

			case "ERROR":
			case "error": {
				console.error("WebSocket错误:", message.message);
				if (
					typeof message.message === "string" &&
					message.message.includes("认证")
				) {
					// 认证失败，清除token
					this.logout();
				}
				break;
			}

			case "CLIPBOARD_UPDATE":
			case "clipboard_update":
				this.emit("clipboard-update", message.data || message);
				break;

			case "DEVICE_STATUS":
			case "device_status":
				this.emit("device-status", message.data || message);
				break;

			case "SYNC":
			case "sync":
				this.emit("sync-update", message.data || message);
				break;

			case "PONG":
			case "pong":
				// 心跳响应
				break;

			default:
		}
	}

	/**
	 * 刷新认证令牌
	 */
	async refreshToken(): Promise<string | null> {
		return invoke("plugin:eco-sync|refresh_token");
	}

	// ==================== 设备管理 ====================

	/**
	 * 注册设备
	 */
	async registerDevice(device: SyncDevice): Promise<Device> {
		try {
			const response = await this.apiRequest("/api/device/register", {
				method: "POST",
				body: JSON.stringify({
					name: device.name,
					type: device.deviceType,
					platform: device.platform,
				}),
			});
			return response.device;
		} catch (error) {
			console.error("注册设备失败:", error);
			throw error;
		}
	}

	/**
	 * 获取设备列表
	 */
	async getDevices(): Promise<Device[]> {
		try {
			const response = await this.apiRequest("/api/device/list");
			return response.devices || [];
		} catch (error) {
			console.error("获取设备列表失败:", error);
			return [];
		}
	}

	/**
	 * 移除设备
	 */
	async removeDevice(deviceId: string): Promise<void> {
		try {
			await this.apiRequest(`/api/device/${deviceId}`, {
				method: "DELETE",
			});
		} catch (error) {
			console.error("删除设备失败:", error);
			throw error;
		}
	}

	/**
	 * 更新设备信息
	 */
	async updateDevice(
		deviceId: string,
		updates: Partial<Device>,
	): Promise<Device> {
		try {
			const response = await this.apiRequest(`/api/device/${deviceId}`, {
				method: "PUT",
				body: JSON.stringify(updates),
			});
			return response.device;
		} catch (error) {
			console.error("更新设备失败:", error);
			throw error;
		}
	}

	/**
	 * 获取当前设备信息
	 */
	async getCurrentDevice(): Promise<Device | null> {
		return invoke("plugin:eco-sync|get_current_device");
	}

	// ==================== 数据同步 ====================

	/**
	 * 同步数据
	 */
	async syncData(
		request: SyncDataRequest,
		options?: SyncOptions,
	): Promise<SyncDataResponse> {
		try {
			const response = await this.apiRequest("/api/sync/upload", {
				method: "POST",
				body: JSON.stringify({
					items: request.items,
					deviceId: request.deviceId,
					lastSyncTime: request.lastSyncTime,
					options,
				}),
			});

			// 通过WebSocket通知其他设备
			this.sendWebSocketMessage({
				type: "SYNC",
				data: {
					action: "upload",
					count: request.items.length,
					timestamp: Date.now(),
				},
			});

			return response;
		} catch (error) {
			console.error("同步数据失败:", error);
			throw error;
		}
	}

	/**
	 * 拉取更新
	 */
	async pullUpdates(lastSyncTime?: Date): Promise<ClipboardItem[]> {
		try {
			const params = new URLSearchParams();
			if (lastSyncTime) {
				params.append("since", lastSyncTime.getTime().toString());
			}

			const url = `/api/sync/pull${params.toString() ? `?${params.toString()}` : ""}`;
			const response = await this.apiRequest(url);

			return response.items || [];
		} catch (error) {
			console.error("拉取更新失败:", error);
			throw error;
		}
	}

	/**
	 * 推送数据
	 */
	async pushData(items: ClipboardItem[]): Promise<void> {
		try {
			await this.apiRequest("/api/sync/push", {
				method: "POST",
				body: JSON.stringify({ items }),
			});

			// 通过WebSocket通知其他设备
			this.sendWebSocketMessage({
				type: "SYNC",
				data: {
					action: "push",
					count: items.length,
					timestamp: Date.now(),
				},
			});
		} catch (error) {
			console.error("推送数据失败:", error);
			throw error;
		}
	}

	/**
	 * 上传剪贴板数据项
	 */
	async uploadClipboardItems(items: any[]): Promise<void> {
		try {
			await this.apiRequest("/api/sync/upload", {
				method: "POST",
				body: JSON.stringify({ items }),
			});

			this.emit("items-uploaded", { count: items.length });
		} catch (error) {
			console.error("上传剪贴板数据失败:", error);
			throw error;
		}
	}

	/**
	 * 强制全量同步
	 */
	async forceSyncAll(): Promise<void> {
		try {
			// 首先获取本地数据库中的所有剪贴板数据
			const { selectSQL } = await import("@/database");
			const localItems = (await selectSQL("history", {})) as any[];

			if (localItems.length > 0) {
				// 转换为同步格式，确保包含所有字段
				const syncItems = localItems
					.map((item, index) => {
						try {
							// 生成简单的哈希值，避免btoa可能的编码问题
							const content = item.value || "";
							const hash = `local_${item.id}_${content.length}_${Date.now()}_${index}`;

							return {
								id: item.id,
								type: item.type || "text",
								content: content,
								hash: hash,
								metadata: {
									group: item.group || "text",
									subtype: item.subtype,
									count: item.count || content.length,
									width: item.width,
									height: item.height,
									search: item.search || content,
									createTime: item.createTime || new Date().toISOString(),
									favorite: Boolean(item.favorite),
									note: item.note || null, // 包含备注字段
									// 额外信息
									originalId: item.id,
									syncedAt: new Date().toISOString(),
									source: "local_history",
								},
							};
						} catch (itemError) {
							console.error("处理单个剩贴板记录失败:", itemError, item);
							return null;
						}
					})
					.filter((item) => item !== null); // 过滤掉失败的项

				// 显示首几条记录的简要信息
				syncItems.slice(0, 3).forEach((_item, _index) => {});
				if (syncItems.length > 3) {
				}

				// 上传本地剩贴板历史记录
				await this.uploadClipboardItems(syncItems);
			} else {
			}

			// 然后执行常规强制同步（触发服务端统计）
			await this.apiRequest("/api/sync/force-all", {
				method: "POST",
			});

			this.emit("sync-started", { forced: true, fullSync: true });
		} catch (error) {
			console.error("❌ 强制全量同步失败:", error);

			// 提供更详细的错误信息
			if (error instanceof Error) {
				if (error.message.includes("Failed to fetch")) {
					throw new Error("网络连接失败，请检查服务器是否正常运行");
				}
				if (error.message.includes("401")) {
					throw new Error("认证失败，请重新登录");
				}
				if (error.message.includes("selectSQL")) {
					throw new Error("无法读取本地剩贴板历史记录，请确保应用正在运行");
				}
				throw new Error(`同步失败: ${error.message}`);
			}
			throw new Error("未知错误，请重试");
		}
	}

	/**
	 * 获取同步状态
	 */
	async getSyncStatus(): Promise<SyncStatus> {
		try {
			const response = await this.apiRequest("/api/sync/status");
			return {
				isRunning: response.isRunning || false,
				lastSync: response.lastSync || null,
				nextSync: response.nextSync || null,
				itemsToSync: response.itemsToSync || 0,
				syncProgress: response.syncProgress || 0,
				error: response.error || null,
			};
		} catch (error) {
			console.error("获取同步状态失败:", error);
			return {
				isRunning: false,
				lastSync: null,
				nextSync: null,
				itemsToSync: 0,
				syncProgress: 0,
				error: error instanceof Error ? error.message : "Unknown error",
			};
		}
	}

	/**
	 * 获取同步统计
	 */
	async getSyncStats(): Promise<SyncStats> {
		try {
			const response = await this.apiRequest("/api/sync/stats");
			return {
				totalSynced: response.totalSynced || 0,
				syncedToday: response.syncedToday || 0,
				conflictsResolved: response.conflictsResolved || 0,
				lastSyncDuration: response.lastSyncDuration || 0,
			};
		} catch (error) {
			console.error("获取同步统计失败:", error);
			return {
				totalSynced: 0,
				syncedToday: 0,
				conflictsResolved: 0,
				lastSyncDuration: 0,
			};
		}
	}

	// ==================== 冲突解决 ====================

	/**
	 * 解决同步冲突
	 */
	async resolveConflict(
		conflictId: string,
		resolution: ConflictResolution,
	): Promise<void> {
		try {
			await this.apiRequest(`/api/sync/conflicts/${conflictId}/resolve`, {
				method: "POST",
				body: JSON.stringify({ resolution }),
			});

			this.emit("conflict-resolved", { conflictId, resolution });
		} catch (error) {
			console.error("解决冲突失败:", error);
			throw error;
		}
	}

	/**
	 * 获取待解决的冲突
	 */
	async getPendingConflicts(): Promise<SyncConflict[]> {
		try {
			const response = await this.apiRequest("/api/sync/conflicts");
			return response.conflicts || [];
		} catch (error) {
			console.error("获取待解决冲突失败:", error);
			return [];
		}
	}

	/**
	 * 批量解决冲突
	 */
	async batchResolveConflicts(
		resolutions: { conflictId: string; resolution: ConflictResolution }[],
	): Promise<void> {
		try {
			await this.apiRequest("/api/sync/conflicts/batch-resolve", {
				method: "POST",
				body: JSON.stringify({ resolutions }),
			});

			this.emit("conflicts-resolved", { count: resolutions.length });
		} catch (error) {
			console.error("批量解决冲突失败:", error);
			throw error;
		}
	}

	// ==================== 配置管理 ====================

	/**
	 * 更新同步配置
	 */
	async updateSyncConfig(config: Partial<SyncConfig>): Promise<void> {
		try {
			await this.apiRequest("/api/sync/config", {
				method: "PUT",
				body: JSON.stringify(config),
			});

			this.emit("config-updated", config);
		} catch (error) {
			console.error("更新同步配置失败:", error);
			throw error;
		}
	}

	/**
	 * 获取同步配置
	 */
	async getSyncConfig(): Promise<SyncConfig> {
		try {
			const response = await this.apiRequest("/api/sync/config");
			return {
				enabled: response.enabled || true,
				autoSync: response.autoSync || false,
				syncInterval: response.syncInterval || 30000,
				maxItems: response.maxItems || 1000,
				encryptionEnabled: response.encryptionEnabled || true,
				conflictResolution: response.conflictResolution || "manual",
				syncTypes: response.syncTypes || {
					text: true,
					image: true,
					file: true,
				},
				retentionDays: response.retentionDays || 30,
			};
		} catch (error) {
			console.error("获取同步配置失败:", error);
			// 返回默认配置
			return {
				enabled: true,
				autoSync: false,
				syncInterval: 30000,
				maxItems: 1000,
				encryptionEnabled: true,
				conflictResolution: "manual",
				syncTypes: {
					text: true,
					image: true,
					file: true,
				},
				retentionDays: 30,
			};
		}
	}

	/**
	 * 重置同步配置
	 */
	async resetSyncConfig(): Promise<void> {
		try {
			await this.apiRequest("/api/sync/config/reset", {
				method: "POST",
			});

			this.emit("config-reset", {});
		} catch (error) {
			console.error("重置同步配置失败:", error);
			throw error;
		}
	}

	// ==================== 备份与恢复 ====================

	/**
	 * 创建备份
	 */
	async createBackup(name?: string): Promise<BackupInfo> {
		try {
			const response = await this.apiRequest("/api/sync/backup", {
				method: "POST",
				body: JSON.stringify({
					name: name || `备份_${new Date().toISOString()}`,
				}),
			});

			this.emit("backup-created", response.backup);
			return response.backup;
		} catch (error) {
			console.error("创建备份失败:", error);
			throw error;
		}
	}

	/**
	 * 获取备份列表
	 */
	async getBackups(): Promise<BackupInfo[]> {
		try {
			const response = await this.apiRequest("/api/sync/backups");
			return response.backups || [];
		} catch (error) {
			console.error("获取备份列表失败:", error);
			return [];
		}
	}

	/**
	 * 恢复备份
	 */
	async restoreBackup(
		backupId: string,
		options?: RestoreOptions,
	): Promise<void> {
		try {
			await this.apiRequest(`/api/sync/backups/${backupId}/restore`, {
				method: "POST",
				body: JSON.stringify({ options }),
			});

			this.emit("backup-restored", { backupId, options });
		} catch (error) {
			console.error("恢复备份失败:", error);
			throw error;
		}
	}

	/**
	 * 删除备份
	 */
	async deleteBackup(backupId: string): Promise<void> {
		try {
			await this.apiRequest(`/api/sync/backups/${backupId}`, {
				method: "DELETE",
			});

			this.emit("backup-deleted", { backupId });
		} catch (error) {
			console.error("删除备份失败:", error);
			throw error;
		}
	}

	// ==================== 网络状态 ====================

	/**
	 * 获取网络状态
	 */
	async getNetworkStatus(): Promise<NetworkStatus> {
		try {
			// 检查浏览器网络状态
			const isOnline = navigator.onLine;

			if (!isOnline) {
				return {
					isOnline: false,
					connectionType: "unknown",
				};
			}

			// 测试服务器连接
			const startTime = Date.now();
			await this.apiRequest("/api/health");
			const latency = Date.now() - startTime;

			return {
				isOnline: true,
				connectionType: "unknown",
				latency,
			};
		} catch (_error) {
			return {
				isOnline: navigator.onLine,
				connectionType: "unknown",
			};
		}
	}

	/**
	 * 测试连接
	 */
	async testConnection(): Promise<{ success: boolean; latency?: number }> {
		return invoke("plugin:eco-sync|test_connection");
	}

	// ==================== 服务控制 ====================

	/**
	 * 启动同步服务
	 */
	async startSyncService(): Promise<void> {
		return invoke("plugin:eco-sync|start_sync_service");
	}

	/**
	 * 停止同步服务
	 */
	async stopSyncService(): Promise<void> {
		return invoke("plugin:eco-sync|stop_sync_service");
	}

	/**
	 * 重启同步服务
	 */
	async restartSyncService(): Promise<void> {
		return invoke("plugin:eco-sync|restart_sync_service");
	}

	/**
	 * 获取服务状态
	 */
	async getServiceStatus(): Promise<{ running: boolean; uptime?: number }> {
		return invoke("plugin:eco-sync|get_service_status");
	}

	// ==================== 加密管理 ====================

	/**
	 * 生成加密密钥
	 */
	async generateEncryptionKey(): Promise<string> {
		return invoke("plugin:eco-sync|generate_encryption_key");
	}

	/**
	 * 设置加密密钥
	 */
	async setEncryptionKey(key: string): Promise<void> {
		return invoke("plugin:eco-sync|set_encryption_key", { key });
	}

	/**
	 * 验证加密密钥
	 */
	async verifyEncryptionKey(key: string): Promise<boolean> {
		return invoke("plugin:eco-sync|verify_encryption_key", { key });
	}

	/**
	 * 清除加密密钥
	 */
	async clearEncryptionKey(): Promise<void> {
		return invoke("plugin:eco-sync|clear_encryption_key");
	}

	// ==================== 诊断与调试 ====================

	/**
	 * 获取诊断信息
	 */
	async getDiagnostics(): Promise<any> {
		return invoke("plugin:eco-sync|get_diagnostics");
	}

	/**
	 * 清理缓存
	 */
	async clearCache(): Promise<void> {
		return invoke("plugin:eco-sync|clear_cache");
	}

	/**
	 * 重置同步状态
	 */
	async resetSyncState(): Promise<void> {
		return invoke("plugin:eco-sync|reset_sync_state");
	}

	/**
	 * 导出日志
	 */
	async exportLogs(): Promise<string> {
		return invoke("plugin:eco-sync|export_logs");
	}

	/**
	 * 获取版本信息
	 */
	async getVersion(): Promise<{ version: string; buildDate: string }> {
		return invoke("plugin:eco-sync|get_version");
	}
}

// 创建单例实例
const syncPlugin = SyncPlugin.getInstance();

export default syncPlugin;
