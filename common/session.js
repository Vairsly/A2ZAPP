import { API } from './api'
import { RSA, STORAGE_KEYS } from './constants'
import { httpRequest } from './http'
import JSEncryptCtorFromLoader from './vendor/jsencrypt_loader'

let lastEncryptPasswordError = ''

function base64EncodeBytes(bytes) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  let out = ''
  let i = 0
  for (; i + 2 < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2]
    out += chars[(n >> 18) & 63]
    out += chars[(n >> 12) & 63]
    out += chars[(n >> 6) & 63]
    out += chars[n & 63]
  }
  const remain = bytes.length - i
  if (remain === 1) {
    const n = bytes[i] << 16
    out += chars[(n >> 18) & 63]
    out += chars[(n >> 12) & 63]
    out += '=='
  } else if (remain === 2) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8)
    out += chars[(n >> 18) & 63]
    out += chars[(n >> 12) & 63]
    out += chars[(n >> 6) & 63]
    out += '='
  }
  return out
}

function hexToBytes(hex) {
  const s = String(hex || '').replace(/^0x/i, '').trim()
  if (!s) return []
  const clean = s.length % 2 === 1 ? `0${s}` : s
  const bytes = new Array(clean.length / 2)
  for (let i = 0; i < clean.length; i += 2) {
    const v = parseInt(clean.slice(i, i + 2), 16)
    bytes[i / 2] = Number.isFinite(v) ? v & 0xff : 0
  }
  return bytes
}

function hexToBase64(hex) {
  return base64EncodeBytes(hexToBytes(hex))
}

function normalizePublicKeyPem(pemLike) {
  let s = String(pemLike || '').replace(/\r/g, '').trim()
  if (!s) return ''
  const match = s.match(
    /-----BEGIN (RSA )?PUBLIC KEY-----([\s\S]*?)-----END (RSA )?PUBLIC KEY-----/i
  )
  if (!match) {
    return s.replace(/^\s+/gm, '').replace(/\s+$/gm, '')
  }
  const header = match[1] ? 'RSA PUBLIC KEY' : 'PUBLIC KEY'
  const body = String(match[2] || '').replace(/[^A-Za-z0-9+/=]/g, '')
  const lines = body.match(/.{1,64}/g) || []
  const wrapped = lines.length ? lines.join('\n') : body
  return `-----BEGIN ${header}-----\n${wrapped}\n-----END ${header}-----`
}

function base64DecodeToBytes(input) {
  const str = String(input || '').replace(/[\r\n\s]/g, '')
  if (!str) return []
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  const lookup = new Map(chars.split('').map((c, idx) => [c, idx]))
  const bytes = []
  let buffer = 0
  let bits = 0
  for (const ch of str) {
    if (ch === '=') break
    const v = lookup.get(ch)
    if (v === undefined) continue
    buffer = (buffer << 6) | v
    bits += 6
    if (bits >= 8) {
      bits -= 8
      bytes.push((buffer >> bits) & 0xff)
    }
  }
  return bytes
}

function extractPemBodyBase64(pem) {
  const s = String(pem || '')
  const m = s.match(/-----BEGIN [^-]+-----([\s\S]*?)-----END [^-]+-----/i)
  if (!m) return ''
  return String(m[1] || '').replace(/[^A-Za-z0-9+/=]/g, '')
}

function readAsn1Length(bytes, offset) {
  const first = bytes[offset]
  if ((first & 0x80) === 0) return { length: first, read: 1 }
  const n = first & 0x7f
  let len = 0
  for (let i = 0; i < n; i++) {
    len = (len << 8) | (bytes[offset + 1 + i] & 0xff)
  }
  return { length: len, read: 1 + n }
}

function readAsn1TLV(bytes, offset) {
  const tag = bytes[offset] & 0xff
  const { length, read } = readAsn1Length(bytes, offset + 1)
  const headerLen = 1 + read
  const start = offset + headerLen
  const end = start + length
  return { tag, start, end, headerLen, length }
}

function bytesToHex(bytes) {
  return bytes.map((b) => (b & 0xff).toString(16).padStart(2, '0')).join('')
}

