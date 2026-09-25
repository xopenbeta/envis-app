import i18n from '@/i18n/config';
import { useEffect } from 'react';
import { useSettings } from './appSettings';

const DEFAULT_LANGUAGE = 'en';

export const normalizeLanguage = (language?: string) => {
  if (!language) return DEFAULT_LANGUAGE;

  const value = language.toLowerCase();
  if (value.startsWith('zh')) return 'zh';
  if (value.startsWith('en')) return 'en';
  return DEFAULT_LANGUAGE;
};

export function useI18n() {
    const { appSettings } = useSettings();
  const changeLanguage = (language?: string) => {
    const normalizedLanguage = normalizeLanguage(language);
    void i18n.changeLanguage(normalizedLanguage);
    return normalizedLanguage;
  };

  useEffect(() => {
    if (!appSettings?.language) return;
    changeLanguage(appSettings.language);
  }, [appSettings?.language]);

  // 让 <html lang> 跟随实际语言：影响读屏发音与 CJK 字体回退。
  // 否则中文界面仍以 lang="en" 渲染，会被按英文规则断词和朗读。
  useEffect(() => {
    const syncLang = (lng: string) => {
      document.documentElement.lang = lng.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en';
    };
    syncLang(i18n.language || DEFAULT_LANGUAGE);
    i18n.on('languageChanged', syncLang);
    return () => {
      i18n.off('languageChanged', syncLang);
    };
  }, []);
}
