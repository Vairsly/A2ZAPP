<template>
  <view class="page">
    <view class="head" :style="{ paddingTop: statusBarHeight + 'px' }">
      <view class="head-bar">
        <view class="head-left" @click="goBack">
          <text class="head-left-text">{{ tt('label.pub.btn.back') }}</text>
        </view>
        <text class="head-title">{{ tt('label.preflight.selectDrone') }}</text>
        <view class="head-right" @click="confirm">
          <text class="head-right-text">{{ tt('label.preflight.next') }}</text>
        </view>
      </view>
    </view>

    <view class="content">
      <view class="card">
        <view class="drone-search-wrap" v-if="dronesAll.length">
          <input
            class="drone-search"
            v-model="droneSearch"
            :placeholder="tt('label.preflight.searchDrone.placeholder')"
            confirm-type="search"
          />
          <view v-if="droneSearch" class="drone-search-clear" @click="clearDroneSearch">×</view>
        </view>

        <view v-if="!drones.length" class="empty">{{ droneEmptyText }}</view>
        <view v-else class="drone-list">
          <view
            v-for="d in drones"
            :key="d.id"
            class="drone-item"
            :class="selectedDroneId === d.id ? 'active' : ''"
            @click="selectDrone(d)"
            @longpress="confirmFromLongPress(d)"
          >
            <view class="drone-item-left">
              <text class="drone-name">{{ d.alias || d.id }}</text>
              <text class="drone-sub">{{ d.id }} · {{ d.abbr || '-' }}</text>
            </view>
            <text class="drone-check">{{ selectedDroneId === d.id ? '✓' : '' }}</text>
          </view>
        </view>

        <view v-if="drones.length" class="footer">
          <text class="footer-text">{{ dronesFooterText }}</text>
        </view>

      </view>
    </view>

    <view class="bottom-bar">
      <button class="bottom-btn" :disabled="!selectedDroneId" @click="confirm">
        {{ tt('label.preflight.immediateCheck') }}
      </button>
    </view>
  </view>
</template>

<script>
import { getLang, onLangChange } from '@/common/i18n'
import { API } from '@/common/api'
import { PAGES, STORAGE_KEYS } from '@/common/constants'
import { decodeJwtPayload, getAccessToken } from '@/common/session'
import { requestGet } from '@/common/request'
import { isNavGuardActive, safeNavigateTo, safeSwitchTab } from '@/common/navigation'