function decodeRsaPublicKeyFromDer(derBytes) {
  const b = derBytes
  if (!b || !b.length) throw new Error('Empty DER')
  const root = readAsn1TLV(b, 0)
  if (root.tag !== 0x30) throw new Error('Not a SEQUENCE')

  let cursor = root.start
  const first = readAsn1TLV(b, cursor)

  let rsaSeq = null
  if (first.tag === 0x30) {
    // SubjectPublicKeyInfo: SEQ { alg SEQ, bitstr BIT STRING }
    const alg = first
    cursor = alg.end
    const bitStr = readAsn1TLV(b, cursor)
    if (bitStr.tag !== 0x03) throw new Error('Not a BIT STRING')
    const unusedBits = b[bitStr.start]
    if (unusedBits !== 0x00) throw new Error('Unsupported BIT STRING padding')
    const innerDer = b.slice(bitStr.start + 1, bitStr.end)
    rsaSeq = readAsn1TLV(innerDer, 0)
    b.splice = null
    // continue with innerDer parsing below by switching context
    return decodeRsaPublicKeyFromDer(innerDer)
  }

  // RSAPublicKey: SEQ { INTEGER n, INTEGER e }
  rsaSeq = root
  cursor = rsaSeq.start
  const nTlv = readAsn1TLV(b, cursor)
  if (nTlv.tag !== 0x02) throw new Error('Missing modulus INTEGER')
  let nBytes = b.slice(nTlv.start, nTlv.end)
  if (nBytes[0] === 0x00) nBytes = nBytes.slice(1)
  cursor = nTlv.end
  const eTlv = readAsn1TLV(b, cursor)
  if (eTlv.tag !== 0x02) throw new Error('Missing exponent INTEGER')
  let eBytes = b.slice(eTlv.start, eTlv.end)
  if (eBytes[0] === 0x00) eBytes = eBytes.slice(1)
  return { nHex: bytesToHex(nBytes), eHex: bytesToHex(eBytes) }
}

function decodeRsaPublicKeyFromPem(pem) {
  const b64 = extractPemBodyBase64(pem)
  const der = base64DecodeToBytes(b64)
  return decodeRsaPublicKeyFromDer(der)
}

export function getAccessToken() {
  return uni.getStorageSync(STORAGE_KEYS.accessToken)
}

export function getRefreshToken() {
  return uni.getStorageSync(STORAGE_KEYS.refreshToken)
}

export function hasRefreshToken() {
  return Boolean(getRefreshToken())
}

export function setSession(tokens) {
  if (tokens && tokens.access_token) {
    uni.setStorageSync(STORAGE_KEYS.accessToken, tokens.access_token)
    uni.setStorageSync(STORAGE_KEYS.loginTime, Date.now())
  }
  if (tokens && tokens.refresh_token) {
    uni.setStorageSync(STORAGE_KEYS.refreshToken, tokens.refresh_token)
  }
}

export function clearSession() {
  uni.removeStorageSync(STORAGE_KEYS.accessToken)
  uni.removeStorageSync(STORAGE_KEYS.refreshToken)
  uni.removeStorageSync(STORAGE_KEYS.loginTime)
  uni.removeStorageSync(STORAGE_KEYS.userInfo)
}

function base64UrlDecode(input) {
  const str = String(input || '').replace(/-/g, '+').replace(/_/g, '/')
  const pad = str.length % 4 === 0 ? '' : '='.repeat(4 - (str.length % 4))
  const raw = str + pad
  const bytes = []
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  const lookup = new Map(chars.split('').map((c, idx) => [c, idx]))
  let buffer = 0
  let bits = 0
  for (const ch of raw) {
    if (ch === '=') break
    const v = lookup.get(ch)
    if (v === undefined) continue
    buffer = (buffer << 6) | v
    bits += 6
    if (bits >= 8) {
      bits -= 8
      bytes.push((buffer >> bits) & 0xff)
    }
  }
  try {
    return decodeURIComponent(
      bytes.map((b) => `%${b.toString(16).padStart(2, '0')}`).join('')
    )
  } catch {
    return String.fromCharCode(...bytes)
  }
}

export function decodeJwtPayload(token) {
  const parts = String(token || '').split('.')
  if (parts.length < 2) return null
  try {
    return JSON.parse(base64UrlDecode(parts[1]))
  } catch {
    return null
  }
}

