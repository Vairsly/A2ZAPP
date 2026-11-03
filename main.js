import App from './App'
import { t, getLang, setLang } from './common/i18n'

// #ifndef VUE3
import Vue from 'vue'
import './uni.promisify.adaptor'
Vue.config.productionTip = false
Vue.prototype.$t = t
Vue.prototype.$getLang = getLang
Vue.prototype.$setLang = setLang
App.mpType = 'app'
const app = new Vue({
  ...App
})
app.$mount()
// #endif

// #ifdef VUE3
import { createSSRApp } from 'vue'
export function createApp() {
  const app = createSSRApp(App)
  app.config.globalProperties.$t = t
  app.config.globalProperties.$getLang = getLang
  app.config.globalProperties.$setLang = setLang
  return {
    app
  }
}
// #endif
