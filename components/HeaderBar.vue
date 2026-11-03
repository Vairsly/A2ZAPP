<template>
  <view class="header" :style="{ paddingTop: statusBarHeight + 'px' }">
    <view class="left" @click="$emit('logo')">
      <image class="logo" src="/static/logo.png" mode="heightFix" />
    </view>

    <view v-if="showNotice" class="center" @click="$emit('notice')">
      <view class="bell">NOTICE</view>
      <view v-if="unreadCount > 0" class="badge">
        <text class="badge-text">{{ unreadCount }}</text>
      </view>
    </view>
    <view v-else class="center-placeholder" />

    <view class="right">
      <view v-if="showLangSwitch" class="lang-switch" @click="switchLang">{{ langLabel }}</view>
      <view v-else />
    </view>
  </view>
</template>

<script>
export default {
  name: 'HeaderBar',
  props: {
    lang: {
      type: String,
      required: false,
      default: 'zh',
    },
    unreadCount: {
      type: Number,
      default: 0,
    },
    showNotice: {
      type: Boolean,
      default: true,
    },
    showLangSwitch: {
      type: Boolean,
      default: false,
    },
    avatarUrl: {
      type: String,
      default: '',
    },
  },
  computed: {
    langLabel() {
      return this.lang === 'en' ? '中文' : 'EN'
    },
  },
  data() {
    return {
      statusBarHeight: 0,
    }
  },
  created() {
    try {
      const info = uni.getSystemInfoSync()
      this.statusBarHeight = info && info.statusBarHeight ? info.statusBarHeight : 0
    } catch {}
  },
  methods: {
    switchLang() {
      const next = this.lang === 'en' ? 'zh' : 'en'
      this.$emit('langChange', next)
    },
  },
}
</script>

<style scoped>
.header {
  min-height: 120rpx;
  padding: 0 24rpx;
  background-color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom-width: 1rpx;
  border-bottom-style: solid;
  border-bottom-color: #f0f0f0;
}

.left {
  width: 120rpx;
  display: flex;
  align-items: center;
}

.logo {
  height: 56rpx;
  width: 56rpx;
}

.center {
  position: relative;
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: center;
}

.center-placeholder {
  flex: 1;
}

.bell {
  font-size: 24rpx;
  color: #333;
}

.badge {
  position: absolute;
  top: 6rpx;
  right: 40%;
  background-color: #2f80ff;
  min-width: 34rpx;
  height: 34rpx;
  padding: 0 8rpx;
  border-radius: 20rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.badge-text {
  color: #fff;
  font-size: 20rpx;
  line-height: 20rpx;
}

.right {
  width: 120rpx;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  line-height: 60rpx;
}

.lang-switch {
  height: 56rpx;
  padding: 0 18rpx;
  border-radius: 28rpx;
  background-color: #f7f7f7;
  color: #333;
  font-size: 24rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
