<template>
  <view class="page">
    <view class="head" :style="{ paddingTop: statusBarHeight + 'px' }">
      <view class="head-bar">
        <view class="head-left" @click="goBack">
          <text class="head-left-text">{{ tt('label.pub.btn.back') }}</text>
        </view>
        <text class="head-title">{{ tt('label.preflight.historyDetail') }}</text>
        <view class="head-right" />
      </view>
    </view>

    <view class="content">
      <view class="card">
        <view v-if="loading" class="empty">{{ tt('message.preflight.loadingMore') }}</view>
        <view v-else-if="!detail" class="empty">-</view>
        <view v-else>
          <view class="top-row">
            <text class="top-drone">{{ detail.droneId || '-' }}</text>
            <text class="top-time">{{ formatTime(detail.ts) }}</text>
            <text class="top-status" :class="detail.passed ? 'ok' : 'bad'">
              {{ detail.passed ? tt('label.preflight.passed') : tt('label.preflight.failed') }}
            </text>
          </view>

          <view v-if="detail.note" class="note">
            <text class="note-title">{{ tt('label.preflight.note') }}</text>
            <text class="note-value">{{ detail.note }}</text>
          </view>

          <view class="detail-steps">
            <view class="detail-steps-title">{{ tt('label.preflight.summary') }}</view>
            <view v-for="s in stepMetas" :key="s.key" class="step-row">
              <text class="step-label">{{ tt(s.labelKey) }}</text>
              <text class="step-status" :class="resolveOk(s.key) ? 'ok' : 'bad'">
                {{ resolveOk(s.key) ? tt('label.preflight.passed') : tt('label.preflight.failed') }}
              </text>
            </view>
            <template v-for="s in stepMetas" :key="s.key + '-note'">
              <view v-if="resolveNote(s.key)" class="step-note">
                <text class="step-note-title">{{ tt(s.labelKey) }} · {{ tt('label.preflight.noteForItem') }}</text>
                <text class="step-note-value">{{ resolveNote(s.key) }}</text>
              </view>
            </template>
          </view>

          <view class="detail-photos" v-if="detail.photoUrls.length">
            <image
              v-for="url in detail.photoUrls"
              :key="url"
              class="detail-photo"
              :src="url"
              mode="aspectFill"
              @click="preview(url)"
            />
          </view>

          <view class="delete-wrap">
            <button class="btn-danger" size="mini" @click="deleteOne">
              {{ tt('label.preflight.delete') }}
            </button>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import { getLang, onLangChange } from '@/common/i18n'
import { PAGES } from '@/common/constants'
import { getAccessToken } from '@/common/session'
import { API, getApiBaseUrl } from '@/common/api'
import { request, requestGet } from '@/common/request'
import { safeReLaunch, safeSwitchTab } from '@/common/navigation'

