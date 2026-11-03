import en from './lang/en.json'
import zh from './lang/zh.json'
import { EVENTS, I18N, STORAGE_KEYS } from './constants'

const messages = { en, zh }

function getByPath(obj, path) {
  if (!obj) return undefined
  const parts = String(path || '').split('.')
  let current = obj
  for (const p of parts) {
    if (current && Object.prototype.hasOwnProperty.call(current, p)) {
      current = current[p]
    } else {
      return undefined
    }
  }
  return current
}

export function getLang() {
  const stored = uni.getStorageSync(STORAGE_KEYS.lang)
  if (I18N.supportedLangs.includes(stored)) return stored
  return I18N.defaultLang
}

export function setLang(lang) {
  const next = I18N.supportedLangs.includes(lang) ? lang : I18N.defaultLang
  uni.setStorageSync(STORAGE_KEYS.lang, next)
  uni.$emit(EVENTS.langChanged, next)
  return next
}

export function t(key) {
  const lang = getLang()
  const langPack = messages[lang] || messages[I18N.defaultLang] || {}
  const value =
    Object.prototype.hasOwnProperty.call(langPack, key) ? langPack[key] : getByPath(langPack, key)
  return value === undefined ? String(key) : String(value)
}

export function onLangChange(handler) {
  if (typeof handler !== 'function') return () => {}
  uni.$on(EVENTS.langChanged, handler)
  return () => uni.$off(EVENTS.langChanged, handler)
}
