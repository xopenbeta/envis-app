import { setAppTheme } from '@/utils/theme';
import { useEffect } from 'react';
import { useAtom } from "jotai";
import { appSettingsAtom, defaultAppSettings } from "@/store/appSettings";

export function useAppTheme() {
    const [appSettings] = useAtom(appSettingsAtom);

    // 初始化和主题变化时应用主题
    useEffect(() => {
        const theme = appSettings?.theme || defaultAppSettings.theme;
        setAppTheme(theme);
        console.log('应用主题:', theme);
    }, [appSettings?.theme]);

    // 监听窗口焦点和页面可见性变化，重新检查和应用主题
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (!document.hidden) {
                const theme = appSettings?.theme || defaultAppSettings.theme;
                // 页面变为可见时，重新应用主题
                setAppTheme(theme);
            }
        };

        const handleWindowFocus = () => {
            const theme = appSettings?.theme || defaultAppSettings.theme;
            // 窗口获得焦点时，重新应用主题
            setAppTheme(theme);
        };

        // 添加事件监听器
        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('focus', handleWindowFocus);

        // 清理函数
        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('focus', handleWindowFocus);
        };
    }, [appSettings?.theme]); // 依赖于主题设置
}
