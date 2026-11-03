// export const DEFAULT_API_BASE_URL = 'http://192.168.231.1'
//开发服
export const DEFAULT_API_BASE_URL = 'https://test.a2zd.co'
//预发布
// export const DEFAULT_API_BASE_URL = "https://pre.a2zd.co"
//巴厘岛
// export const DEFAULT_API_BASE_URL = 'https://a2zgcs.id'
//美国体验服
// export const DEFAULT_API_BASE_URL = "https://a2zd.us"
//美国正式服
// export const DEFAULT_API_BASE_URL = "https://gcs.a2zd.us"
//哈萨克斯坦正式服
// export const DEFAULT_API_BASE_URL = "https://gcs.a2zd.kz"
//国内正式服
// export const DEFAULT_API_BASE_URL = "https://gcs.a2zd.co"

function isH5Runtime() {
  if (typeof window === 'undefined' || !window.location) return false
  try {
    const info = uni.getSystemInfoSync()
    if (info && info.uniPlatform === 'h5') return true
  } catch (e) {
    // ignore
  }
  return typeof document !== 'undefined'
}

/** H5 本地 dev server：走 Vite 代理，避免跨域与 HTTP 被强转 HTTPS */
function shouldUseH5DevProxy() {
  if (!isH5Runtime()) return false
  const { hostname, port } = window.location
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0') return true
  if (port === '5173' || port === '8080') return true
  return false
}

function isPrivateOrLocalHttpBase(base) {
  return /^http:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/i.test(String(base || ''))
}

export function normalizeCaptchaImageSrc(raw) {
  const s = String(raw || '').trim()
  if (!s) return ''
  if (s.startsWith('data:image')) return s
  if (/^https?:\/\//i.test(s) || s.startsWith('/')) return s
  return `data:image/png;base64,${s}`
}

export function getApiBaseUrl() {
  if (shouldUseH5DevProxy()) return ''

  const base = DEFAULT_API_BASE_URL
  let s = String(base || '').trim()
  s = s.replace(/\/+$/, '')
  if (s.endsWith('/dev-api')) s = s.slice(0, -8)
  if (s.startsWith('http://')) {
    const noPort = /^http:\/\/[^/:]+$/.test(s)
    if (noPort && !isPrivateOrLocalHttpBase(s)) {
      s = `https://${s.slice('http://'.length)}`
    }
  }
  return s
}

export const API = {
  auth: {
    // 获取验证码
    // Method: GET
    // Auth: No
    // Response: { captcha_image: 'data:image/png;base64,...', captcha_id: string }
    getCaptcha: '/dev-api/auth/getCaptcha',

    // 登录
    // Method: POST
    // Auth: No
    // Body: { email, password, captchaId, captchaCode }
    // Note: password 为 RSA(PKCS1_v1_5) 加密后的 base64 字符串（与后端解密逻辑对齐）
    // Response: { access_token, refresh_token }
    login: '/dev-api/auth/login',

    // 刷新 token
    // Method: POST
    // Auth: No
    // Body: { refresh_token }
    // Response: { access_token, refresh_token }
    refresh: '/dev-api/auth/refresh',

    // 退出登录
    // Method: POST
    // Auth: No
    // Body: { refresh_token }
    // Response: { message: 'success' }
    logout: '/dev-api/auth/logout',
  },

  users: {
    // 获取用户信息
    // Method: GET
    // Auth: Yes (Authorization: Bearer <access_token>)
    // Params: userId in path
    getById: (userId) => `/dev-api/users/${userId}`,
  },

  form: {
    // 上传图片（用于表单/检查记录等场景）
    // Method: POST (multipart/form-data)
    // Auth: Yes (Authorization: Bearer <access_token>)
    // Form field: files[] (支持多张)
    // Response: { uploaded_files: string[] } (服务端保存路径，如 /imgs/uploads/1/xxx.jpg)
    uploadImages: '/dev-api/form/upload',
  },

  preflight: {
    // 上传飞前检查图片
    // Method: POST (multipart/form-data)
    // Auth: Yes (Authorization: Bearer <access_token>)
    // Form field: files[] (支持多张)
    // Response: { uploaded_files: string[] } (服务端保存路径，如 /imgs/uploads/preflight/preflight_xxx.jpg)
    uploadImages: '/dev-api/preflight/upload',

    // 飞前检查历史列表
    // Method: GET
    // Auth: Yes (Authorization: Bearer <access_token>)
    // Params: { page, pageSize, drone_id?, passed?, date_from?, date_to? }
    // Response: { list: Array, page, pageSize, total }
    listChecks: '/dev-api/preflight/checks',

    // 提交飞前检查
    // Method: POST
    // Auth: Yes (Authorization: Bearer <access_token>)
    // Body: { scope, drone_id, summary_note, items: [{ item_key, ok, note, photo_urls: string[] }] }
    // Response: { id, create_time }
    createCheck: '/dev-api/preflight/checks',

    // 飞前检查详情
    // Method: GET
    // Auth: Yes (Authorization: Bearer <access_token>)
    // Params: id in path
    // Response: { ..., items: [{ item_key, ok, note, photo_urls }] }
    getCheckById: (id) => `/dev-api/preflight/checks/${id}`,

    // 删除（软删除）飞前检查记录
    // Method: DELETE
    // Auth: Yes (Authorization: Bearer <access_token>)
    // Params: id in path, query: reason?
    // Response: { msg: 'success' }
    deleteCheckById: (id) => `/dev-api/preflight/checks/${id}`,

    // 获取当前启用模板（当前阶段手机端写死模板时，可不使用）
    // Method: GET
    // Auth: Yes (Authorization: Bearer <access_token>)
    // Params: { scope }
    // Response: { id, scope, name, version, items: [...] }
    getActiveTemplate: '/dev-api/preflight/templates/active',
  },
}
