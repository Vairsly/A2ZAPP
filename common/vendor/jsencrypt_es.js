import mod from './jsencrypt.js'

const g = typeof globalThis !== 'undefined' ? globalThis : null
const ctor = (mod && (mod.JSEncrypt || mod.default)) || mod

if (g) {
  if (ctor && !g.JSEncrypt) g.JSEncrypt = ctor
  g.__jsencrypt_loaded = Boolean(g.JSEncrypt)
}