export function isAccessTokenExpiring(bufferSec = 60) {
  const token = getAccessToken()
  if (!token) return true
  const payload = decodeJwtPayload(token)
  const exp = payload && Number(payload.exp)
  if (Number.isFinite(exp) && exp > 0) {
    return Date.now() / 1000 >= exp - Number(bufferSec || 0)
  }
  const loginTime = Number(uni.getStorageSync(STORAGE_KEYS.loginTime) || 0)
  if (loginTime > 0) {
    // 无法解析 JWT 时，按登录时间 23 小时视为将过期（测试环境 access 多为 1 天）
    return Date.now() - loginTime >= (23 * 60 * 60 - Number(bufferSec || 0)) * 1000
  }
  return false
}

export async function ensureFreshAccessToken() {
  if (!hasRefreshToken()) {
    return Promise.reject(new Error('No refresh token'))
  }
  if (!isAccessTokenExpiring()) return getAccessToken()
  return refreshTokens()
}

function resolveJSEncryptCtor() {
  if (typeof JSEncryptCtorFromLoader === 'function') return JSEncryptCtorFromLoader
  const g =
    typeof globalThis !== 'undefined'
      ? globalThis
      : typeof global !== 'undefined'
        ? global
        : typeof self !== 'undefined'
          ? self
          : typeof window !== 'undefined'
            ? window
            : Function('return this')()
  if (!g) return null

  const candidates = [
    g.JSEncrypt,
    g.JSEncrypt && g.JSEncrypt.JSEncrypt,
    g.JSEncrypt && g.JSEncrypt.default,
    g.exports && g.exports.JSEncrypt,
    g.exports && g.exports.default,
    g.module && g.module.exports && (g.module.exports.JSEncrypt || g.module.exports.default || g.module.exports),
  ].filter(Boolean)

  if (typeof JSEncryptCtorFromLoader === 'object' && JSEncryptCtorFromLoader) {
    candidates.push(JSEncryptCtorFromLoader, JSEncryptCtorFromLoader.default, JSEncryptCtorFromLoader.JSEncrypt)
  }

  const hasApis = (inst) =>
    Boolean(inst && typeof inst.setPublicKey === 'function' && typeof inst.encrypt === 'function')

  const isUsableCtor = (ctor) => {
    if (typeof ctor !== 'function') return false
    try {
      return hasApis(new ctor())
    } catch {
      return false
    }
  }

  for (const c of candidates) {
    if (isUsableCtor(c)) return c
    if (c && typeof c === 'object') {
      if (isUsableCtor(c.JSEncrypt)) return c.JSEncrypt
      if (isUsableCtor(c.default)) return c.default
    }
    if (typeof c === 'function') {
      try {
        const maybeCtor = c()
        if (isUsableCtor(maybeCtor)) return maybeCtor
        if (hasApis(maybeCtor)) {
          const factory = c
          return function JSEncryptFactoryShim() {
            return factory()
          }
        }
        if (maybeCtor && typeof maybeCtor === 'object') {
          if (isUsableCtor(maybeCtor.JSEncrypt)) return maybeCtor.JSEncrypt
          if (isUsableCtor(maybeCtor.default)) return maybeCtor.default
        }
      } catch {}
    }
  }

  return null
}

