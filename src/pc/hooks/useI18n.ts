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

}