export default {
  data() {
    return {
      statusBarHeight: 0,
      lang: getLang(),
      offLang: null,
      noPrefill: false,
      fromCheck: false,

      userInfo: null,
      dronesAll: [],
      drones: [],
      loadingUserInfo: false,
      dronePageNo: 1,
      dronePageSize: 500,
      droneHasMore: true,
      droneLoading: false,
      droneSearch: '',
      selectedDroneId: '',
      selectedDroneAlias: '',
      mockDrones: false,
    }
  },
  onLoad(options) {
    try {
      const info = uni.getSystemInfoSync()
      this.statusBarHeight = Number(info && info.statusBarHeight) || 0
    } catch {
      this.statusBarHeight = 0
    }
    this.noPrefill = Boolean(options && String(options.noprefill || '') === '1')
    this.fromCheck = Boolean(options && String(options.from || '') === 'check')
    this.offLang = onLangChange((next) => {
      this.lang = next
    })
  },
  onShow() {
    if (this.noPrefill) {
      this.selectedDroneId = ''
      this.selectedDroneAlias = ''
      this.noPrefill = false
    } else {
      const savedId = uni.getStorageSync(STORAGE_KEYS.preflightSelectedDroneId)
      const savedAlias = uni.getStorageSync(STORAGE_KEYS.preflightSelectedDroneAlias)
      if (savedId) this.selectedDroneId = String(savedId)
      if (savedAlias) this.selectedDroneAlias = String(savedAlias)
    }
    this.lang = getLang()
    this.ensureUserInfoAndDrones()
  },
  onUnload() {
    if (this.offLang) this.offLang()
  },
  onReachBottom() {
    this.loadMoreDrones()
  },
  computed: {
    filteredDronesAll() {
      const list = Array.isArray(this.dronesAll) ? this.dronesAll : []
      const kw = String(this.droneSearch || '').trim().toLowerCase()
      if (!kw) return list
      return list.filter((d) => {
        const id = String((d && d.id) || '').toLowerCase()
        const abbr = String((d && d.abbr) || '').toLowerCase()
        const alias = String((d && d.alias) || '').toLowerCase()
        return id.includes(kw) || abbr.includes(kw) || alias.includes(kw)
      })
    },
    dronesFooterText() {
      if (this.droneLoading) return this.tt('message.preflight.loadingMore')
      if (!this.droneHasMore) return this.tt('message.preflight.noMore')
      return this.tt('message.preflight.pullUp')
    },
    droneEmptyText() {
      const kw = String(this.droneSearch || '').trim()
      if (kw) return this.tt('message.preflight.noDroneMatch')
      return this.tt('message.preflight.noDrones')
    },
  },
  watch: {
    droneSearch() {
      this.resetDronesPagination()
      this.loadMoreDrones()
    },
  },
  methods: {
    tt(key) {
      const _lang = this.lang
      return this.$t(key)
    },
    goBack() {
      safeSwitchTab(PAGES.check).catch(() => {})
    },
    clearDroneSearch() {
      this.droneSearch = ''
    },
    selectDrone(drone) {
      if (!drone || !drone.id) return
      this.selectedDroneId = drone.id
      this.selectedDroneAlias = drone.alias || drone.id
    },
    confirmFromLongPress(drone) {
      if (!drone || !drone.id) return
      this.selectDrone(drone)
      const droneLabel = String(drone.alias || drone.id)
      const tpl = this.tt('message.preflight.startCheckConfirmWithDrone')
      const content = String(tpl || '').includes('{drone}') ? tpl.replace('{drone}', droneLabel) : this.tt('message.preflight.startCheckConfirm')
      uni.showModal({
        title: this.tt('label.pub.confirm.title'),
        content,
        confirmText: this.tt('label.pub.btn.confirm'),
        cancelText: this.tt('label.pub.btn.cancel'),
        success: (res) => {
          if (!res.confirm) return
          this.confirm()
        },
      })
    },
    parseAssignedDrones(text) {
      const value = String(text || '').trim()
      if (!value) return []
      const items = []
      const parts = value.split(',')
      for (const raw of parts) {
        const p = String(raw || '').trim()
        if (!p) continue
        const segs = p.split('=')
        const id = String(segs[0] || '').trim()
        const abbr = String(segs[2] || '').trim()
        const alias = String(segs[3] || '').trim()
        if (!id) continue
        items.push({ id, abbr, alias })
      }
      const map = new Map()
      for (const d of items) {
        if (!map.has(d.id)) map.set(d.id, d)
      }
      return Array.from(map.values())
    },
    buildMockDrones() {
      return [
        { id: '6003', abbr: '001', alias: 'Longtail Patrol 001' },
        { id: '6005', abbr: '002', alias: 'Longtail Patrol 002' },
        { id: '6011', abbr: '003', alias: 'Longtail Patrol 003' },
        { id: '6015', abbr: '004', alias: 'Longtail Patrol 004' },
      ]
    },
    resetDronesPagination() {
      this.drones = []
      this.dronePageNo = 1
      this.droneHasMore = true
      this.droneLoading = false
    },
    loadMoreDrones() {
      if (this.droneLoading) return
      if (!this.droneHasMore) return
      this.droneLoading = true
      try {
        const start = (this.dronePageNo - 1) * this.dronePageSize
        const end = start + this.dronePageSize
        const source = this.filteredDronesAll || []
        const next = source.slice(start, end)
        this.drones = (this.drones || []).concat(next)
        this.dronePageNo += 1
        this.droneHasMore = end < source.length
      } finally {
        this.droneLoading = false
      }
    },
    async ensureUserInfoAndDrones() {
      if (this.loadingUserInfo) return
      this.loadingUserInfo = true
      try {
        if (!this.userInfo) {
          const cached = uni.getStorageSync(STORAGE_KEYS.userInfo)
          if (cached) this.userInfo = cached
        }
        if (!this.userInfo) {
          const payload = decodeJwtPayload(getAccessToken())
          const userId = payload && payload.sub
          if (userId) {
            try {
              const res = await requestGet(API.users.getById(userId), null, { dedup: true })
              if (res && res.data) {
                this.userInfo = res.data
                uni.setStorageSync(STORAGE_KEYS.userInfo, res.data)
              }
            } catch {}
          }
        }
        this.dronesAll = this.parseAssignedDrones((this.userInfo && this.userInfo.rtsp_streams) || '')
        this.resetDronesPagination()
        this.loadMoreDrones()
      } finally {
        this.loadingUserInfo = false
      }
    },
    confirm() {
      if (isNavGuardActive()) return
      if (!this.selectedDroneId) {
        uni.showToast({ title: this.tt('message.preflight.chooseDroneFirst'), icon: 'none' })
        return
      }
      uni.setStorageSync(STORAGE_KEYS.preflightSelectedDroneId, this.selectedDroneId)
      uni.setStorageSync(STORAGE_KEYS.preflightSelectedDroneAlias, this.selectedDroneAlias || this.selectedDroneId)
      if (this.fromCheck) {
        uni.navigateBack({
          delta: 1,
          fail: () => {
            safeNavigateTo(PAGES.preflightCheck).catch(() => {})
          },
        })
      } else {
        uni.setStorageSync(STORAGE_KEYS.preflightStartNew, '1')
        safeNavigateTo(PAGES.preflightCheck).catch(() => {})
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
  padding: 24rpx 24rpx calc(24rpx + 140rpx + env(safe-area-inset-bottom));
  box-sizing: border-box;
}

.bottom-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 16rpx 24rpx calc(16rpx + env(safe-area-inset-bottom));
  background-color: rgba(255, 255, 255, 0.98);
  border-top: 1px solid #eee;
}

.bottom-btn {
  height: 88rpx;
  line-height: 88rpx;
  border-radius: 12rpx;
  background-color: #1677ff;
  color: #fff;
  font-size: 30rpx;
}

.bottom-btn[disabled] {
  opacity: 0.5;
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

.drone-search-wrap {
  position: sticky;
  top: 0;
  z-index: 20;
  background-color: #fff;
  padding-bottom: 12rpx;
  margin-bottom: 16rpx;
}

.drone-search {
  border: 1px solid #eee;
  border-radius: 12rpx;
  padding: 18rpx 72rpx 18rpx 20rpx;
  font-size: 28rpx;
  color: #333;
}

.drone-search-clear {
  position: absolute;
  right: 18rpx;
  top: 50%;
  transform: translateY(-50%);
  width: 44rpx;
  height: 44rpx;
  border-radius: 999rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #f0f0f0;
  color: #666;
  font-size: 30rpx;
}

.drone-list {
  border-top: 1px solid #eee;
}

.drone-item {
  padding: 16rpx 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid #eee;
}

.drone-item.active .drone-name {
  color: #1677ff;
}

.drone-item-left {
  display: flex;
  flex-direction: column;
}

.drone-name {
  font-size: 28rpx;
  color: #333;
}

.drone-sub {
  font-size: 24rpx;
  color: #999;
  margin-top: 6rpx;
}

.drone-check {
  font-size: 34rpx;
  color: #1677ff;
}

.footer {
  padding: 14rpx 0;
}

.footer-text {
  font-size: 24rpx;
  color: #999;
  text-align: center;
  display: block;
}

</style>
