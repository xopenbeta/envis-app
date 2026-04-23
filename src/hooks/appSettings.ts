import { atom, useAtom } from "jotai";
import { defaultAppSettings } from "../store/appSettings";
import { AppSettings, SystemSettings } from "@/types/index";
import { ipcGetSystemSettings, ipcUpdateSystemSettings, ipcOpenAppConfigFolder } from "../ipc/systemSettings";
import { toast } from "sonner";
import { useLogger } from "./log";

const appSettingsAtom = atom<AppSettings | undefined>(undefined)
const systemSettingsAtom = atom<SystemSettings | undefined>(undefined)

// appSettings 的数据不重要，用不着放在文件里
const APP_SETTINGS_STORAGE_KEY = 'envis-app-settings'

// 从 localStorage 读取应用设置数据
export const loadAppSettingsFromStorage = (): AppSettings => {
  try {
    const settingsStr = localStorage.getItem(APP_SETTINGS_STORAGE_KEY)
    return JSON.parse(settingsStr || '{}') as AppSettings;
  } catch (error) {
    console.error('Failed to load app settings from localStorage:', error)
    return defaultAppSettings
  }
}

// 保存应用设置数据到 localStorage
export const saveAppSettingsToStorage = (settings: AppSettings) => {
  localStorage.setItem(APP_SETTINGS_STORAGE_KEY, JSON.stringify(settings))
}

export function useSettings() {
  const [appSettings, setAppSettings] = useAtom(appSettingsAtom);
  const [systemSettings, setSystemSettings] = useAtom(systemSettingsAtom);
  const { logInfo, logError } = useLogger();

  function initAppSettings() {
    // 从localStorage读取应用设置
    let appSettings = loadAppSettingsFromStorage();
    setAppSettings(appSettings);
    logInfo('【init】初始化 appSettings 完成');
    return appSettings;
  }

  function updateAppSettings(updates: Partial<AppSettings>) {
    setAppSettings((currentSettings) => {
      const updatedSettings = { ...(currentSettings ?? defaultAppSettings), ...updates };
      saveAppSettingsToStorage(updatedSettings);
      return updatedSettings;
    });
  }

  function resetAppSettings() {
    setAppSettings(defaultAppSettings);
    saveAppSettingsToStorage(defaultAppSettings);
  }

  async function initSystemSettings() {
    const ipcRes = await ipcGetSystemSettings();
    if (ipcRes.success && ipcRes.data?.appConfig) {
      const systemSettings: SystemSettings = ipcRes.data.appConfig;
      setSystemSettings(systemSettings);
      logInfo('【init】初始化 systemSettings 完成');
      return systemSettings;
    } else {
      logError('【init】初始化 systemSettings 失败');
      return null;
    }
  }

  async function updateSystemSettings(updates: Partial<SystemSettings>) {
    if (!systemSettings) {
      toast.error('系统设置未初始化，无法更新');
      return;
    }

    const updatedSettings = { ...systemSettings, ...updates };
    console.log('更新系统设置:', updatedSettings);
    const result = await ipcUpdateSystemSettings(updatedSettings);
    if (result.success) {
      setSystemSettings(updatedSettings);
    }
  }

  async function openAppConfigFolder() {
    const result = await ipcOpenAppConfigFolder();
    if (!result.success) {
      toast.error('打开配置文件夹失败: ' + result.message);
    }
  }

  return {
    appSettings,
    systemSettings,
    initSystemSettings,
    initAppSettings,
    updateAppSettings,
    updateSystemSettings,
    openAppConfigFolder,
    resetAppSettings
  };
}
