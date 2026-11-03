const path = require('path')

module.exports = {
  productionSourceMap: false,
  configureWebpack: {
    devtool: false,
  },
  chainWebpack(config) {
    const vendor = /[\\/]common[\\/]vendor[\\/]jsencrypt/
    try {
      config.module.rule('js').exclude.add(vendor)
    } catch (e) {}
    try {
      config.module.rule('eslint').exclude.add(vendor)
    } catch (e) {}
  },
}