export function encryptPassword(plainPassword) {
  lastEncryptPasswordError = ''
  let Ctor = resolveJSEncryptCtor()
  if (typeof Ctor !== 'function') {
    lastEncryptPasswordError = 'JSEncrypt ctor not found'
    try {
      console.error('[auth] JSEncrypt ctor not found', {
        hasGlobalThis: typeof globalThis !== 'undefined',
        globalJSEncryptType: typeof (typeof globalThis !== 'undefined' ? globalThis.JSEncrypt : undefined),
      })
    } catch {}
    try {
      if (typeof require === 'function') {
        const mod = require('./vendor/jsencrypt_fixed.js')
        const maybe =
          (mod && (mod.JSEncrypt || mod.default)) || mod
        if (typeof maybe === 'function') Ctor = maybe
        else if (maybe && typeof maybe === 'object') {
          if (typeof maybe.JSEncrypt === 'function') Ctor = maybe.JSEncrypt
          else if (typeof maybe.default === 'function') Ctor = maybe.default
        }
      }
    } catch {}
    if (typeof Ctor !== 'function') return ''
    return ''
  }
  let encrypt = null
  try {
    encrypt = new Ctor()
  } catch {}
  if (!encrypt || typeof encrypt.setPublicKey !== 'function' || typeof encrypt.encrypt !== 'function') {
    try {
      encrypt = Ctor()
    } catch {}
  }
  if (!encrypt || typeof encrypt.setPublicKey !== 'function' || typeof encrypt.encrypt !== 'function') {
    lastEncryptPasswordError = 'JSEncrypt instance invalid'
    try {
      console.error('[auth] JSEncrypt instance invalid', { ctorType: typeof Ctor })
    } catch {}
    return ''
  }
  const pem = normalizePublicKeyPem(RSA.publicKeyPem || '')
  try {
    encrypt.setPublicKey(pem)
  } catch {
    lastEncryptPasswordError = 'setPublicKey failed'
    try {
      console.error('[auth] JSEncrypt setPublicKey failed')
    } catch {}
    return ''
  }
  try {
    const key =
      typeof encrypt.getKey === 'function'
        ? encrypt.getKey()
        : encrypt && encrypt.key
          ? encrypt.key
          : null
    if (!key || !key.n) {
      const { nHex, eHex } = decodeRsaPublicKeyFromPem(pem)
      if (!nHex || !eHex) {
        lastEncryptPasswordError = 'public key parse failed'
        return ''
      }
      if (typeof key.setPublic === 'function') {
        key.setPublic(nHex, eHex)
      } else {
        lastEncryptPasswordError = 'key.setPublic missing'
        return ''
      }
    }
  } catch (e) {
    lastEncryptPasswordError = e && e.message ? e.message : String(e)
    return ''
  }
  const encrypted = encrypt.encrypt(String(plainPassword || ''))
  if (!encrypted) {
    lastEncryptPasswordError = 'encrypt returned empty'
    try {
      console.error('[auth] JSEncrypt encrypt returned empty')
    } catch {}
  }
  return encrypted || ''
}

let refreshPromise = null

function unwrapBusinessBody(res) {
  const body = res && res.data
  if (!body || typeof body !== 'object') return body
  if (body.code === undefined || body.data === undefined) return body
  const code = Number(body.code)
  const msg = body.msg || body.message || body.error || 'Error'
  if (code === 200) return body.data
  throw { response: { ...res, statusCode: 400, data: { message: msg, code: body.code, raw: body } } }
}

export function refreshTokens() {
  if (refreshPromise) return refreshPromise
  const refreshToken = getRefreshToken()
  if (!refreshToken) return Promise.reject(new Error('No refresh token'))

  refreshPromise = httpRequest({
    url: API.auth.refresh,
    method: 'POST',
    data: { refresh_token: refreshToken },
    dedup: true,
  })
    .then((res) => {
      if (res.statusCode >= 400) throw { response: res }
      const data = unwrapBusinessBody(res)
      setSession(data)
      return data
    })
    .finally(() => {
      refreshPromise = null
    })

  return refreshPromise
}

export async function login({ email, password, captchaId, captchaCode }) {
  uni.removeStorageSync(STORAGE_KEYS.userInfo)
  const encrypted = encryptPassword(password)
  if (!encrypted) {
    const err = new Error(`Password encryption failed: ${lastEncryptPasswordError || 'unknown'}`)
    err.code = 'ENCRYPT_FAIL'
    throw err
  }

  const res = await httpRequest({
    url: API.auth.login,
    method: 'POST',
    data: { email, password: encrypted, captchaId, captchaCode },
    dedup: true,
  })
  if (res.statusCode >= 400) throw { response: res }
  const data = unwrapBusinessBody(res)
  setSession(data)
  return data
}

export async function logout() {
  const refreshToken = getRefreshToken()
  if (!refreshToken) {
    clearSession()
    return
  }
  const res = await httpRequest({
    url: API.auth.logout,
    method: 'POST',
    data: { refresh_token: refreshToken },
    dedup: true,
  })
  clearSession()
  if (res.statusCode >= 400) throw { response: res }
}
