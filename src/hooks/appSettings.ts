import { useAtom } from "jotai";
import { defaultAppSettings, appSettingsAtom, systemSettingsAtom } from "../store/appSettings";
import { AppSettings, SystemSettings } from "@/types/index";
import { setAppTheme } from "../utils/theme";
import { ipcGetSystemSettings, ipcUpdateSystemSettings, ipcOpenAppConfigFolder } from "../ipc/systemSettings";
import { toast } from "sonner";
import { useLogger } from "./log";
import i18n from '@/i18n/config'

// appConfig的数据不重要，用不着放在文件里
const APP_SETTINGS_STORAGE_KEY = 'envis-app-settings'

const normalizeLanguage = (language?: string) => {
  if (!language) return 'en'
  const value = language.toLowerCase()
  if (value.startsWith('zh')) return 'zh'
  if (value.startsWith('en')) return 'en'
  return 'en'
}

// 从localStorage读取应用设置数据
export const loadAppSettingsFromStorage = (): AppSettings => {
  try {
    const settingsStr = localStorage.getItem(APP_SETTINGS_STORAGE_KEY)
    return JSON.parse(settingsStr || '{}') as AppSettings;
  } catch (error) {
    console.error('Failed to load app settings from localStorage:', error)
    return defaultAppSettings
  }
}

// 保存应用设置数据到localStorage
export const saveAppSettingsToStorage = (settings: AppSettings) => {
  localStorage.setItem(APP_SETTINGS_STORAGE_KEY, JSON.stringify(settings))
}

export function useAppSettings() {
  const [appSettings, setAppSettings] = useAtom(appSettingsAtom);
  const [systemSettings, setSystemSettings] = useAtom(systemSettingsAtom);
  const { logInfo, logError } = useLogger();

  function initAppSettings() {
    // 从localStorage读取应用设置
    let appSettings = loadAppSettingsFromStorage();
    setAppSettings(appSettings);
    setAppTheme(appSettings.theme);
    void i18n.changeLanguage(normalizeLanguage(appSettings.language));
    logInfo('【init】初始化应用设置完成');
    return appSettings;
  }

  function updateAppSettings(updates: Partial<AppSettings>) {
    setAppSettings((currentSettings) => {
      const updatedSettings = { ...(currentSettings ?? defaultAppSettings), ...updates };
      saveAppSettingsToStorage(updatedSettings);
      if (updates.theme) { // 如果theme有改动
        setAppTheme(updates.theme);
      }
      if (updates.language) {
        void i18n.changeLanguage(normalizeLanguage(updates.language));
      }
      return updatedSettings;
    });
  }

  function resetAppSettings() {
    setAppSettings(defaultAppSettings);
    saveAppSettingsToStorage(defaultAppSettings);
    setAppTheme(defaultAppSettings.theme);
  }

  async function initSystemSettings() {
    const ipcRes = await ipcGetSystemSettings();
    if (ipcRes.success && ipcRes.data?.appConfig) {
      const systemSettings: SystemSettings = ipcRes.data.appConfig;
      setSystemSettings(systemSettings);
      logInfo('【init】初始化系统设置完成');
      return systemSettings;
    } else {
      logError('【init】初始化系统设置失败');
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
