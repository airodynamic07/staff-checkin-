import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './en.json'
import th from './th.json'
import type { Lang } from '../lib/types'

const STORAGE_KEY = 'lang'

export function storedLanguage(): Lang {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v === 'en' || v === 'th') return v
  } catch {
    // storage unavailable (private mode)
  }
  return 'th'
}

export function applyLanguage(lang: Lang) {
  try {
    localStorage.setItem(STORAGE_KEY, lang)
  } catch {
    // ignore
  }
  document.documentElement.lang = lang
  return i18n.changeLanguage(lang)
}

void i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, th: { translation: th } },
  lng: storedLanguage(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
})

export default i18n
