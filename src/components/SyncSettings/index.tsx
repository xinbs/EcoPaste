import syncPlugin from "@/plugins/sync";
import { syncStore } from "@/stores/sync";
import {
	CloudOutlined,
	DeleteOutlined,
	DesktopOutlined,
	DisconnectOutlined,
	ExclamationCircleOutlined,
	EyeInvisibleOutlined,
	EyeOutlined,
	GlobalOutlined,
	MobileOutlined,
	ReloadOutlined,
	SaveOutlined,
	SettingOutlined,
	WifiOutlined,
} from "@ant-design/icons";
import {
	Alert,
	Badge,
	Button,
	Card,
	Divider,
	Form,
	Input,
	Modal,
	Select,
	Space,
	Switch,
	Tabs,
	Typography,
	message,
} from "antd";
import { useEffect, useState } from "react";
import { useSnapshot } from "valtio";

const { Title, Text } = Typography;
const { TabPane } = Tabs;
const { Option } = Select;

interface SyncSettingsProps {
	onClose?: () => void;
}

export default function SyncSettings({}: SyncSettingsProps) {
	const syncStoreSnapshot = useSnapshot(syncStore);
	const [isLoading, setIsLoading] = useState(false);
	const [loginForm, setLoginForm] = useState({ email: "", password: "" });
	const [registerForm, setRegisterForm] = useState({
		email: "",
		password: "",
		confirmPassword: "",
	});
	const [conflictDialogOpen, setConflictDialogOpen] = useState(false);
	const [selectedConflict, setSelectedConflict] = useState<any>(null);
	const [serverConfigOpen, setServerConfigOpen] = useState(false);
	const [serverConfig, setServerConfig] = useState({
		baseUrl: "",
		wsUrl: "",
		timeout: 10000,
	});
	const [networkStatus, setNetworkStatus] = useState<any>(null);
	const [wsStatus, setWsStatus] = useState<{
		connected: boolean;
		readyState?: number;
	}>({ connected: false });

	useEffect(() => {
		// 检查认证状态
		checkAuthStatus();
		// 加载设备列表
		loadDevices();
		// 加载冲突列表
		loadConflicts();
		// 加载服务端配置
		loadServerConfig();
		// 检查网络状态
		checkNetworkStatus();

		// 监听WebSocket状态变化
		const handleWebSocketStatus = (status: { connected: boolean }) => {
			setWsStatus(status);
		};

		// 监听认证状态变化
		const handleAuthStatus = (status: { authenticated: boolean }) => {
			if (status.authenticated) {
				// 认证成功后重新检查状态
				checkNetworkStatus();
			}
		};

		syncPlugin.on("websocket-status", handleWebSocketStatus);
		syncPlugin.on("auth-status", handleAuthStatus);

		// 清理函数
		return () => {
			syncPlugin.off("websocket-status", handleWebSocketStatus);
			syncPlugin.off("auth-status", handleAuthStatus);
		};
	}, []);

	const checkAuthStatus = async () => {
		try {
			const status = await syncPlugin.checkAuthStatus();
			if (status) {
				syncStore.account.isLoggedIn = true;
				// 获取用户信息
				const user = await syncPlugin.getCurrentUser();
				if (user) {
					syncStore.account.userId = user.id;
					syncStore.account.email = user.email;
				}
			} else {
				// 确保在认证失败时重置状态
				syncStore.account.isLoggedIn = false;
				syncStore.account.userId = "";
				syncStore.account.email = "";
			}
		} catch (error) {
			console.error("Failed to check auth status:", error);
			// 发生错误时也要重置状态
			syncStore.account.isLoggedIn = false;
			syncStore.account.userId = "";
			syncStore.account.email = "";
		}
	};

	const loadDevices = async () => {
		try {
			const devices = await syncPlugin.getDevices();
			syncStore.account.devices = devices.map((device) => ({
				...device,
				lastActive: device.lastSeen
					? device.lastSeen.toISOString()
					: new Date().toISOString(),
			}));
		} catch (error) {
			console.error("Failed to load devices:", error);
		}
	};

	const loadConflicts = async () => {
		try {
			const conflicts = await syncPlugin.getPendingConflicts();
			syncStore.conflicts = conflicts.map((conflict) => ({
				...conflict,
				timestamp: conflict.createdAt
					? conflict.createdAt.toISOString()
					: new Date().toISOString(),
			}));
		} catch (error) {
			console.error("Failed to load conflicts:", error);
		}
	};

	const loadServerConfig = async () => {
		try {
			const config = await syncPlugin.getServerConfig();
			setServerConfig(config);
		} catch (error) {
			console.error("Failed to load server config:", error);
		}
	};

	const checkNetworkStatus = async () => {
		try {
			const status = await syncPlugin.getNetworkStatus();
			setNetworkStatus(status);
			const wsStatus = syncPlugin.getWebSocketStatus();
			setWsStatus(wsStatus);
		} catch (error) {
			console.error("Failed to check network status:", error);
		}
	};

	const handleServerConfigSave = async () => {
		try {
			setIsLoading(true);
			await syncPlugin.setServerConfig(serverConfig);
			setServerConfigOpen(false);
			message.success("服务端配置已保存");
			await checkNetworkStatus();
		} catch (error: any) {
			message.error(error.message || "保存配置失败");
		} finally {
			setIsLoading(false);
		}
	};

	const handleReconnect = () => {
		syncPlugin.reconnectWebSocket();
		message.info("正在重新连接...");
	};

	const handleLogin = async () => {
		if (!loginForm.email || !loginForm.password) {
			message.error("请填写邮箱和密码");
			return;
		}

		setIsLoading(true);
		try {
			await syncPlugin.login({
				email: loginForm.email,
				password: loginForm.password,
			});

			// 只要未抛错即视为成功
			syncStore.account.isLoggedIn = true;
			syncStore.account.email = loginForm.email;
			// 尝试从后端再取一次当前用户，拿到更准确信息
			const user = await syncPlugin.getCurrentUser();
			syncStore.account.userId = user?.id || "";

			message.success("登录成功");
			setLoginForm({ email: "", password: "" });

			// 加载用户设备信息
			await loadDevices();
		} catch (error: any) {
			message.error(error.message || "登录失败");
		} finally {
			setIsLoading(false);
		}
	};

	const handleRegister = async () => {
		if (!registerForm.email || !registerForm.password) {
			message.error("请填写邮箱和密码");
			return;
		}

		if (registerForm.password !== registerForm.confirmPassword) {
			message.error("密码确认不匹配");
			return;
		}

		setIsLoading(true);
		try {
			const response = await syncPlugin.register({
				email: registerForm.email,
				password: registerForm.password,
				confirmPassword: registerForm.confirmPassword,
			});

			if (response.success !== false) {
				// 注册成功的判断
				message.success("注册成功，请登录");
				setRegisterForm({
					email: "",
					password: "",
					confirmPassword: "",
				});
			} else {
				message.error(response.message || "注册失败");
			}
		} catch (error: any) {
			message.error(error.message || "注册失败");
		} finally {
			setIsLoading(false);
		}
	};

	const handleLogout = async () => {
		try {
			await syncPlugin.logout();
			syncStore.account.isLoggedIn = false;
			syncStore.account.email = "";
			syncStore.account.userId = "";
			syncStore.account.devices = [];

			message.success("已退出登录");
		} catch (error: any) {
			message.error(error.message || "退出登录失败");
		}
	};

	const handleToggleSync = async (enabled: boolean) => {
		try {
			setIsLoading(true);

			// 首先更新配置
			const newConfig = { ...syncStore.sync, enabled };
			const configForPlugin = {
				...newConfig,
				syncTypes: {
					text: newConfig.syncTypes.includes("text"),
					image: newConfig.syncTypes.includes("image"),
					file: newConfig.syncTypes.includes("file"),
				},
			};

			await syncPlugin.updateSyncConfig(configForPlugin);
			syncStore.sync = newConfig;

			// 尝试启动/停止同步服务（如果失败也不影响配置更新）
			try {
				if (enabled) {
					await syncPlugin.startSyncService();
					message.success("同步已启用");
				} else {
					await syncPlugin.stopSyncService();
					message.success("同步已禁用");
				}
			} catch (serviceError: any) {
				console.warn("同步服务操作失败:", serviceError);
				// 不显示错误，因为配置已经更新成功
				message.success(enabled ? "同步配置已启用" : "同步配置已禁用");
			}
		} catch (error: any) {
			console.error("更新同步配置失败:", error);
			message.error(`配置更新失败: ${error.message || "未知错误"}`);
		} finally {
			setIsLoading(false);
		}
	};

	const handleConfigChange = async (key: string, value: any) => {
		try {
			// 更新到 store 中的时候保持原始格式
			const newConfig = { ...syncStore.sync, [key]: value };

			// 只在调用插件时才转换 syncTypes 格式
			const configForPlugin = {
				...newConfig,
				syncTypes: Array.isArray(newConfig.syncTypes)
					? {
							text: newConfig.syncTypes.includes("text"),
							image: newConfig.syncTypes.includes("image"),
							file: newConfig.syncTypes.includes("file"),
						}
					: newConfig.syncTypes,
			};

			await syncPlugin.updateSyncConfig(configForPlugin);
			syncStore.sync = newConfig;
		} catch (error: any) {
			message.error(error.message || "配置更新失败");
		}
	};

	const handleForceSync = async () => {
		setIsLoading(true);
		try {
			await syncPlugin.forceSyncAll();
			message.success("强制同步已启动");
		} catch (error: any) {
			message.error(error.message || "强制同步失败");
		} finally {
			setIsLoading(false);
		}
	};

	const handleRemoveDevice = async (deviceId: string) => {
		try {
			await syncPlugin.removeDevice(deviceId);
			await loadDevices();
			message.success("设备已移除");
		} catch (error: any) {
			message.error(error.message || "移除设备失败");
		}
	};

	const handleResolveConflict = async (
		conflictId: string,
		resolution: string,
	) => {
		try {
			const conflictResolution = {
				strategy: resolution as any,
				selectedItem: undefined,
				mergedContent: undefined,
				note: undefined,
			};
			await syncPlugin.resolveConflict(conflictId, conflictResolution);
			await loadConflicts();
			setConflictDialogOpen(false);
			message.success("冲突已解决");
		} catch (error: any) {
			message.error(error.message || "解决冲突失败");
		}
	};

	const getDeviceIcon = (type: string) => {
		switch (type) {
			case "mobile":
				return <MobileOutlined style={{ fontSize: "16px" }} />;
			case "desktop":
				return <DesktopOutlined style={{ fontSize: "16px" }} />;
			default:
				return <DesktopOutlined style={{ fontSize: "16px" }} />;
		}
	};

	const getStatusIcon = (status: string) => {
		switch (status) {
			case "online":
				return <WifiOutlined style={{ fontSize: "16px", color: "#52c41a" }} />;
			case "offline":
				return (
					<DisconnectOutlined style={{ fontSize: "16px", color: "#d9d9d9" }} />
				);
			default:
				return (
					<DisconnectOutlined style={{ fontSize: "16px", color: "#d9d9d9" }} />
				);
		}
	};

	if (!syncStoreSnapshot.account.isLoggedIn) {
		return (
			<Space direction="vertical" size="large" style={{ width: "100%" }}>
				<div style={{ textAlign: "center" }}>
					<CloudOutlined
						style={{ fontSize: "48px", color: "#1890ff", marginBottom: "16px" }}
					/>
					<Title level={2} style={{ marginBottom: "8px" }}>
						云端同步
					</Title>
					<Text type="secondary">登录账户以启用多设备剪贴板同步</Text>
				</div>

				<Tabs defaultActiveKey="login" centered>
					<TabPane tab="登录" key="login">
						<Form layout="vertical">
							<Form.Item label="邮箱">
								<Input
									type="email"
									placeholder="请输入邮箱"
									value={loginForm.email}
									onChange={(e) =>
										setLoginForm({ ...loginForm, email: e.target.value })
									}
								/>
							</Form.Item>
							<Form.Item label="密码">
								<Input.Password
									placeholder="请输入密码"
									value={loginForm.password}
									onChange={(e) =>
										setLoginForm({ ...loginForm, password: e.target.value })
									}
									iconRender={(visible) =>
										visible ? <EyeOutlined /> : <EyeInvisibleOutlined />
									}
								/>
							</Form.Item>
							<Form.Item>
								<Button
									type="primary"
									onClick={handleLogin}
									loading={isLoading}
									block
								>
									登录
								</Button>
							</Form.Item>
						</Form>
					</TabPane>
					<TabPane tab="注册" key="register">
						<Form layout="vertical">
							<Form.Item label="邮箱">
								<Input
									type="email"
									placeholder="请输入邮箱"
									value={registerForm.email}
									onChange={(e) =>
										setRegisterForm({ ...registerForm, email: e.target.value })
									}
								/>
							</Form.Item>
							<Form.Item label="密码">
								<Input.Password
									placeholder="请输入密码"
									value={registerForm.password}
									onChange={(e) =>
										setRegisterForm({
											...registerForm,
											password: e.target.value,
										})
									}
								/>
							</Form.Item>
							<Form.Item label="确认密码">
								<Input.Password
									placeholder="请再次输入密码"
									value={registerForm.confirmPassword}
									onChange={(e) =>
										setRegisterForm({
											...registerForm,
											confirmPassword: e.target.value,
										})
									}
								/>
							</Form.Item>
							<Text
								type="secondary"
								style={{
									fontSize: "12px",
									display: "block",
									marginBottom: "16px",
								}}
							>
								📱 设备名称将自动获取，无需手动输入
							</Text>
							<Form.Item>
								<Button
									type="primary"
									onClick={handleRegister}
									loading={isLoading}
									block
								>
									注册
								</Button>
							</Form.Item>
						</Form>
					</TabPane>
				</Tabs>
			</Space>
		);
	}

	return (
		<div className="space-y-6">
			{/* 服务端配置 */}
			<Card
				title={
					<Space>
						<SaveOutlined />
						服务端配置
					</Space>
				}
			>
				<div
					style={{
						display: "flex",
						justifyContent: "space-between",
						alignItems: "center",
					}}
				>
					<div>
						<Text strong>服务器地址</Text>
						<br />
						<Text type="secondary">{serverConfig.baseUrl || "未配置"}</Text>
					</div>
					<Button
						icon={<SettingOutlined />}
						onClick={() => setServerConfigOpen(true)}
					>
						配置
					</Button>
				</div>

				<Divider />
				<div
					style={{
						display: "flex",
						justifyContent: "space-between",
						alignItems: "center",
					}}
				>
					<div>
						<Text strong>连接状态</Text>
						<br />
						<Text type={networkStatus?.serverReachable ? "success" : "danger"}>
							{networkStatus?.serverReachable ? "已连接" : "未连接"}
							{networkStatus?.latency && ` (${networkStatus.latency}ms)`}
						</Text>
					</div>
					<Button
						icon={<GlobalOutlined />}
						size="small"
						onClick={checkNetworkStatus}
						loading={isLoading}
					>
						测试连接
					</Button>
				</div>

				<Divider />
				<div
					style={{
						display: "flex",
						justifyContent: "space-between",
						alignItems: "center",
					}}
				>
					<div>
						<Text strong>WebSocket</Text>
						<br />
						<Text type={wsStatus.connected ? "success" : "warning"}>
							{wsStatus.connected ? "已连接" : "未连接"}
						</Text>
					</div>
					{!wsStatus.connected && syncStoreSnapshot.account.isLoggedIn && (
						<Button size="small" onClick={handleReconnect}>
							<ReloadOutlined />
							重连
						</Button>
					)}
				</div>

				{networkStatus?.error && (
					<Alert
						type="error"
						message="连接错误"
						description={networkStatus.error}
						showIcon
					/>
				)}
			</Card>

			{/* 账户信息 */}
			<Card
				title={
					<Space>
						<CloudOutlined />
						账户信息
					</Space>
				}
			>
				<div
					style={{
						display: "flex",
						justifyContent: "space-between",
						alignItems: "center",
					}}
				>
					<div>
						<Text strong>{syncStoreSnapshot.account.email}</Text>
						<br />
						<Text type="secondary">
							状态:{" "}
							<Badge>
								{syncStoreSnapshot.account.isLoggedIn ? "已登录" : "未登录"}
							</Badge>
						</Text>
					</div>
					<Button onClick={handleLogout}>退出登录</Button>
				</div>
			</Card>

			{/* 同步设置 */}
			<Card
				title={
					<Space>
						<SettingOutlined />
						同步设置
					</Space>
				}
			>
				<Space direction="vertical" size="large" style={{ width: "100%" }}>
					<div
						style={{
							display: "flex",
							justifyContent: "space-between",
							alignItems: "center",
						}}
					>
						<div>
							<Text strong>启用同步</Text>
							<br />
							<Text type="secondary">在多个设备间同步剪贴板数据</Text>
						</div>
						<Switch
							checked={syncStoreSnapshot.sync.enabled}
							onChange={handleToggleSync}
						/>
					</div>

					{syncStoreSnapshot.sync.enabled && (
						<>
							<Divider />

							<div
								style={{
									display: "flex",
									justifyContent: "space-between",
									alignItems: "center",
								}}
							>
								<div>
									<Text strong>自动同步</Text>
									<br />
									<Text type="secondary">自动同步新的剪贴板内容</Text>
								</div>
								<Switch
									checked={syncStoreSnapshot.sync.autoSync}
									onChange={(checked) =>
										handleConfigChange("autoSync", checked)
									}
								/>
							</div>

							<div>
								<Text strong>同步数据类型</Text>
								<Space direction="vertical" style={{ marginTop: 8 }}>
									{["text", "image", "file"].map((type) => (
										<div
											key={type}
											style={{ display: "flex", alignItems: "center", gap: 8 }}
										>
											<Switch
												checked={syncStoreSnapshot.sync.syncTypes.includes(
													type,
												)}
												onChange={(checked) => {
													const newTypes = checked
														? [...syncStoreSnapshot.sync.syncTypes, type]
														: syncStoreSnapshot.sync.syncTypes.filter(
																(t) => t !== type,
															);
													handleConfigChange("syncTypes", newTypes);
												}}
											/>
											<Text>
												{type === "text"
													? "文本"
													: type === "image"
														? "图片"
														: "文件"}
											</Text>
										</div>
									))}
								</Space>
							</div>

							<div>
								<Text strong>冲突解决策略</Text>
								<br />
								<Select
									style={{ width: "100%", marginTop: 8 }}
									defaultValue="manual"
									onChange={(value) =>
										handleConfigChange("conflictResolution", value)
									}
								>
									<Option value="manual">手动解决</Option>
									<Option value="latest">使用最新</Option>
									<Option value="local">使用本地</Option>
									<Option value="remote">使用远程</Option>
								</Select>
							</div>

							<div>
								<Button
									icon={<ReloadOutlined />}
									onClick={handleForceSync}
									loading={isLoading}
								>
									强制同步
								</Button>
							</div>
						</>
					)}
				</Space>
			</Card>

			{/* 设备管理 */}
			<Card title="设备管理">
				<div style={{ maxHeight: 200, overflowY: "auto" }}>
					<Space direction="vertical" style={{ width: "100%" }}>
						{syncStoreSnapshot.account.devices.map((device: any) => (
							<Card key={device.deviceId} size="small">
								<div
									style={{
										display: "flex",
										justifyContent: "space-between",
										alignItems: "center",
									}}
								>
									<div
										style={{ display: "flex", alignItems: "center", gap: 12 }}
									>
										{getDeviceIcon(device.deviceType)}
										<div>
											<Text strong>{device.deviceName}</Text>
											<br />
											<Text type="secondary" style={{ fontSize: 12 }}>
												最后活跃: {new Date(device.lastSeen).toLocaleString()}
											</Text>
										</div>
									</div>
									<div
										style={{ display: "flex", alignItems: "center", gap: 8 }}
									>
										{getStatusIcon(device.status)}
										{device.isCurrent ? (
											<Badge>当前设备</Badge>
										) : (
											<Button
												type="text"
												size="small"
												icon={<DeleteOutlined />}
												onClick={() => handleRemoveDevice(device.deviceId)}
											/>
										)}
									</div>
								</div>
							</Card>
						))}
					</Space>
				</div>
			</Card>

			{/* 冲突管理 */}
			{syncStoreSnapshot.conflicts.length > 0 && (
				<Card
					title={
						<Space>
							<ExclamationCircleOutlined style={{ color: "#faad14" }} />
							同步冲突 ({syncStoreSnapshot.conflicts.length})
						</Space>
					}
				>
					<Space direction="vertical" style={{ width: "100%" }}>
						{syncStoreSnapshot.conflicts.map((conflict) => (
							<Card key={conflict.id} size="small">
								<div
									style={{
										display: "flex",
										justifyContent: "space-between",
										alignItems: "center",
									}}
								>
									<div>
										<Text strong>数据冲突</Text>
										<br />
										<Text type="secondary" style={{ fontSize: 12 }}>
											{new Date(
												conflict.timestamp || Date.now(),
											).toLocaleString()}
										</Text>
									</div>
									<Button
										size="small"
										onClick={() => {
											setSelectedConflict(conflict);
											setConflictDialogOpen(true);
										}}
									>
										解决
									</Button>
								</div>
							</Card>
						))}
					</Space>
				</Card>
			)}

			{/* 冲突解决对话框 */}
			<Modal
				title="解决同步冲突"
				open={conflictDialogOpen}
				onCancel={() => setConflictDialogOpen(false)}
				footer={null}
			>
				<Text type="secondary">选择要保留的数据版本</Text>
				{selectedConflict && (
					<div style={{ marginTop: 16 }}>
						<div
							style={{
								display: "grid",
								gridTemplateColumns: "1fr 1fr",
								gap: 16,
							}}
						>
							<Card title="本地版本" size="small">
								<Text>{selectedConflict.localItem.value}</Text>
								<br />
								<Text type="secondary" style={{ fontSize: 12 }}>
									{new Date(
										selectedConflict.localItem.timestamp,
									).toLocaleString()}
								</Text>
							</Card>
							<Card title="远程版本" size="small">
								<Text>{selectedConflict.remoteItem.value}</Text>
								<br />
								<Text type="secondary" style={{ fontSize: 12 }}>
									{new Date(
										selectedConflict.remoteItem.timestamp,
									).toLocaleString()}
								</Text>
							</Card>
						</div>
						<div style={{ marginTop: 16, textAlign: "right" }}>
							<Space>
								<Button onClick={() => setConflictDialogOpen(false)}>
									取消
								</Button>
								<Button
									onClick={() =>
										handleResolveConflict(selectedConflict?.conflictId, "local")
									}
								>
									使用本地
								</Button>
								<Button
									type="primary"
									onClick={() =>
										handleResolveConflict(
											selectedConflict?.conflictId,
											"remote",
										)
									}
								>
									使用远程
								</Button>
							</Space>
						</div>
					</div>
				)}
			</Modal>

			{/* 服务端配置对话框 */}
			<Modal
				title="服务端配置"
				open={serverConfigOpen}
				onCancel={() => setServerConfigOpen(false)}
				footer={null}
				width={600}
			>
				<Text type="secondary">配置同步服务器连接信息</Text>
				<Form layout="vertical" style={{ marginTop: 16 }}>
					<Form.Item label="服务器地址">
						<Input
							placeholder="http://localhost:3001"
							value={serverConfig.baseUrl}
							onChange={(e) =>
								setServerConfig((prev) => ({
									...prev,
									baseUrl: e.target.value,
								}))
							}
						/>
					</Form.Item>
					<Form.Item label="WebSocket地址">
						<Input
							placeholder="ws://localhost:3001/ws"
							value={serverConfig.wsUrl}
							onChange={(e) =>
								setServerConfig((prev) => ({ ...prev, wsUrl: e.target.value }))
							}
						/>
					</Form.Item>
					<Form.Item label="请求超时时间(ms)">
						<Input
							type="number"
							placeholder="10000"
							value={serverConfig.timeout}
							onChange={(e) =>
								setServerConfig((prev) => ({
									...prev,
									timeout: Number.parseInt(e.target.value) || 10000,
								}))
							}
						/>
					</Form.Item>
					<Form.Item style={{ textAlign: "right", marginBottom: 0 }}>
						<Space>
							<Button onClick={() => setServerConfigOpen(false)}>取消</Button>
							<Button
								type="primary"
								onClick={handleServerConfigSave}
								loading={isLoading}
							>
								保存
							</Button>
						</Space>
					</Form.Item>
				</Form>
			</Modal>
		</div>
	);
}
