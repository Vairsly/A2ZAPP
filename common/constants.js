// 本地存储 Key：统一管理，避免多处硬编码导致拼写不一致/迁移困难
export const STORAGE_KEYS = {
  lang: 'lang',
  apiBaseUrl: 'apiBaseUrl',
  accessToken: 'access_token',
  refreshToken: 'refresh_token',
  loginTime: 'loginTime',
  userInfo: 'userInfo',
  preflightHistory: 'preflightHistory',
  preflightDrafts: 'preflightDrafts',
  rememberPassword: 'rememberPassword',
  rememberedEmail: 'rememberedEmail',
  rememberedPassword: 'rememberedPassword',
  preflightSelectedDroneId: 'preflightSelectedDroneId',
  preflightSelectedDroneAlias: 'preflightSelectedDroneAlias',
  preflightStartNew: 'preflightStartNew',
}

/** 飞前检查：每个检查项最多照片数 */
export const PREFLIGHT_MAX_PHOTOS_PER_ITEM = 10

/** 飞前检查：本地草稿定时保存间隔（毫秒） */
export const PREFLIGHT_DRAFT_AUTOSAVE_MS = 3 * 1000

// HTTP Header 名称：统一管理
export const HTTP_HEADERS = {
  authorization: 'Authorization',
  lang: 'lang',
}

// 鉴权相关常量：Bearer 前缀、免鉴权接口列表
export const AUTH = {
  bearerPrefix: 'Bearer ',
  bypassAuthPaths: [
    '/dev-api/auth/login',
    '/dev-api/auth/refresh',
    '/dev-api/auth/logout',
    '/dev-api/auth/getCaptcha',
  ],
}

// 国际化相关：当前项目仅支持 zh/en，与 A2ZDispatch 保持一致
export const I18N = {
  supportedLangs: ['zh', 'en'],
  defaultLang: 'en',
}

// 全局事件名：统一管理，避免不同模块使用不同字符串
export const EVENTS = {
  langChanged: 'lang:changed',
}

// uni.getLocale() / manifest locale 等输入的语言码不固定，这里统一映射为 zh/en
export function normalizeLocaleToLang(localeLike) {
  const value = String(localeLike || '').toLowerCase()
  if (value.startsWith('en')) return 'en'
  if (value.startsWith('zh')) return 'zh'
  return I18N.defaultLang
}

// 表单校验：与 A2ZDispatch 登录页邮箱校验逻辑对齐
export const VALIDATION = {
  emailRegex: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
}

// 页面路径：统一管理，避免页面间跳转散落字符串
export const PAGES = {
  login: '/pages/login/login',
  home: '/pages/index/index',
  check: '/pages/preflightHistory/preflightHistory',
  preflightCheck: '/pages/check/check',
  settings: '/pages/settings/settings',
  preflightHistory: '/pages/preflightHistory/preflightHistory',
  preflightHistoryDetail: '/pages/preflightHistoryDetail/preflightHistoryDetail',
  preflightSelectDrone: '/pages/preflightSelectDrone/preflightSelectDrone',
}

export const PREFLIGHT = {
  maxHistoryCount: 50,
  pageSize: 10,
}

// RSA 公钥：与 A2ZDispatch 前端保持一致，用于登录 password 加密（后端用私钥解密）
export const RSA = {
  publicKeyPem: `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAp+abqKDJdM4ez9t8/dBv
675oiBYNnlhNWLENVl9zVvi6vhGrWZFmn1Q5mw1lGJzMtcRYeUYmvcaZn/KltsnX
S9OkamzDhx8YiGbIT48chPbSjE+rwjHc30qOj4UpiD2hHbnSaLj3kxXOng8cm52U
GrLqEokST+b+yJoUOX+rNO+jOxepyjXDPLh1sLyJGRAH0GKWaAwyfoYp5sXiMGKF
ZEPGeQdbJOw8oCfTucksi+qkJJjn68gTk9ydZ4481FqFEhpFYEKtnynO9QYl9EC/
St78laHl6zVZrAQuMFXoPN6QkFYLDGLmr3mLoOGusxvwHfc+5a++zy3YtH3Cil87
UwIDAQAB
-----END PUBLIC KEY-----`,
}
