<template>
  <view class="page">
    <HeaderBar
      :unreadCount="unreadCount"
      @logo="goHome"
      @notice="toastBuilding"
      @settings="noop"
    />

    <view class="content">
      <view class="card">
        <view class="card-title">{{ tt('label.user.profile') }}</view>
        <view class="avatar-block" @click="previewAvatar">
          <image v-if="avatarUrl" class="avatar" :src="avatarUrl" mode="aspectFill" />
          <view v-else class="avatar placeholder" />
        </view>
        <view class="row">
          <text class="label">{{ tt('label.user.name') }}</text>
          <text class="value">{{ displayName }}</text>
        </view>
        <view class="row">
          <text class="label">{{ tt('label.user.email') }}</text>
          <text class="value">{{ displayEmail }}</text>
        </view>
        <view class="row">
          <text class="label">{{ tt('label.user.id') }}</text>
          <text class="value">{{ displayId }}</text>
        </view>
      </view>

      <view class="card">
        <view class="row">
          <text class="label">{{ tt('label.settings.version') }}</text>
          <text class="value">{{ appLabel }}</text>
        </view>
      </view>

      <button class="btn" type="warn" @click="confirmLogout">
        {{ tt('label.pub.btn.logout') }}
      </button>
    </view>
  </view>
</template>

<script>
import HeaderBar from '@/components/HeaderBar.vue'
import { getLang, onLangChange } from '@/common/i18n'
import { PAGES, STORAGE_KEYS } from '@/common/constants'
import { logout, getAccessToken, decodeJwtPayload } from '@/common/session'
import { API, APP_LABEL } from '@/common/api'
import { requestGet } from '@/common/request'
import { safeReLaunch, safeSwitchTab } from '@/common/navigation'

export default {
  components: { HeaderBar },
  data() {
    return {
      appLabel: APP_LABEL,
      lang: getLang(),
      unreadCount: 0,
      avatarUrl: '',
      userInfo: null,
      offLang: null,
    }
  },
  onLoad() {
    this.offLang = onLangChange((next) => {
      this.lang = next
    })
  },
  onShow() {
    if (!getAccessToken()) {
      safeReLaunch(PAGES.login).catch(() => {})
      return
    }
    this.lang = getLang()
    this.loadUserInfo()
  },
  onUnload() {
    if (this.offLang) this.offLang()
  },
  computed: {
    displayName() {
      const info = this.userInfo || {}
      return (
        info.name ||
        info.username ||
        info.nick_name ||
        info.nickname ||
        info.full_name ||
        info.fullName ||
        '-'
      )
    },
    displayEmail() {
      const info = this.userInfo || {}
      return info.email || info.mail || '-'
    },
    displayId() {
      const info = this.userInfo || {}
      return String(info.id || info.userId || info.user_id || '-')
    },
  },
  methods: {
    tt(key) {
      const _lang = this.lang
      return this.$t(key)
    },
    noop() {},
    goHome() {
      safeSwitchTab(PAGES.home).catch(() => {})
    },
    toastBuilding() {
      uni.showToast({ title: this.tt('message.pub.building'), icon: 'none' })
    },
    previewAvatar() {
      if (!this.avatarUrl) return
      uni.previewImage({ urls: [this.avatarUrl], current: this.avatarUrl })
    },
    async loadUserInfo() {
      const cached = uni.getStorageSync(STORAGE_KEYS.userInfo)
      if (cached) {
        this.userInfo = cached
        this.avatarUrl =
          cached.avatarUrl || cached.avatar_url || cached.avatar || cached.headImg || cached.head_img || ''
      }

      const payload = decodeJwtPayload(getAccessToken())
      const userId = payload && payload.sub
      if (!userId) return
      try {
        const res = await requestGet(API.users.getById(userId), null, { dedup: true })
        if (res && res.data) {
          this.userInfo = res.data
          this.avatarUrl =
            res.data.avatarUrl ||
            res.data.avatar_url ||
            res.data.avatar ||
            res.data.headImg ||
            res.data.head_img ||
            ''
          uni.setStorageSync(STORAGE_KEYS.userInfo, res.data)
        }
      } catch {}
    },
    confirmLogout() {
      uni.showModal({
        title: this.tt('label.pub.confirm.title'),
        content: this.tt('message.logout.confirm'),
        confirmText: this.tt('label.pub.btn.confirm'),
        cancelText: this.tt('label.pub.btn.cancel'),
        success: async (res) => {
          if (!res.confirm) return
          try {
            await logout()
          } catch {}
          uni.showToast({ title: this.tt('message.logout.success'), icon: 'none' })
          safeReLaunch(PAGES.login).catch(() => {})
        },
      })
    },
  },
}
</script>

<style scoped>
.page {
  height: 100vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background-color: #f7f7f7;
}

.content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 24rpx 24rpx calc(24rpx + 100rpx + env(safe-area-inset-bottom));
  box-sizing: border-box;
}

.card {
  background-color: #fff;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 24rpx;
}

.card-title {
  font-size: 28rpx;
  color: #333;
  font-weight: 600;
  margin-bottom: 16rpx;
}

.avatar-block {
  width: 120rpx;
  height: 120rpx;
  border-radius: 60rpx;
  overflow: hidden;
  background-color: #f2f2f2;
  margin: 8rpx auto 18rpx;
}

.avatar {
  width: 120rpx;
  height: 120rpx;
}

.avatar.placeholder {
  width: 120rpx;
  height: 120rpx;
}

.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14rpx 0;
}

.label {
  font-size: 26rpx;
  color: #666;
}

.value {
  font-size: 26rpx;
  color: #333;
  max-width: 420rpx;
  text-align: right;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.btn {
  margin-top: 8rpx;
}
</style>