export default {
  data() {
    return {
      statusBarHeight: 0,
      lang: getLang(),
      offLang: null,

      id: '',
      loading: false,
      detail: null,
      stepMetas: [
        { key: 'airframeOk', labelKey: 'label.preflight.item.airframe' },
        { key: 'contactsOk', labelKey: 'label.preflight.item.contacts' },
        { key: 'motorOk', labelKey: 'label.preflight.item.motor' },
        { key: 'propellerOk', labelKey: 'label.preflight.item.propeller' },
        { key: 'upperCoverOk', labelKey: 'label.preflight.item.upperCover' },
        { key: 'antennaOk', labelKey: 'label.preflight.item.antenna' },
        { key: 'landingCameraOk', labelKey: 'label.preflight.item.landingCamera' },
        { key: 'aerialCameraOk', labelKey: 'label.preflight.item.aerialCamera' },
        { key: 'lidarOk', labelKey: 'label.preflight.item.lidar' },
        { key: 'parachuteOk', labelKey: 'label.preflight.item.parachute' },
        { key: 'winchOk', labelKey: 'label.preflight.item.winch' },
        { key: 'batteryOk', labelKey: 'label.preflight.item.battery' },
        { key: 'routerOk', labelKey: 'label.preflight.item.router' },
        { key: 'remoteServerOk', labelKey: 'label.preflight.item.remoteServer' },
        { key: 'dockOk', labelKey: 'label.preflight.item.dockPosition' },
        { key: 'rtkOk', labelKey: 'label.preflight.item.rtk' },
        { key: 'remoteServerM2MOk', labelKey: 'label.preflight.item.remoteServerM2M' },
      ],
    }
  },
  onLoad(options) {
    try {
      const info = uni.getSystemInfoSync()
      this.statusBarHeight = Number(info && info.statusBarHeight) || 0
    } catch {
      this.statusBarHeight = 0
    }
    this.id = options && options.id ? String(options.id) : ''
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
    this.loadDetail()
  },
  onUnload() {
    if (this.offLang) this.offLang()
  },
  methods: {
    tt(key) {
      const _lang = this.lang
      return this.$t(key)
    },
    goBack() {
      uni.navigateBack({
        delta: 1,
        fail: () => {
          safeSwitchTab(PAGES.check).catch(() => {})
        },
      })
    },
    formatTime(ts) {
      const d = new Date(Number(ts || 0))
      if (Number.isNaN(d.getTime())) return '-'
      const pad = (n) => String(n).padStart(2, '0')
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(
        d.getMinutes()
      )}`
    },
    resolveUploadedUrl(path) {
      const p = String(path || '')
      if (!p) return ''
      if (/^https?:\/\//i.test(p)) return p
      const base = getApiBaseUrl()
      if (p.startsWith('/') && base) return `${base}${p}`
      return p
    },
    async loadDetail() {
      const id = String(this.id || '').trim()
      if (!id) return
      if (this.loading) return
      this.loading = true
      try {
        const res = await requestGet(API.preflight.getCheckById(id), null, { dedup: false })
        const data = res && res.data ? res.data : null
        if (!data) {
          this.detail = null
          return
        }

        const itemsArr = Array.isArray(data.items) ? data.items : []
        const items = {}
        const itemNotes = {}
        const allPhotos = []
        for (const it of itemsArr) {
          if (!it) continue
          const key = String(it.item_key || it.key || '').trim()
          if (!key) continue
          items[key] = Boolean(it.ok)
          const note = String(it.note || '').trim()
          if (note) itemNotes[key] = note
          const photos = Array.isArray(it.photo_urls) ? it.photo_urls : []
          for (const p of photos) {
            const u = this.resolveUploadedUrl(p)
            if (u) allPhotos.push(u)
          }
        }

        this.detail = {
          id: id,
          ts: data.create_time ? Date.parse(data.create_time) : 0,
          passed: Boolean(data.passed),
          droneId: data.drone_id || '',
          note: String(data.summary_note || '').trim(),
          items,
          itemNotes,
          photoUrls: allPhotos,
        }
      } catch {
        this.detail = null
      } finally {
        this.loading = false
      }
    },
    resolveOk(key) {
      const d = this.detail
      const items = d && d.items ? d.items : null
      if (!items) return false
      return Boolean(items[key])
    },
    resolveNote(key) {
      const d = this.detail
      const notes = d && d.itemNotes ? d.itemNotes : null
      const value = notes ? notes[key] : ''
      return String(value || '').trim()
    },
    preview(current) {
      const d = this.detail
      const urls = d && d.photoUrls ? d.photoUrls : []
      uni.previewImage({ urls, current })
    },
    deleteOne() {
      const d = this.detail
      if (!d || !d.id) return
      uni.showModal({
        title: this.tt('label.pub.confirm.title'),
        content: this.tt('message.preflight.deleteConfirm'),
        confirmText: this.tt('label.pub.btn.confirm'),
        cancelText: this.tt('label.pub.btn.cancel'),
        success: async (res) => {
          if (!res.confirm) return
          await request({ url: API.preflight.deleteCheckById(d.id), method: 'DELETE', params: { reason: '' }, dedup: false })
          this.goBack()
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

.head {
  background-color: #ffffff;
}

.head-bar {
  height: 88rpx;
  padding: 0 24rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.head-left {
  width: 160rpx;
  display: flex;
  align-items: center;
}

.head-left-text {
  font-size: 28rpx;
  color: #1677ff;
}

.head-title {
  font-size: 32rpx;
  color: #111;
  font-weight: 600;
}

.head-right {
  width: 160rpx;
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
}

.empty {
  padding: 12rpx 0;
  font-size: 26rpx;
  color: #999;
}

.top-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
  flex-wrap: wrap;
  padding-bottom: 16rpx;
  border-bottom: 1px solid #eee;
}

.top-drone {
  font-size: 28rpx;
  color: #1677ff;
  font-weight: 600;
}

.top-time {
  font-size: 26rpx;
  color: #333;
}

.top-status {
  font-size: 24rpx;
  padding: 4rpx 10rpx;
  border-radius: 999rpx;
  background-color: #f5f5f5;
  color: #666;
}

.top-status.ok {
  background-color: rgba(82, 196, 26, 0.15);
  color: #389e0d;
}

.top-status.bad {
  background-color: rgba(255, 77, 79, 0.15);
  color: #cf1322;
}

.note {
  margin-top: 16rpx;
  padding: 12rpx;
  border-radius: 12rpx;
  background-color: #f7f7f7;
}

.note-title {
  font-size: 24rpx;
  color: #666;
}

.note-value {
  display: block;
  margin-top: 6rpx;
  font-size: 26rpx;
  color: #333;
  line-height: 38rpx;
}

.detail-steps {
  padding-top: 16rpx;
  padding-bottom: 12rpx;
}

.detail-steps-title {
  font-size: 26rpx;
  color: #333;
  margin-bottom: 12rpx;
}

.step-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10rpx 0;
}

.step-label {
  font-size: 26rpx;
  color: #666;
  flex: 1;
  margin-right: 12rpx;
}

.step-status {
  font-size: 24rpx;
  padding: 4rpx 10rpx;
  border-radius: 999rpx;
  background-color: #f5f5f5;
  color: #666;
}

.step-status.ok {
  background-color: rgba(82, 196, 26, 0.15);
  color: #389e0d;
}

.step-status.bad {
  background-color: rgba(255, 77, 79, 0.15);
  color: #cf1322;
}

.step-note {
  margin-top: 8rpx;
  padding: 12rpx;
  border-radius: 12rpx;
  background-color: #f7f7f7;
}

.step-note-title {
  font-size: 24rpx;
  color: #666;
}

.step-note-value {
  display: block;
  margin-top: 6rpx;
  font-size: 26rpx;
  color: #333;
  line-height: 38rpx;
}

.detail-photos {
  display: flex;
  flex-wrap: wrap;
  justify-self: self-start;
  gap: 12rpx;
  margin-top: 12rpx;
  margin-bottom: 22rpx;
}

.detail-photo {
  width: 150rpx;
  height: 150rpx;
  border-radius: 12rpx;
  background-color: #f2f2f2;
}

.delete-wrap {
  margin-top: 60rpx;
}

.btn-danger {
  background-color: #ff4d4f;
  color: #fff;
}
</style>
