<template>
  <view class="page">
    <view class="body">
      <view class="card">
        <view class="logo-wrap">
          <image class="logo-img" src="/static/logo.png" mode="heightFix" />
        </view>

        <view class="field">
          <text class="label">{{ tt('label.login.account') }}</text>
          <input class="input" v-model="email" :placeholder="tt('label.login.account')" @blur="trimEmail" />
        </view>

        <view class="field">
          <text class="label">{{ tt('label.login.passwd') }}</text>
          <input class="input" v-model="password" password :placeholder="tt('label.login.passwd')" />
        </view>

        <view class="field">
          <text class="label">{{ tt('label.login.captcha') }}</text>
          <view class="captcha-row">
            <input class="input captcha-input" v-model="captchaCode" :placeholder="tt('label.login.captcha')" />
            <view class="captcha-img-wrap" @click="getCaptcha">
              <image v-if="captchaImg" class="captcha-img" :src="captchaImg" mode="aspectFit" />
              <view v-else-if="captchaLoading" class="captcha-placeholder">{{ tt('message.login.captchaLoading') }}</view>
              <view v-else-if="captchaLoadError" class="captcha-placeholder captcha-error">{{ tt('message.login.captchaLoadFailed') }}</view>
              <view v-else class="captcha-placeholder">{{ tt('label.login.captcha.refresh') }}</view>
            </view>
          </view>
          <text class="captcha-tip" @click="getCaptcha">{{ tt('label.login.captcha.refresh') }}</text>
        </view>

        <button class="btn" type="primary" :loading="submitting" :disabled="submitting" @click="submit">
          {{ tt('label.login.login') }}
        </button>

        <view class="remember-row">
          <checkbox-group @change="onRememberChange">
            <label class="remember-label">
              <checkbox value="1" :checked="rememberPassword" />
              <text class="remember-text">{{ tt('label.login.rememberPassword') }}</text>
            </label>
          </checkbox-group>
        </view>
      </view>
    </view>

    <view class="lang-bottom" @click="toggleLang">
      <text class="lang-bottom-text">{{ langSwitchText }}</text>
    </view>
  </view>
</template>

<script>
import { API, normalizeCaptchaImageSrc } from '@/common/api'
import { requestGet } from '@/common/request'
import { login, getAccessToken, decodeJwtPayload } from '@/common/session'
import { STORAGE_KEYS, VALIDATION, PAGES } from '@/common/constants'
import { getLang, setLang, onLangChange } from '@/common/i18n'
import { safeSwitchTab } from '@/common/navigation'

