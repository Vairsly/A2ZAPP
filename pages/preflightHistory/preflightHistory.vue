<template>
  <view class="page">
    <view class="head" :style="{ paddingTop: statusBarHeight + 'px' }">
      <view class="head-bar">
        <view class="head-left" @click="goBack">
        </view>
        <text class="head-title">{{ tt('label.preflight.history') }}</text>
        <view class="head-right" @click="goCheck">
          <text class="head-right-text">{{ tt('tab.check') }}</text>
        </view>
      </view>
    </view>

    <view class="content">
      <view class="card">
        <view class="filters">
          <input
            class="filter-input"
            :placeholder="tt('label.preflight.filter.droneId')"
            :value="filterDroneId"
            @input="onDroneInput"
          />
          <button class="btn-filter" size="mini" :disabled="loading" @click="applyFilters">
            {{ tt('label.preflight.filter.apply') }}
          </button>
        </view>

        <view v-for="draft in draftList" :key="draft.droneId" class="draft-item" @click="resumeDraft(draft)">
          <view class="draft-left">
            <view class="draft-top">
              <text class="draft-drone">{{ draft.droneDisplay }}</text>
              <text class="draft-tag">{{ tt('label.preflight.draftTag') }}</text>
            </view>
            <text class="draft-time">{{ formatTime(draft.ts) }}</text>
          </view>
          <view class="draft-actions">
            <text class="draft-action">{{ tt('label.preflight.continue') }}</text>
            <text class="draft-delete" @click.stop="deleteDraft(draft)">{{ tt('label.preflight.delete') }}</text>
          </view>
        </view>

        <view v-if="loading && !list.length" class="empty">{{ tt('message.preflight.loadingMore') }}</view>
        <view v-else-if="!list.length" class="empty">{{ tt('message.preflight.historyEmpty') }}</view>

        <view v-for="item in list" :key="item.id" class="history-item">
          <view class="history-main" @click="goDetail(item.id)">
            <view class="history-left">
              <text v-if="item.droneId" class="history-drone">{{ item.droneId }}</text>
              <text class="history-time">{{ formatTime(item.ts) }}</text>
              <text class="history-status" :class="item.passed ? 'ok' : 'bad'">
                {{ item.passed ? tt('label.preflight.passed') : tt('label.preflight.failed') }}
              </text>
            </view>
          </view>
        </view>

        <view v-if="list.length" class="footer">
          <text class="footer-text">{{ footerText }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import { getLang, onLangChange } from '@/common/i18n'
import { PAGES, PREFLIGHT, STORAGE_KEYS } from '@/common/constants'
import { getAccessToken } from '@/common/session'
import { API } from '@/common/api'
import { requestGet } from '@/common/request'
import { isNavGuardActive, safeNavigateTo, safeReLaunch, safeSwitchTab } from '@/common/navigation'

export default {
  data() {
    return {
      statusBarHeight: 0,
      lang: getLang(),
      offLang: null,

      list: [],
      pageNo: 1,
      pageSize: PREFLIGHT.pageSize || 10,
      hasMore: true,
      loading: false,

      filterDroneId: '',
      draftList: [],
    }
  },
  onLoad() {
    try {
      const info = uni.getSystemInfoSync()
      this.statusBarHeight = Number(info && info.statusBarHeight) || 0
    } catch {
      this.statusBarHeight = 0
    }
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
    this.loadDraftSummary()
    this.reload()
  },
  onUnload() {
    if (this.offLang) this.offLang()
  },
  onReachBottom() {
    this.loadMore()
  },
  onPullDownRefresh() {
    this.reload().finally(() => {
      uni.stopPullDownRefresh()
    })
  },
  computed: {
    footerText() {
      if (this.loading) return this.tt('message.preflight.loadingMore')
      if (!this.hasMore) return this.tt('message.preflight.noMore')
      return this.tt('message.preflight.pullUp')
    },
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
          safeSwitchTab(PAGES.home).catch(() => {})
        },
      })
    },
    goCheck() {
      if (isNavGuardActive()) return
      safeNavigateTo(`${PAGES.preflightSelectDrone}?noprefill=1`).catch(() => {})
    },
    formatTime(ts) {
      const d = new Date(Number(ts || 0))
      if (Number.isNaN(d.getTime())) return '-'
      const pad = (n) => String(n).padStart(2, '0')
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(
        d.getMinutes()
      )}`
    },
    async reload() {
      this.pageNo = 1
      this.list = []
      this.hasMore = true
      await this.loadMore()
    },
    applyFilters() {
      this.reload()
    },
    onDroneInput(e) {
      this.filterDroneId = (e && e.detail ? e.detail.value : '') || ''
    },
    buildListParams() {
      const params = { page: this.pageNo, pageSize: this.pageSize }
      const droneId = String(this.filterDroneId || '').trim()
      if (droneId) params.drone_id = droneId
      return params
    },
    goDetail(id) {
      const sid = String(id || '').trim()
      if (!sid) return
      safeNavigateTo(`${PAGES.preflightHistoryDetail}?id=${encodeURIComponent(sid)}`).catch(() => {})
    },
    loadDraftSummary() {
      let raw = uni.getStorageSync(STORAGE_KEYS.preflightDrafts)
      if (typeof raw === 'string') {
        try {
          raw = JSON.parse(raw)
        } catch {
          raw = null
        }
      }
      if (!raw || typeof raw !== 'object') {
        this.draftList = []
        return
      }
      const list = []
      for (const k of Object.keys(raw)) {
        const item = raw[k]
        if (!item || typeof item !== 'object') continue
        const ts = Number(item.ts) || 0
        if (!ts) continue
        list.push({
          droneId: String(item.droneId || k || '').trim(),
          droneAlias: String(item.droneAlias || '').trim(),
          ts,
        })
      }
      list.sort((a, b) => b.ts - a.ts)
      this.draftList = list.map(d => ({
        ...d,
        droneDisplay: d.droneAlias || d.droneId
      }))
    },
    getDraftsMap() {
      let raw = uni.getStorageSync(STORAGE_KEYS.preflightDrafts)
      if (typeof raw === 'string') {
        try {
          raw = JSON.parse(raw)
        } catch {
          raw = null
        }
      }
      if (raw && typeof raw === 'object') return raw
      return {}
    },
    setDraftsMap(map) {
      uni.setStorageSync(STORAGE_KEYS.preflightDrafts, map || {})
    },
    resumeDraft(draft) {
      if (!draft || !draft.droneId) return
      uni.setStorageSync(STORAGE_KEYS.preflightSelectedDroneId, draft.droneId)
      uni.setStorageSync(STORAGE_KEYS.preflightSelectedDroneAlias, draft.droneAlias || draft.droneId)
      uni.setStorageSync(STORAGE_KEYS.preflightStartNew, 'draft')
      safeNavigateTo(PAGES.preflightCheck).catch(() => {})
    },
    deleteDraft(draft) {
      const id = String(draft && draft.droneId ? draft.droneId : '').trim()
      if (!id) return
      uni.showModal({
        title: this.tt('label.pub.confirm.title'),
        content: this.tt('message.preflight.deleteConfirm'),
        confirmText: this.tt('label.pub.btn.confirm'),
        cancelText: this.tt('label.pub.btn.cancel'),
        success: (res) => {
          if (!res.confirm) return
          const map = this.getDraftsMap()
          if (Object.prototype.hasOwnProperty.call(map, id)) {
            delete map[id]
            this.setDraftsMap(map)
          }
          this.loadDraftSummary()
          uni.showToast({ title: this.tt('label.preflight.delete'), icon: 'none' })
        },
      })
    },
    async loadMore() {
      if (this.loading) return
      if (!this.hasMore) return
      this.loading = true
      try {
        const res = await requestGet(
          API.preflight.listChecks,
          this.buildListParams(),
          { dedup: false }
        )
        const data = res && res.data ? res.data : {}
        const next = Array.isArray(data.list) ? data.list : []
        const total = Number(data.total) || 0
        const mapped = next.map((x) => ({
          id: x.id,
          ts: x.create_time ? Date.parse(x.create_time) : 0,
          passed: Boolean(x.passed),
          droneId: x.drone_id || '',
          photoCount: Number(x.photo_count) || 0,
        }))
        this.list = this.list.concat(mapped)
        this.pageNo += 1
        this.hasMore = this.list.length < total
      } finally {
        this.loading = false
      }
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
  display: flex;
  align-items: center;
  justify-content: flex-end;
}

.head-right-text {
  font-size: 28rpx;
  color: #1677ff;
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

.filters {
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding-bottom: 16rpx;
  margin-bottom: 12rpx;
  border-bottom: 1px solid #eee;
}

.draft-item {
  margin-bottom: 12rpx;
  padding: 16rpx 12rpx;
  border-radius: 12rpx;
  background-color: rgba(22, 119, 255, 0.06);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.draft-left {
  display: flex;
  flex-direction: column;
  gap: 6rpx;
}

.draft-top {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.draft-drone {
  font-size: 28rpx;
  color: #1677ff;
  font-weight: 600;
}

.draft-tag {
  font-size: 22rpx;
  padding: 4rpx 10rpx;
  border-radius: 999rpx;
  background-color: rgba(22, 119, 255, 0.12);
  color: #1677ff;
}

.draft-time {
  font-size: 24rpx;
  color: #666;
}

.draft-action {
  font-size: 26rpx;
  color: #1677ff;
}

.draft-actions {
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.draft-delete {
  font-size: 26rpx;
  color: #ff4d4f;
}

.filter-input {
  width: 100%;
  flex: 1;
  height: 72rpx;
  box-sizing: border-box;
  padding: 0 20rpx;
  border-radius: 12rpx;
  background-color: #f7f7f7;
  font-size: 26rpx;
  color: #111;
}

.btn-filter {
  background-color: #1677ff;
  color: #fff;
}

.empty {
  padding: 12rpx 0;
  font-size: 26rpx;
  color: #999;
}

.history-item {
  border-top: 1px solid #eee;
  padding: 14rpx 0;
}

.history-item:first-child {
  border-top: none;
}

.history-main {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.history-left {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.history-time {
  font-size: 26rpx;
  color: #333;
}

.history-drone {
  font-size: 26rpx;
  color: #1677ff;
  font-weight: 600;
}

.history-status {
  font-size: 24rpx;
  padding: 4rpx 10rpx;
  border-radius: 999rpx;
  background-color: #f5f5f5;
  color: #666;
}

.history-status.ok {
  background-color: rgba(82, 196, 26, 0.15);
  color: #389e0d;
}

.history-status.bad {
  background-color: rgba(255, 77, 79, 0.15);
  color: #cf1322;
}

.history-count {
  font-size: 24rpx;
  color: #666;
}

.history-detail {
  padding-top: 12rpx;
}

.detail-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12rpx;
}

.detail-steps {
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

.detail-label {
  font-size: 26rpx;
  color: #666;
}

.detail-value {
  font-size: 26rpx;
  color: #333;
  flex: 1;
  text-align: right;
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

.footer {
  padding-top: 16rpx;
  display: flex;
  justify-content: center;
}

.footer-text {
  font-size: 24rpx;
  color: #999;
}
</style>
