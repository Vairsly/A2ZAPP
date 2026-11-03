<template>
  <view class="page">
    <HeaderBar
      :lang="lang"
      :unreadCount="unreadCount"
      :showNotice="false"
      @logo="noop"
      :showLangSwitch="true"
      @langChange="setAppLang"
    />

    <view class="content">
      <!-- <text class="title">{{ tt('label.pub.prop.home') }}</text> -->

      <view class="card">
        <view class="card-title">{{ tt('label.preflight.title') }}</view>
      </view>
    </view>

    <view class="bottom-bar">
      <view class="bottom-actions">
        <button class="bottom-btn secondary" @click="goHistory">
          {{ tt('label.preflight.history') }}
        </button>
        <button class="bottom-btn primary" @click="goCheck">
          {{ tt('label.preflight.title') }}
        </button>
      </view>
    </view>
  </view>
</template>

<script>
  import HeaderBar from '@/components/HeaderBar.vue'
  import { getLang, setLang, onLangChange } from '@/common/i18n'
  import { PAGES } from '@/common/constants'
  import { getAccessToken } from '@/common/session'
  import { isNavGuardActive, safeNavigateTo, safeReLaunch, safeSwitchTab } from '@/common/navigation'

	export default {
    components: { HeaderBar },
		data() {
			return {
        lang: getLang(),
        unreadCount: 3,
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
    },
    onUnload() {
      if (this.offLang) this.offLang()
    },
		methods: {
      tt(key) {
        const _lang = this.lang
        return this.$t(key)
      },
      setAppLang(next) {
        this.lang = setLang(next)
      },
      noop() {},
      goCheck() {
        if (isNavGuardActive()) return
        safeNavigateTo(`${PAGES.preflightSelectDrone}?noprefill=1`).catch(() => {})
      },
      goHistory() {
        safeSwitchTab(PAGES.check).catch(() => {})
      },
		}
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
  padding: 24rpx 24rpx calc(24rpx + 100rpx + 260rpx + env(safe-area-inset-bottom));
  box-sizing: border-box;
}

.title {
  font-size: 34rpx;
  color: #333;
}

.card {
  margin-top: 24rpx;
  background-color: #fff;
  border-radius: 16rpx;
  padding: 24rpx;
}

.card-title {
  font-size: 28rpx;
  color: #333;
  font-weight: 600;
  margin-bottom: 16rpx;
}

.btn {
  margin-top: 8rpx;
}

.btn-primary {
  margin-top: 16rpx;
  background-color: #1677ff;
  color: #fff;
}

.btn-secondary {
  margin-top: 16rpx;
  background-color: #f5f5f5;
  color: #333;
}

.bottom-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: calc(100rpx + env(safe-area-inset-bottom));
  padding: 16rpx 16rpx;
  background-color: rgba(255, 255, 255, 0.98);
  border-top: 1px solid #eee;
  z-index: 30;
}

.bottom-actions {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.bottom-btn {
  width: 100%;
  height: 96rpx;
  line-height: 96rpx;
  border-radius: 12rpx;
  font-size: 32rpx;
}

.bottom-btn.primary {
  background-color: #1677ff;
  color: #fff;
}

.bottom-btn.secondary {
  background-color: #f5f5f5;
  color: #333;
}
</style>
