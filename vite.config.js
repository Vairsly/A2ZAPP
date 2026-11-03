const API_TARGET = process.env.VITE_API_TARGET || "http://172.24.26.170:5001"
const PORT = Number(process.env.PORT || process.env.VITE_PORT || 5173)
const HOST = process.env.HOST || process.env.VITE_HOST || '127.0.0.1'
// Auto-strip /dev-api if targeting the backend directly on port 5001
const STRIP_DEV_API = process.env.VITE_PROXY_STRIP_DEV_API === '1' || API_TARGET.includes('5001')

function attachProxyEvents(proxy, name) {
  proxy.on('error', (err, _req, res) => {
    const msg = err && err.message ? err.message : String(err)
    if (res && !res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'text/plain' })
    }
    res && res.end && res.end(`Proxy error on ${name}.`)
    console.error(`Proxy error ${name}:`, msg)
  })
  proxy.on('proxyReqWs', (proxyReq, _req, socket) => {
    proxyReq.on('error', (err) => {
      const msg = err && err.message ? err.message : String(err)
      console.error(`Proxy WS upgrade error ${name}:`, msg)
      socket && socket.destroy && socket.destroy()
    })
  })
}

let uniPlugin = null
try {
  uniPlugin = require('@dcloudio/vite-plugin-uni')
} catch (e) {
  uniPlugin = null
}
const uni = uniPlugin ? uniPlugin.default || uniPlugin : null

function skipJsencryptSourcemap() {
  return {
    name: 'skip-jsencrypt-sourcemap',
    enforce: 'pre',
    transform(code, id) {
      const n = String(id || '').replace(/\\/g, '/')
      if (!n.includes('/common/vendor/jsencrypt')) return null
      return { code, map: { version: 3, sources: [], names: [], mappings: '' } }
    },
  }
}

module.exports = {
  plugins: [skipJsencryptSourcemap()].concat(uni ? [uni()] : []),
  build: {
    sourcemap: false,
  },
  server: {
    host: HOST,
    port: Number.isFinite(PORT) ? PORT : 5173,
    strictPort: false,
    sourcemapIgnoreList: (sourcePath) => {
      const p = String(sourcePath || '')
      if (p.includes('/common/vendor/') || p.includes('\\common\\vendor\\')) return true
      return false
    },
    proxy: {
      '/dev-api': {
        target: API_TARGET,
        changeOrigin: true,
        ws: true,
        secure: false,
        rewrite: STRIP_DEV_API ? (path) => path.replace(/^\/dev-api/, '') : undefined,
        configure: (proxy) => attachProxyEvents(proxy, '/dev-api'),
      },
      '/socket.io': {
        target: API_TARGET,
        changeOrigin: true,
        ws: true,
        secure: false,
        configure: (proxy) => attachProxyEvents(proxy, '/socket.io'),
      },
      '/sso': {
        target: API_TARGET,
        changeOrigin: true,
        secure: false,
        configure: (proxy) => attachProxyEvents(proxy, '/sso'),
      },
      '/imgs': {
        target: API_TARGET,
        changeOrigin: true,
        secure: false,
        configure: (proxy) => attachProxyEvents(proxy, '/imgs'),
      },
      '/video': {
        target: API_TARGET,
        changeOrigin: true,
        secure: false,
        configure: (proxy) => attachProxyEvents(proxy, '/video'),
      },
      '/flightops-api': {
        target: API_TARGET,
        changeOrigin: true,
        secure: false,
        configure: (proxy) => attachProxyEvents(proxy, '/flightops-api'),
      },
    },
  },
}
