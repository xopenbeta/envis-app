import { setAppTheme } from '@/utils/theme';
import { useEffect } from 'react';
import { useAtom } from "jotai";
import { defaultAppSettings } from "@/store/appSettings";
import { useSettings } from './appSettings';

export function useAppTheme() {
    const { appSettings } = useSettings();

    // 初始化和主题变化时应用主题
    useEffect(() => {
        const theme = appSettings?.theme || defaultAppSettings.theme;
        setAppTheme(theme);
    }, [appSettings?.theme]);
}