export default {
  data() {
    return {
      email: '',
      password: '',
      rememberPassword: false,
      captchaCode: '',
      captchaImg: '',
      captchaId: '',
      captchaLoading: false,
      captchaLoadError: false,
      submitting: false,
      lang: getLang(),
      offLang: null,
    }
  },
  computed: {
    langSwitchText() {
      return this.lang === 'en' ? this.tt('label.pub.lang.zh') : this.tt('label.pub.lang.en')
    },
  },
  onLoad() {
    this.offLang = onLangChange((next) => {
      this.lang = next
      this.updateNavTitle()
    })
    this.updateNavTitle()
    this.getCaptcha()
    this.loadRemembered()
  },
  onShow() {
    this.lang = getLang()
    this.updateNavTitle()
  },
  onUnload() {
    if (this.offLang) this.offLang()
  },
  methods: {
    tt(key) {
      const _lang = this.lang
      return this.$t(key)
    },
    updateNavTitle() {
      uni.setNavigationBarTitle({ title: this.tt('label.login.login') })
    },
    trimEmail() {
      this.email = String(this.email || '').trim()
    },
    loadRemembered() {
      try {
        const flag = uni.getStorageSync(STORAGE_KEYS.rememberPassword)
        this.rememberPassword = Boolean(flag)
        if (this.rememberPassword) {
          const savedEmail = uni.getStorageSync(STORAGE_KEYS.rememberedEmail)
          const savedPassword = uni.getStorageSync(STORAGE_KEYS.rememberedPassword)
          if (savedEmail) this.email = String(savedEmail)
          if (savedPassword) this.password = String(savedPassword)
        }
      } catch {}
    },
    onRememberChange(e) {
      const values = (e && e.detail && e.detail.value) || []
      const next = Array.isArray(values) ? values.includes('1') : false
      this.rememberPassword = next
      try {
        uni.setStorageSync(STORAGE_KEYS.rememberPassword, next ? '1' : '')
        if (!next) {
          uni.removeStorageSync(STORAGE_KEYS.rememberedEmail)
          uni.removeStorageSync(STORAGE_KEYS.rememberedPassword)
        }
      } catch {}
    },
    async getCaptcha() {
      if (this.captchaLoading) return
      this.captchaLoading = true
      this.captchaLoadError = false
      this.captchaImg = ''
      try {
        const res = await requestGet(API.auth.getCaptcha, { _ts: Date.now() }, { dedup: false })
        const wrap = (res && res.data) || {}
        const data = (wrap && typeof wrap === 'object' && wrap.data) ? wrap.data : wrap
        const imgUrl = normalizeCaptchaImageSrc(data && (data.captcha_image_url || data.captcha_image))
        this.captchaImg = imgUrl || ''
        this.captchaId = (data && data.captcha_id) || ''
        if (!this.captchaImg || !this.captchaId) {
          this.captchaLoadError = true
        }
      } catch (err) {
        this.captchaLoadError = true
        const statusCode = err && err.response && err.response.statusCode
        const data = err && err.response && err.response.data
        console.error('getCaptcha failed', { statusCode, data, err })
        const msg = data && (data.message || data.error)
        uni.showToast({ title: msg || this.tt('message.pub.error.network'), icon: 'none' })
      } finally {
        this.captchaLoading = false
      }
    },
    toggleLang() {
      const next = this.lang === 'en' ? 'zh' : 'en'
      this.lang = setLang(next)
    },
    async submit() {
      if (this.submitting) return

      this.trimEmail()
      if (!this.captchaCode) {
        uni.showToast({ title: this.tt('message.missionDispatch.tips.checkLogCaptcha'), icon: 'none' })
        return
      }
      if (!VALIDATION.emailRegex.test(this.email)) {
        uni.showToast({ title: this.tt('message.missionDispatch.tips.checkLogEmail'), icon: 'none' })
        return
      }
      if (!this.password) {
        uni.showToast({ title: this.tt('users.msg.password.required'), icon: 'none' })
        return
      }

      this.submitting = true
      try {
        await login({
          email: this.email,
          password: this.password,
          captchaId: this.captchaId,
          captchaCode: this.captchaCode,
        })
        try {
          const payload = decodeJwtPayload(getAccessToken())
          const userId = payload && payload.sub
          if (userId) {
            const res = await requestGet(API.users.getById(userId), null, { dedup: true })
            if (res && res.data) {
              uni.setStorageSync(STORAGE_KEYS.userInfo, res.data)
            }
          }
        } catch {}
        try {
          if (this.rememberPassword) {
            uni.setStorageSync(STORAGE_KEYS.rememberedEmail, this.email)
            uni.setStorageSync(STORAGE_KEYS.rememberedPassword, this.password)
          } else {
            uni.removeStorageSync(STORAGE_KEYS.rememberedEmail)
            uni.removeStorageSync(STORAGE_KEYS.rememberedPassword)
          }
        } catch {}
        safeSwitchTab(PAGES.home).catch(() => {})
      } catch (err) {
        const msg =
          (err && err.response && err.response.data && (err.response.data.message || err.response.data.error)) ||
          (err && err.message)
        console.error('login failed', err)
        uni.showToast({ title: msg || this.tt('message.pub.error.other'), icon: 'none' })
        this.getCaptcha()
      } finally {
        this.submitting = false
      }
    },
  },
}
</script>

<style scoped>
.page {
  min-height: 100vh;
  background-color: #f7f7f7;
}

.body {
  padding: 24rpx;
}

.card {
  background-color: #fff;
  border-radius: 16rpx;
  padding: 28rpx;
}

.logo-wrap {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  margin-top: 100rpx;
  margin-bottom: 100rpx;
}

.logo-img {
  height: 160rpx;
}

.field {
  margin-bottom: 22rpx;
}

.remember-row {
  margin-top: 20rpx;
  margin-bottom: 22rpx;
  display: flex;
  align-items: center;
}

.remember-label {
  display: flex;
  align-items: center;
}

.remember-text {
  font-size: 26rpx;
  color: #2f80ff;
  margin-left: 10rpx;
}

.label {
  display: block;
  font-size: 26rpx;
  color: #666;
  margin-bottom: 10rpx;
}

.input {
  height: 88rpx;
  border-width: 1rpx;
  border-style: solid;
  border-color: #e6e6e6;
  border-radius: 12rpx;
  padding: 0 20rpx;
  background-color: #fff;
  font-size: 28rpx;
}

.captcha-row {
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.captcha-input {
  flex: 1;
}

.captcha-img-wrap {
  width: 200rpx;
  height: 88rpx;
  flex-shrink: 0;
}

.captcha-img {
  width: 200rpx;
  height: 88rpx;
  border-radius: 12rpx;
}

.captcha-placeholder {
  width: 200rpx;
  height: 88rpx;
  border-radius: 12rpx;
  background-color: #f2f2f2;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22rpx;
  color: #999;
  text-align: center;
  padding: 0 8rpx;
  box-sizing: border-box;
}

.captcha-error {
  color: #f56c6c;
}

.captcha-tip {
  margin-top: 10rpx;
  font-size: 24rpx;
  color: #2f80ff;
}

.btn {
  margin-top: 10rpx;
}

.lang-bottom {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 24rpx;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 12rpx 24rpx;
}

.lang-bottom-text {
  font-size: 28rpx;
  color: #2f80ff;
}
</style>
