import ProSelect from "@/components/ProSelect";
import type { Theme } from "@/types/store";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { useSnapshot } from "valtio";
import { useMount } from "ahooks";
import { useTranslation } from "react-i18next";
import { useImmediateKey } from "@/hooks/useImmediateKey";
import { globalStore } from "@/stores/global";

interface Option {
	label: string;
	value: Theme;
}

// 安全获取当前窗口
let appWindow: any = null;

try {
	if (typeof window !== 'undefined' && (window as any).__TAURI__) {
		appWindow = getCurrentWebviewWindow();
	}
} catch (error) {
	console.warn('获取 Tauri 窗口失败:', error);
}

const ThemeMode = () => {
	const { appearance } = useSnapshot(globalStore);
	const { t } = useTranslation();

	useMount(() => {
		// 监听系统主题的变化
		if (appWindow) {
			appWindow.onThemeChanged(async ({ payload }: { payload: string }) => {
				if (globalStore.appearance.theme !== "auto") return;

				globalStore.appearance.isDark = payload === "dark";
			});
		}
	});

	useImmediateKey(globalStore.appearance, "theme", async (value) => {
		if (!appWindow) return;
		
		let nextTheme = value === "auto" ? null : value;

		await appWindow.setTheme(nextTheme);

		nextTheme = nextTheme ?? (await appWindow.theme());

		globalStore.appearance.isDark = nextTheme === "dark";
	});

	const options: Option[] = [
		{
			label: t("preference.settings.appearance_settings.label.theme_auto"),
			value: "auto",
		},
		{
			label: t("preference.settings.appearance_settings.label.theme_light"),
			value: "light",
		},
		{
			label: t("preference.settings.appearance_settings.label.theme_dark"),
			value: "dark",
		},
	];

	return (
		<ProSelect
			title={t("preference.settings.appearance_settings.label.theme")}
			value={appearance.theme}
			options={options}
			onChange={(value) => {
				globalStore.appearance.theme = value;
			}}
		/>
	);
};

export default ThemeMode;
