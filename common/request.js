import { AUTH, HTTP_HEADERS, PAGES } from './constants'
import { getLang, t } from './i18n'
import { httpRequest } from './http'
import {
  refreshTokens,
  clearSession,
  getAccessToken,
  hasRefreshToken,
  ensureFreshAccessToken,
} from './session'
import { safeReLaunch } from './navigation'

function unwrapBusiness(res) {
  const body = res && res.data
  if (!body || typeof body !== 'object') return res
  if (body.code === undefined || body.data === undefined) return res
  const code = Number(body.code)
  const msg = body.msg || body.message || body.error || 'Error'
  if (code === 200 || code === 201 || code === 0) {
    res._business = { code: body.code, msg: body.msg }
    res.data = body.data
    return res
  }
  const httpLike = code === 401 || code === 403 ? code : 400
  throw { response: { ...res, statusCode: httpLike, data: { message: msg, code: body.code, raw: body } } }
}

function isBypassAuth(url) {
  return AUTH.bypassAuthPaths.some((p) => url.startsWith(p))
}

function buildHeaders(url, extraHeaders) {
  const headers = { ...(extraHeaders || {}) }
  if (!isBypassAuth(url)) {
    const token = getAccessToken()
    if (token) headers[HTTP_HEADERS.authorization] = `${AUTH.bearerPrefix}${token}`
    headers[HTTP_HEADERS.lang] = getLang()
  }
  return headers
}

function isUnauthorizedRes(res) {
  if (!res) return false
  if (Number(res.statusCode) === 401) return true
  const body = res.data
  if (body && typeof body === 'object' && body.code !== undefined) {
    return Number(body.code) === 401
  }
  return false
}

let handlingUnauthorized = false

function handleUnauthorized() {
  if (handlingUnauthorized) return
  handlingUnauthorized = true
  try {
    uni.showToast({ title: t('message.auth.sessionExpired'), icon: 'none' })
  } catch {}
  safeReLaunch(PAGES.login).catch(() => {})
  setTimeout(() => {
    handlingUnauthorized = false
  }, 1000)
}

export async function request(options) {
  const url = options.url
  const method = (options.method || 'GET').toUpperCase()
  const bypass = isBypassAuth(url)
  const skipRefresh = options.skipRefresh === true

  const send = () =>
    httpRequest({
      url,
      method,
      params: options.params,
      data: options.data,
      headers: buildHeaders(url, options.headers),
      timeout: options.timeout,
      dedup: options.dedup,
    })

  try {
    if (!bypass && !skipRefresh && hasRefreshToken()) {
      try {
        await ensureFreshAccessToken()
      } catch (e) {
        clearSession()
        if (options.onUnauthorized) {
          options.onUnauthorized()
          throw e
        }
        handleUnauthorized()
        throw e
      }
    }

    let res = await send()

    if (isUnauthorizedRes(res) && !bypass && !skipRefresh && hasRefreshToken()) {
      await refreshTokens()
      res = await send()
    }

    if (isUnauthorizedRes(res) && !bypass) {
      clearSession()
      if (options.onUnauthorized) {
        options.onUnauthorized()
        throw { response: res }
      }
      handleUnauthorized()
      throw { response: res }
    }

    if (Number(res.statusCode) >= 400) throw { response: res }
    return unwrapBusiness(res)
  } catch (err) {
    const resp = err && err.response
    if (resp && isUnauthorizedRes(resp) && !bypass) {
      if (!skipRefresh && hasRefreshToken()) {
        try {
          await refreshTokens()
          const retryRes = await send()
          if (isUnauthorizedRes(retryRes)) {
            clearSession()
            if (options.onUnauthorized) {
              options.onUnauthorized()
              throw { response: retryRes }
            }
            handleUnauthorized()
            throw { response: retryRes }
          }
          if (Number(retryRes.statusCode) >= 400) throw { response: retryRes }
          return unwrapBusiness(retryRes)
        } catch (e2) {
          if (e2 && e2.response && isUnauthorizedRes(e2.response)) {
            clearSession()
            if (options.onUnauthorized) {
              options.onUnauthorized()
              throw e2
            }
            handleUnauthorized()
            throw e2
          }
          throw e2
        }
      }
      clearSession()
      if (options.onUnauthorized) {
        options.onUnauthorized()
        throw err
      }
      handleUnauthorized()
      throw err
    }
    throw err
  }
}

export const requestGet = (url, params, options) =>
  request({ url, method: 'GET', params, ...(options || {}) })

export const requestPost = (url, data, options) =>
  request({ url, method: 'POST', data, ...(options || {}) })
