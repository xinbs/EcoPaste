import { proxy } from "valtio";

export interface SyncAccount {
	isLoggedIn: boolean;
	userId: string;
	email: string;
	devices: SyncDevice[];
}

export interface SyncDevice {
	id: string;
	name: string;
	platform: string;
	isOnline: boolean;
	lastActive: string;
	isCurrent: boolean;
}

export interface SyncConfig {
	enabled: boolean;
	autoSync: boolean;
	syncTypes: string[];
	excludeDevices: string[];
	lastSyncTime: string | null;
	status: "idle" | "syncing" | "error" | "offline";
}

export interface SyncConflict {
	id: string;
	localItem: any;
	remoteItem: any;
	timestamp: string;
	resolved: boolean;
}

export interface BandwidthConfig {
	imageCompression: boolean;
	maxImageSize: number; // MB
	syncOnWifi: boolean;
	compressionQuality: number; // 0-100
}

export interface SyncStore {
	account: SyncAccount;
	sync: SyncConfig;
	conflicts: SyncConflict[];
	bandwidth: BandwidthConfig;
	stats: {
		totalSynced: number;
		lastSyncDuration: number;
		syncErrors: number;
		dataUsage: number; // bytes
	};
}

export const syncStore = proxy<SyncStore>({
	account: {
		isLoggedIn: false,
		userId: "",
		email: "",
		devices: [],
	},
	sync: {
		enabled: true,
		autoSync: true,
		syncTypes: ["text", "image", "file"],
		excludeDevices: [],
		lastSyncTime: null,
		status: "idle",
	},
	conflicts: [],
	bandwidth: {
		imageCompression: true,
		maxImageSize: 5,
		syncOnWifi: false,
		compressionQuality: 80,
	},
	stats: {
		totalSynced: 0,
		lastSyncDuration: 0,
		syncErrors: 0,
		dataUsage: 0,
	},
});

// 同步状态更新函数
export const updateSyncStatus = (status: SyncConfig["status"]) => {
	syncStore.sync.status = status;
};

// 添加设备
export const addDevice = (device: SyncDevice) => {
	const existingIndex = syncStore.account.devices.findIndex(
		(d) => d.id === device.id,
	);
	if (existingIndex >= 0) {
		syncStore.account.devices[existingIndex] = device;
	} else {
		syncStore.account.devices.push(device);
	}
};

// 移除设备
export const removeDevice = (deviceId: string) => {
	const index = syncStore.account.devices.findIndex((d) => d.id === deviceId);
	if (index >= 0) {
		syncStore.account.devices.splice(index, 1);
	}
};

// 添加冲突
export const addConflict = (conflict: SyncConflict) => {
	syncStore.conflicts.push(conflict);
};

// 解决冲突
export const resolveConflict = (conflictId: string) => {
	const conflict = syncStore.conflicts.find((c) => c.id === conflictId);
	if (conflict) {
		conflict.resolved = true;
	}
};

// 更新统计信息
export const updateStats = (stats: Partial<SyncStore["stats"]>) => {
	Object.assign(syncStore.stats, stats);
};
