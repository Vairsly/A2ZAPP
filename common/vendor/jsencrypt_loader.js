import './jsencrypt_fixed.js'

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

function pickCtor(v) {
  if (!v) return null
  if (typeof v === 'function') return v
  if (typeof v === 'object') {
    if (typeof v.JSEncrypt === 'function') return v.JSEncrypt
    if (typeof v.default === 'function') return v.default
  }
  return null
}

if (g && !g.JSEncrypt) {
  try {
    if (typeof require === 'function') {
      const mod = require('./jsencrypt_fixed.js')
      const ctor = pickCtor(mod) || pickCtor(mod && (mod.JSEncrypt || mod.default)) || mod
      if (typeof ctor === 'function' && !g.JSEncrypt) g.JSEncrypt = ctor
    }
  } catch {}
}

const JSEncryptCtor = pickCtor(g && g.JSEncrypt)

if (g) g.__jsencrypt_loaded = Boolean(JSEncryptCtor)

export { JSEncryptCtor }
export default JSEncryptCtor
