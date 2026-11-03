import { getApiBaseUrl } from './api'

function stableStringify(value) {
  const seen = new WeakSet()

  const stringify = (val) => {
    if (val === null || typeof val !== 'object') {
      const primitive = JSON.stringify(val)
      return primitive === undefined ? '"[Undefined]"' : primitive
    }
    if (seen.has(val)) return '"[Circular]"'
    seen.add(val)

    if (Array.isArray(val)) {
      return `[${val.map((v) => stringify(v)).join(',')}]`
    }

    const keys = Object.keys(val).sort()
    return `{${keys.map((k) => `${JSON.stringify(k)}:${stringify(val[k])}`).join(',')}}`
  }

  return stringify(value)
}

function buildUrl(url, params) {
  if (!params || typeof params !== 'object') return url
  const keys = Object.keys(params).filter((k) => params[k] !== undefined && params[k] !== null)
  if (keys.length === 0) return url
  const query = keys
    .sort()
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(String(params[k]))}`)
    .join('&')
  return url.includes('?') ? `${url}&${query}` : `${url}?${query}`
}

const inflight = new Map()
// 限制最大缓存数量，防止内存泄漏
const MAX_INFLIGHT_SIZE = 100

export function httpRequest(options) {
  // 移除敏感信息打印，仅调试方法名和URL
  const method = (options.method || 'GET').toUpperCase()
  const url = options.url || ''
  // console.log(`[httpRequest] ${method} ${url}${options.params ? `?${buildUrl(url, options.params)}` : ''}`)

  const buildedUrl = buildUrl(options.url, options.params)
  const data = options.data
  const headers = options.headers || {}
  console.log(`[headers] ${stableStringify(headers)}`)
  const timeout = options.timeout
  const dedup = options.dedup !== false

  const dedupKey = dedup
    ? `${method} ${buildedUrl} ${stableStringify(data)}`
    : null

  if (dedupKey && inflight.has(dedupKey)) {
    return inflight.get(dedupKey)
  }

  // 内存保护：超过限制时清理最早的条目
  if (inflight.size >= MAX_INFLIGHT_SIZE) {
    const firstKey = inflight.keys().next().value
    inflight.delete(firstKey)
  }

  const baseUrl = getApiBaseUrl()
  const fullUrl = baseUrl ? `${baseUrl}${buildedUrl}` : buildedUrl
  console.log(`[fullUrl] ${fullUrl}`)
  const promise = new Promise((resolve, reject) => {
    uni.request({
      url: fullUrl,
      method,
      data,
      header: headers,
      timeout,
      success: (res) => {
        // console.log(`[httpRequest] ${method} ${fullUrl} ${stableStringify(res.data || res)}`)
        resolve(res)
      },
      fail: (err) => {
        console.log(`[httpRequest] ${method} ${fullUrl} ${stableStringify(err)}`)
        reject(err)
      },
    })
  }).finally(() => {
    // 使用 setTimeout 确保在当前事件循环结束后再删除
    // 这样可以避免竞态条件，让等待中的请求有机会复用结果
    setTimeout(() => {
      if (dedupKey) inflight.delete(dedupKey)
    }, 0)
  })

  if (dedupKey) inflight.set(dedupKey, promise)
  return promise
}

