import syncPlugin from "@/plugins/sync";
import { syncStore } from "@/stores/sync";
import {
	CheckCircleOutlined,
	ClockCircleOutlined,
	CloseCircleOutlined,
	CloudOutlined,
	DisconnectOutlined,
	PauseOutlined,
	PlayCircleOutlined,
	ReloadOutlined,
	WifiOutlined,
} from "@ant-design/icons";
import {
	Badge,
	Button,
	Popover,
	Progress,
	Space,
	Tooltip,
	Typography,
} from "antd";
import { useEffect, useState } from "react";
import { useSnapshot } from "valtio";

const { Text } = Typography;

interface SyncStatusProps {
	className?: string;
	showDetails?: boolean;
}

export default function SyncStatus({
	className,
	showDetails = false,
}: SyncStatusProps) {
	const syncStoreSnapshot = useSnapshot(syncStore);
	const [isOpen, setIsOpen] = useState(false);
	const [syncProgress, setSyncProgress] = useState(0);
	const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
	const [connectionStatus, setConnectionStatus] = useState<
		"connected" | "disconnected" | "connecting"
	>("disconnected");
	const [syncStatus, setSyncStatus] = useState<
		"idle" | "syncing" | "error" | "paused"
	>("idle");
	const [_wsConnected, setWsConnected] = useState(false);
	const [networkOnline, setNetworkOnline] = useState(navigator.onLine);

	useEffect(() => {
		// 监听同步状态变化
		syncPlugin.on("sync-status", (event: any) => {
			setSyncStatus(event.status);
			if (event.progress !== undefined) {
				setSyncProgress(event.progress);
			}
		});

		// 监听连接状态变化
		syncPlugin.on("connection-change", (event: any) => {
			setConnectionStatus(event.status);
		});

		// 监听WebSocket状态变化
		syncPlugin.on("websocket-status", (event: any) => {
			setWsConnected(event.connected);
		});

		// 监听网络状态变化
		syncPlugin.on("network-status", (event: any) => {
			setNetworkOnline(event.online);
		});

		// 监听认证状态变化
		syncPlugin.on("auth-status", (event: any) => {
			if (event.authenticated) {
				// 登录成功后重新加载状态
				loadInitialStatus();
			} else {
				// 登出后重置状态
				syncStore.account.isLoggedIn = false;
				syncStore.account.userId = "";
				syncStore.account.email = "";
				syncStore.account.devices = [];
				setConnectionStatus("disconnected");
				setSyncStatus("idle");
				setWsConnected(false);
			}
		});

		// 监听同步更新
		syncPlugin.on("sync-update", (event: any) => {
			if (event.type === "sync_complete") {
				setLastSyncTime(new Date().toLocaleString());
				setSyncProgress(100);
				setTimeout(() => setSyncProgress(0), 2000);
			}
		});

		// 初始化状态
		loadInitialStatus();

		// 清理函数（如果需要的话）
		return () => {
			// 事件监听器清理逻辑
		};
	}, []);

	const loadInitialStatus = async () => {
		// 未登录且本地没有 token 时，不调用受保护接口，避免 401
		const hasToken = localStorage.getItem("ecopaste-auth-token");
		if (!syncStoreSnapshot.account.isLoggedIn && !hasToken) {
			return;
		}

		try {
			const status = await syncPlugin.getSyncStatus();
			setSyncStatus(status.isRunning ? "syncing" : "idle");
			setLastSyncTime(
				status.lastSync ? status.lastSync.toLocaleString() : null,
			);

			// 检查连接状态
			const isConnected = await syncPlugin.testConnection();
			setConnectionStatus(isConnected ? "connected" : "disconnected");

			// 检查WebSocket状态
			const wsStatus = await syncPlugin.getWebSocketStatus();
			setWsConnected(wsStatus.connected);
		} catch (error) {
			console.error("Failed to load sync status:", error);
		}
	};

	const _handleToggleSync = async () => {
		try {
			if (syncStatus === "paused") {
				await syncPlugin.startSyncService();
			} else {
				await syncPlugin.stopSyncService();
			}
		} catch (error) {
			console.error("Failed to toggle sync:", error);
		}
	};

	const handleForceSync = async () => {
		try {
			setSyncStatus("syncing");
			setSyncProgress(0);
			await syncPlugin.forceSyncAll();
		} catch (error) {
			console.error("Failed to force sync:", error);
			setSyncStatus("error");
		}
	};

	const handleReconnectWebSocket = async () => {
		try {
			await syncPlugin.reconnectWebSocket();
		} catch (error) {
			console.error("Failed to reconnect WebSocket:", error);
		}
	};

	const getStatusIcon = () => {
		if (!syncStoreSnapshot.account.isLoggedIn) {
			return (
				<DisconnectOutlined style={{ fontSize: "16px", color: "#d9d9d9" }} />
			);
		}

		switch (syncStatus) {
			case "syncing":
				return (
					<ReloadOutlined spin style={{ fontSize: "16px", color: "#1890ff" }} />
				);
			case "error":
				return (
					<CloseCircleOutlined style={{ fontSize: "16px", color: "#ff4d4f" }} />
				);
			case "paused":
				return <PauseOutlined style={{ fontSize: "16px", color: "#faad14" }} />;
			case "idle":
				return connectionStatus === "connected" ? (
					<CheckCircleOutlined style={{ fontSize: "16px", color: "#52c41a" }} />
				) : (
					<DisconnectOutlined style={{ fontSize: "16px", color: "#d9d9d9" }} />
				);
			default:
				return <CloudOutlined style={{ fontSize: "16px", color: "#d9d9d9" }} />;
		}
	};

	const getStatusText = () => {
		if (!syncStoreSnapshot.account.isLoggedIn) {
			return "未登录";
		}

		switch (syncStatus) {
			case "syncing":
				return "同步中";
			case "error":
				return "同步错误";
			case "paused":
				return "已暂停";
			case "idle":
				return connectionStatus === "connected" ? "已连接" : "已断开";
			default:
				return "未知状态";
		}
	};

	const getStatusColor = () => {
		if (!syncStoreSnapshot.account.isLoggedIn) {
			return "default";
		}

		switch (syncStatus) {
			case "syncing":
				return "processing";
			case "error":
				return "error";
			case "paused":
				return "warning";
			case "idle":
				return connectionStatus === "connected" ? "success" : "default";
			default:
				return "default";
		}
	};

	return (
		<Popover
			content={
				<div style={{ minWidth: 260 }}>
					<Space direction="vertical" size="small" style={{ width: "100%" }}>
						<Space
							align="center"
							style={{ justifyContent: "space-between", width: "100%" }}
						>
							<Space>
								{getStatusIcon()}
								<Text strong>{getStatusText()}</Text>
							</Space>
							<Space>
								<Tooltip title="重新连接">
									<Button
										size="small"
										icon={<ReloadOutlined />}
										onClick={handleReconnectWebSocket}
									/>
								</Tooltip>
							</Space>
						</Space>

						{syncStatus === "syncing" && (
							<Progress percent={syncProgress} size="small" />
						)}

						<Space>
							<WifiOutlined
								style={{ color: networkOnline ? "#52c41a" : "#d9d9d9" }}
							/>
							<Text type="secondary">
								网络: {networkOnline ? "在线" : "离线"}
							</Text>
						</Space>

						{lastSyncTime && (
							<Space>
								<ClockCircleOutlined />
								<Text type="secondary">上次同步: {lastSyncTime}</Text>
							</Space>
						)}

						{showDetails && (
							<Space>
								<Button
									size="small"
									icon={<PlayCircleOutlined />}
									onClick={handleForceSync}
								>
									立即同步
								</Button>
							</Space>
						)}
					</Space>
				</div>
			}
			title={null}
			trigger="hover"
			open={isOpen}
			onOpenChange={setIsOpen}
		>
			<Badge
				status={getStatusColor() as any}
				text={getStatusText()}
				className={className}
			/>
		</Popover>
	);
}
