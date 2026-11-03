<template>
  <view class="page">
    <view
      class="edge-guard edge-guard-left"
      :style="{ top: (statusBarHeight + 44) + 'px' }"
      @touchstart.stop.prevent="onEdgeTouchStart($event, 'left')"
      @touchmove.stop.prevent="onEdgeTouchMove"
      @touchend.stop="onEdgeTouchEnd"
      @touchcancel.stop="onEdgeTouchEnd"
    />
    <view
      class="edge-guard edge-guard-right"
      :style="{ top: (statusBarHeight + 44) + 'px' }"
      @touchstart.stop.prevent="onEdgeTouchStart($event, 'right')"
      @touchmove.stop.prevent="onEdgeTouchMove"
      @touchend.stop="onEdgeTouchEnd"
      @touchcancel.stop="onEdgeTouchEnd"
    />
    <view class="head" :style="{ paddingTop: statusBarHeight + 'px' }">
      <view class="head-bar">
        <view class="head-left" @click="goBack">
          <text class="head-left-text">{{ tt('label.pub.btn.back') }}</text>
        </view>
        <text class="head-title">
          {{ tt('label.preflight.title') }}
        </text>
        <view class="head-right" @click="saveDraft">
          <text v-if="canSaveDraft" class="head-right-text">{{ tt('label.preflight.saveDraft') }}</text>
        </view>
      </view>
    </view>

    <view class="content">
      <view class="card">
        <view class="flow">
          <view class="flow-content">
            <view class="flow-head">
              <view class="flow-progress-wrap">
                <text class="flow-progress">
                  {{ tt('label.preflight.step') }} {{ currentStepIndex + 1 }}/{{ steps.length }}
                </text>
                <view class="flow-drone-wrap" @click="goSelectDrone">
                  <text v-if="selectedDroneId" class="flow-drone">
                    {{ tt('label.preflight.drone') }}：{{ selectedDroneDisplay }}
                  </text>
                  <text class="flow-drone-change">{{ tt('label.preflight.selectDrone') }}</text>
                </view>
              </view>
              <view v-if="flowView === 'steps'" class="flow-nav">
                <button class="btn btn-prev" size="mini" :disabled="currentStepIndex <= 0" @click="prevStep">
                  {{ tt('label.preflight.prev') }}
                </button>
                <button
                  class="btn btn-next"
                  size="mini"
                  @click="currentStepIndex >= steps.length - 1 ? gotoSummary() : nextStep()"
                >
                  {{ currentStepIndex >= steps.length - 1 ? tt('label.preflight.summary') : tt('label.preflight.next') }}
                </button>
              </view>
            </view>

            <view v-if="flowView === 'steps'" class="flow-body">
            <view class="step-top">
              <view class="step-text">
                <view class="flow-item">{{ tt(currentStep.labelKey) }}</view>
                <text v-if="currentStep.descKey" class="flow-desc">{{ tt(currentStep.descKey) }}</text>
              </view>
              <view class="step-demo" @click="previewDemo(currentStep.key)">
                <image class="step-demo-img" :src="getStepDemoSrc(currentStep.key)" mode="aspectFill" />
              </view>
            </view>

            <view class="photos">
              <view class="photos-head">
                <view class="photos-title">
                  {{ tt('label.preflight.photosForItem') }}
                  {{ currentStep.photoRequired ? tt('label.preflight.photoRequiredTag') : tt('label.preflight.photoOptionalTag') }}
                </view>
                <button class="upload-btn" :disabled="uploading || ((currentStep.photoUrls && currentStep.photoUrls.length) || 0) >= maxPhotosPerItem" @click="chooseAndUploadToStep(currentStepIndex)">
                  {{ tt('label.preflight.upload') }}
                </button>
              </view>
              <view class="photos-grid" v-if="currentStep.photoUrls && currentStep.photoUrls.length">
                <view v-for="(url, idx) in currentStep.photoUrls" :key="url" class="photo-item">
                  <image class="photo" :src="url" mode="aspectFill" @click="previewStep(currentStep, url)" />
                  <view class="photo-remove" @click="removeStepPhoto(currentStepIndex, idx)">×</view>
                </view>
              </view>
            </view>

            <view class="item-note">
              <view class="item-note-title">{{ tt('label.preflight.noteForItem') }}</view>
              <textarea
                class="item-note-input"
                :placeholder="tt('label.preflight.noteForItem.placeholder')"
                :value="currentStep.note || ''"
                auto-height
                @input="onStepNoteInput"
              />
            </view>

          </view>

            <view v-else class="flow-summary">
            <view class="summary-title">{{ tt('label.preflight.summary') }}</view>
            <view v-for="(s, idx) in steps" :key="s.key" class="summary-row" @click="openSummaryItem(idx)">
              <text class="summary-label">{{ tt(s.labelKey) }}</text>
              <view class="summary-right">
                <text class="summary-count">
                  {{ (s.photoUrls && s.photoUrls.length) || 0 }}{{ tt('label.preflight.photosShort') }}
                </text>
                <text class="summary-status" :class="s.ok ? 'ok' : 'bad'">
                  {{ s.ok ? tt('label.preflight.passed') : tt('label.preflight.failed') }}
                </text>
              </view>
            </view>
          </view>
          </view>
        </view>

    <view v-if="flowView === 'summary'" class="note">
          <view class="note-title">{{ tt('label.preflight.note') }}</view>
          <textarea
            class="note-input"
            :placeholder="tt('label.preflight.note.placeholder')"
            v-model="draft.note"
            auto-height
          />
        </view>

    <view v-if="flowView === 'summary'" class="summary-actions">
      <button
        class="btn-draft"
        :disabled="uploading || submittingCheck || !canSaveDraft"
        @click="saveDraft"
      >
        {{ tt('label.preflight.saveDraftBox') }}
      </button>
      <button
        class="btn-primary"
        :disabled="uploading || submittingCheck || hasSubmittedCurrent || !flowCompleted"
        @click="submitPreflight"
      >
        {{ tt('label.preflight.submit') }}
      </button>
    </view>
      </view>
    </view>

    <view v-if="flowView === 'steps'" class="step-bottom-bar">
      <view class="flow-actions">
        <button class="btn-danger" size="mini" @click="markStep(false)">
          {{ tt('label.preflight.action.fail') }}
        </button>
        <button class="btn-ok" size="mini" @click="markStep(true)">
          {{ tt('label.preflight.action.pass') }}
        </button>
      </view>
    </view>
  </view>
</template>

<script>
import { getCurrentInstance } from 'vue'
import { onBackPress as onBackPressHook } from '@dcloudio/uni-app'
import { getLang, setLang, onLangChange } from '@/common/i18n'
import { AUTH, HTTP_HEADERS, PAGES, STORAGE_KEYS, PREFLIGHT_MAX_PHOTOS_PER_ITEM, PREFLIGHT_DRAFT_AUTOSAVE_MS } from '@/common/constants'
import { clearSession, getAccessToken, hasRefreshToken, refreshTokens, ensureFreshAccessToken } from '@/common/session'
import { API, getApiBaseUrl } from '@/common/api'
import { request, requestGet, requestPost } from '@/common/request'
import { isNavGuardActive, safeNavigateTo, safeReLaunch, safeSwitchTab } from '@/common/navigation'

function svgDataUri(svg) {
  const encoded = encodeURIComponent(String(svg || '').trim())
    .replace(/%0A/g, '')
    .replace(/%20/g, ' ')
    .replace(/%3D/g, '=')
    .replace(/%3A/g, ':')
    .replace(/%2F/g, '/')
    .replace(/%22/g, "'")
  return `data:image/svg+xml,${encoded}`
}

function buildDemoSvgs() {
  const wrap = (title, body) =>
    `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="320" viewBox="0 0 720 320">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#f0f5ff"/>
          <stop offset="1" stop-color="#ffffff"/>
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="720" height="320" rx="24" fill="url(#g)"/>
      <text x="36" y="70" font-size="34" font-family="Arial" fill="#1f1f1f">${title}</text>
      ${body}
    </svg>`

  return {
    batteryOk: svgDataUri(
      wrap(
        'Battery',
        `<rect x="36" y="110" width="560" height="120" rx="18" fill="#ffffff" stroke="#91caff" stroke-width="4"/>
         <rect x="596" y="150" width="40" height="40" rx="8" fill="#91caff"/>
         <rect x="52" y="126" width="420" height="88" rx="12" fill="#b7eb8f"/>
         <text x="70" y="192" font-size="30" font-family="Arial" fill="#135200">>= 50%</text>`
      )
    ),
    gpsOk: svgDataUri(
      wrap(
        'GPS',
        `<circle cx="170" cy="185" r="62" fill="#ffffff" stroke="#91caff" stroke-width="4"/>
         <circle cx="170" cy="185" r="10" fill="#1677ff"/>
         <path d="M170 118 L190 168 L170 252 L150 168 Z" fill="#1677ff" opacity="0.25"/>
         <rect x="270" y="130" width="390" height="110" rx="18" fill="#ffffff" stroke="#91caff" stroke-width="4"/>
         <text x="300" y="198" font-size="30" font-family="Arial" fill="#1f1f1f">Satellites: OK</text>`
      )
    ),
    propOk: svgDataUri(
      wrap(
        'Propeller',
        `<circle cx="200" cy="185" r="70" fill="#ffffff" stroke="#91caff" stroke-width="4"/>
         <path d="M200 115 C250 135 250 235 200 255 C150 235 150 135 200 115 Z" fill="#1677ff" opacity="0.18"/>
         <path d="M130 185 C150 135 250 135 270 185 C250 235 150 235 130 185 Z" fill="#1677ff" opacity="0.18"/>
         <circle cx="200" cy="185" r="12" fill="#1677ff"/>
         <rect x="320" y="130" width="340" height="110" rx="18" fill="#ffffff" stroke="#91caff" stroke-width="4"/>
         <text x="350" y="198" font-size="30" font-family="Arial" fill="#1f1f1f">No cracks</text>`
      )
    ),
    signalOk: svgDataUri(
      wrap(
        'Link',
        `<rect x="80" y="126" width="160" height="120" rx="18" fill="#ffffff" stroke="#91caff" stroke-width="4"/>
         <rect x="106" y="152" width="108" height="16" rx="8" fill="#1677ff"/>
         <rect x="106" y="182" width="78" height="16" rx="8" fill="#1677ff" opacity="0.8"/>
         <rect x="106" y="212" width="52" height="16" rx="8" fill="#1677ff" opacity="0.6"/>
         <path d="M310 220 C360 160 430 160 480 220" fill="none" stroke="#1677ff" stroke-width="6" opacity="0.35"/>
         <path d="M330 220 C370 178 420 178 460 220" fill="none" stroke="#1677ff" stroke-width="6" opacity="0.55"/>
         <path d="M350 220 C380 198 410 198 440 220" fill="none" stroke="#1677ff" stroke-width="6" opacity="0.85"/>
         <circle cx="395" cy="230" r="10" fill="#1677ff"/>`
      )
    ),
    routeOk: svgDataUri(
      wrap(
        'Route',
        `<rect x="60" y="110" width="600" height="150" rx="18" fill="#ffffff" stroke="#91caff" stroke-width="4"/>
         <path d="M120 225 C190 150 260 250 330 170 C400 95 470 250 540 175" fill="none" stroke="#1677ff" stroke-width="6"/>
         <circle cx="120" cy="225" r="10" fill="#52c41a"/>
         <circle cx="540" cy="175" r="10" fill="#ff4d4f"/>
         <text x="88" y="300" font-size="24" font-family="Arial" fill="#595959">Start</text>
         <text x="520" y="300" font-size="24" font-family="Arial" fill="#595959">End</text>`
      )
    ),
  }
}

const STEP_DEMOS = buildDemoSvgs()

function buildMockHistory() {
  const now = Date.now()
  const mk = (i, passed) => {
    const ts = now - i * 1000 * 60 * 17
    const id = `mock_${ts}_${i}`
    const keys = [
      'batteryOk',
      'propellerOk',
      'motorOk',
      'airframeOk',
      'upperCoverOk',
      'winchOk',
      'contactsOk',
      'aerialCameraOk',
      'antennaOk',
      'landingCameraOk',
      'lidarOk',
      'routerOk',
      'remoteServerOk',
      'dockOk',
      'rtkOk',
      'parachuteOk',
      'remoteServerM2MOk',
    ]
    const items = {}
    const itemNotes = {}
    for (const k of keys) {
      items[k] = passed ? true : i % 6 !== 0
      itemNotes[k] = i % 3 === 0 ? '示例备注' : ''
    }
    const photoUrls = ['/static/logo.png', '/static/logo.png'].slice(0, (i % 3) + 1)
    return {
      id,
      ts,
      passed,
      items,
      note: i % 2 === 0 ? '天气良好，风速低' : '',
      itemNotes,
      itemPhotos: {
        batteryOk: photoUrls.slice(0, 1),
        propellerOk: photoUrls.slice(0, 1),
        motorOk: photoUrls.slice(0, 1),
        airframeOk: photoUrls.slice(0, 1),
        upperCoverOk: photoUrls.slice(0, 1),
        winchOk: photoUrls.slice(0, 1),
        contactsOk: photoUrls.slice(0, 1),
        aerialCameraOk: photoUrls.slice(0, 1),
        antennaOk: photoUrls.slice(0, 1),
        landingCameraOk: photoUrls.slice(0, 1),
        lidarOk: photoUrls.slice(0, 1),
        routerOk: [],
        remoteServerOk: [],
        dockOk: [],
        rtkOk: [],
        parachuteOk: photoUrls.slice(0, 1),
        remoteServerM2MOk: [],
      },
      photoUrls,
    }
  }
  const list = []
  for (let i = 0; i < 18; i += 1) {
    list.push(mk(i + 1, i % 5 !== 0))
  }
  return list
}

export default {
  setup() {
    const inst = getCurrentInstance()
    onBackPressHook(() => {
      const proxy = inst && (inst.proxy || inst.ctx)
      if (proxy && typeof proxy.promptSaveDraftThenLeave === 'function') {
        proxy.promptSaveDraftThenLeave()
      }
      return true
    })
    return {}
  },
  data() {
    return {
      statusBarHeight: 0,
      lang: getLang(),
      selectedDroneId: '',
      selectedDroneAlias: '',
      imageCompress: {
        enabled: true,
        maxSide: 1600,
        targetKB: 500,
        qualitySteps: [80, 70, 60, 50, 45, 40],
        maxAttempts: 6,
      },
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

      mockUpload: false,
      maxPhotosPerItem: PREFLIGHT_MAX_PHOTOS_PER_ITEM,
      uploading: false,
      submittingCheck: false,
      hasSubmittedCurrent: false,
      lastSubmitFingerprint: '',
      leavePrompting: false,
      discardingDraft: false,
      lastAutosaveFingerprint: '',
      edgeSwipe: null,
      draft: {
        note: '',
      },
      steps: [
        {
          key: 'airframeOk',
          labelKey: 'label.preflight.item.airframe',
          descKey: 'label.preflight.itemDesc.airframe',
          photoRequired: true,
          ok: null,
          photoUrls: [],
          note: '',
        },
        {
          key: 'contactsOk',
          labelKey: 'label.preflight.item.contacts',
          descKey: 'label.preflight.itemDesc.contacts',
          photoRequired: true,
          ok: null,
          photoUrls: [],
          note: '',
        },
        {
          key: 'motorOk',
          labelKey: 'label.preflight.item.motor',
          descKey: 'label.preflight.itemDesc.motor',
          photoRequired: true,
          ok: null,
          photoUrls: [],
          note: '',
        },
        {
          key: 'propellerOk',
          labelKey: 'label.preflight.item.propeller',
          descKey: 'label.preflight.itemDesc.propeller',
          photoRequired: true,
          ok: null,
          photoUrls: [],
          note: '',
        },
        {
          key: 'upperCoverOk',
          labelKey: 'label.preflight.item.upperCover',
          descKey: 'label.preflight.itemDesc.upperCover',
          photoRequired: true,
          ok: null,
          photoUrls: [],
          note: '',
        },
        {
          key: 'antennaOk',
          labelKey: 'label.preflight.item.antenna',
          descKey: 'label.preflight.itemDesc.antenna',
          photoRequired: true,
          ok: null,
          photoUrls: [],
          note: '',
        },
        {
          key: 'landingCameraOk',
          labelKey: 'label.preflight.item.landingCamera',
          descKey: 'label.preflight.itemDesc.landingCamera',
          photoRequired: true,
          ok: null,
          photoUrls: [],
          note: '',
        },
        {
          key: 'aerialCameraOk',
          labelKey: 'label.preflight.item.aerialCamera',
          descKey: 'label.preflight.itemDesc.aerialCamera',
          photoRequired: true,
          ok: null,
          photoUrls: [],
          note: '',
        },
        {
          key: 'lidarOk',
          labelKey: 'label.preflight.item.lidar',
          descKey: 'label.preflight.itemDesc.lidar',
          photoRequired: true,
          ok: null,
          photoUrls: [],
          note: '',
        },
        {
          key: 'parachuteOk',
          labelKey: 'label.preflight.item.parachute',
          descKey: 'label.preflight.itemDesc.parachute',
          photoRequired: false,
          ok: null,
          photoUrls: [],
          note: '',
        },
        {
          key: 'winchOk',
          labelKey: 'label.preflight.item.winch',
          descKey: 'label.preflight.itemDesc.winch',
          photoRequired: true,
          ok: null,
          photoUrls: [],
          note: '',
        },
        {
          key: 'batteryOk',
          labelKey: 'label.preflight.item.battery',
          descKey: 'label.preflight.itemDesc.battery',
          photoRequired: true,
          ok: null,
          photoUrls: [],
          note: '',
        },
        {
          key: 'routerOk',
          labelKey: 'label.preflight.item.router',
          descKey: 'label.preflight.itemDesc.router',
          photoRequired: false,
          ok: null,
          photoUrls: [],
          note: '',
        },
        {
          key: 'remoteServerOk',
          labelKey: 'label.preflight.item.remoteServer',
          descKey: 'label.preflight.itemDesc.remoteServer',
          photoRequired: false,
          ok: null,
          photoUrls: [],
          note: '',
        },
        {
          key: 'dockOk',
          labelKey: 'label.preflight.item.dockPosition',
          descKey: 'label.preflight.itemDesc.dockPosition',
          photoRequired: false,
          ok: null,
          photoUrls: [],
          note: '',
        },
        {
          key: 'rtkOk',
          labelKey: 'label.preflight.item.rtk',
          descKey: 'label.preflight.itemDesc.rtk',
          photoRequired: false,
          ok: null,
          photoUrls: [],
          note: '',
        },
        {
          key: 'remoteServerM2MOk',
          labelKey: 'label.preflight.item.remoteServerM2M',
          descKey: 'label.preflight.itemDesc.remoteServerM2M',
          photoRequired: false,
          ok: null,
          photoUrls: [],
          note: '',
        },
      ],
      currentStepIndex: 0,
      flowView: 'steps',
      reviewFromSummary: false,
      offLang: null,
      hasShownOnce: false,
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
    if (!this.hasShownOnce) this.hasShownOnce = true

    const storedId = uni.getStorageSync(STORAGE_KEYS.preflightSelectedDroneId)
    const storedAlias = uni.getStorageSync(STORAGE_KEYS.preflightSelectedDroneAlias)
    if (storedId) this.selectedDroneId = String(storedId)
    if (storedAlias) this.selectedDroneAlias = String(storedAlias)

    const startNew = uni.getStorageSync(STORAGE_KEYS.preflightStartNew)
    if (!startNew) {
      if (!this.selectedDroneId && !this.hasProgress()) {
        safeNavigateTo(PAGES.preflightHistory).catch(() => {})
        return
      }
      return
    }
    const startNewMode = String(startNew || '')
    uni.removeStorageSync(STORAGE_KEYS.preflightStartNew)
    if (!this.selectedDroneId) {
      safeNavigateTo(PAGES.preflightSelectDrone).catch(() => {})
      return
    }
    if (startNewMode === 'draft' && this.tryRestoreDraft()) {
      this.hasSubmittedCurrent = false
      this.lastSubmitFingerprint = ''
      uni.showToast({ title: this.tt('message.preflight.draftRestored'), icon: 'none' })
      return
    }
    this.resetFlow()
    this.hasSubmittedCurrent = false
    this.lastSubmitFingerprint = ''
  },
  onReady() {
    this.bindNativeBack()
    this.startDraftAutosave()
  },
  onHide() {
    if (this.discardingDraft) return
    if (this.canSaveDraft) this.saveDraft({ silent: true })
  },
  onUnload() {
    this.stopDraftAutosave()
    this.unbindNativeBack()
    if (this.offLang) this.offLang()
  },
  onBackPress() {
    this.promptSaveDraftThenLeave()
    return true
  },
  onReachBottom() {
  },
  computed: {
    selectedDroneDisplay() {
      return this.selectedDroneAlias || this.selectedDroneId
    },
    currentStep() {
      const idx = Math.min(Math.max(this.currentStepIndex, 0), this.steps.length - 1)
      return this.steps[idx] || { key: '', labelKey: '', descKey: '', ok: null, photoRequired: false, photoUrls: [], note: '' }
    },
    flowCompleted() {
      return this.steps.every((s) => s.ok === true || s.ok === false)
    },
    canSaveDraft() {
      if (!this.selectedDroneId) return false
      if (this.hasSubmittedCurrent) return false
      return this.hasProgress()
    },
  },
  watch: {
    steps: {
      deep: true,
      handler() {
        this.hasSubmittedCurrent = false
      },
    },
    'draft.note'() {
      this.hasSubmittedCurrent = false
    },
  },
  methods: {
    tt(key) {
      const _lang = this.lang
      return this.$t(key)
    },
    toastBuilding() {
      uni.showToast({ title: this.tt('message.pub.building'), icon: 'none' })
    },
    toggleLang() {
      const next = this.lang === 'en' ? 'zh' : 'en'
      this.lang = setLang(next)
    },
    bindNativeBack() {
      if (this._nativeBackBound) return
      this._nativeBackHandler = () => {
        this.promptSaveDraftThenLeave()
      }
      try {
        if (typeof plus !== 'undefined' && plus.key && typeof plus.key.addEventListener === 'function') {
          plus.key.addEventListener('backbutton', this._nativeBackHandler)
          this._nativeBackBound = true
        }
        if (typeof plus !== 'undefined' && plus.webview) {
          const wv = plus.webview.currentWebview()
          if (wv && wv.setStyle) wv.setStyle({ popGesture: 'none' })
        }
      } catch (e) {}
    },
    unbindNativeBack() {
      try {
        if (this._nativeBackBound && typeof plus !== 'undefined' && plus.key) {
          plus.key.removeEventListener('backbutton', this._nativeBackHandler)
        }
      } catch (e) {}
      this._nativeBackBound = false
    },
    onEdgeTouchStart(e, side) {
      const t = (e && (e.changedTouches || e.touches) || [])[0]
      if (!t) return
      this.edgeSwipe = {
        side,
        x: Number(t.clientX || t.pageX || 0),
        y: Number(t.clientY || t.pageY || 0),
        fired: false,
      }
    },
    onEdgeTouchMove(e) {
      const sw = this.edgeSwipe
      if (!sw || sw.fired) return
      const t = (e && (e.changedTouches || e.touches) || [])[0]
      if (!t) return
      const x = Number(t.clientX || t.pageX || 0)
      const y = Number(t.clientY || t.pageY || 0)
      const dx = x - sw.x
      const dy = y - sw.y
      if (Math.abs(dx) < 36) return
      if (Math.abs(dx) <= Math.abs(dy)) return
      const inward = sw.side === 'left' ? dx > 0 : dx < 0
      if (!inward) return
      sw.fired = true
      this.promptSaveDraftThenLeave()
    },
    onEdgeTouchEnd() {
      this.edgeSwipe = null
    },
    goBack() {
      this.promptSaveDraftThenLeave()
    },
    doLeaveCheck() {
      safeSwitchTab(PAGES.check).catch(() => {})
    },
    promptSaveDraftThenLeave() {
      if (this.leavePrompting) return
      if (this.hasSubmittedCurrent || !this.hasProgress()) {
        this.doLeaveCheck()
        return
      }
      this.leavePrompting = true
      uni.showModal({
        title: this.tt('label.pub.confirm.title'),
        content: this.tt('message.preflight.leaveSaveDraft'),
        confirmText: this.tt('label.preflight.saveDraft'),
        cancelText: this.tt('label.preflight.discardDraft'),
        success: (res) => {
          if (res.confirm) this.saveDraft({ silent: true })
          else this.discardingDraft = true
          this.doLeaveCheck()
        },
        complete: () => {
          this.leavePrompting = false
        },
      })
    },
    goSelectDrone() {
      if (isNavGuardActive()) return
      safeNavigateTo(`${PAGES.preflightSelectDrone}?from=check`).catch(() => {})
    },
    hasProgress() {
      if (String(this.draft.note || '').trim()) return true
      for (const s of this.steps) {
        if (s.ok === true || s.ok === false) return true
        if (s.photoUrls && s.photoUrls.length) return true
        if (String(s.note || '').trim()) return true
      }
      return false
    },
    previewStep(step, current) {
      const urls = (step && step.photoUrls) || []
      uni.previewImage({ urls, current })
    },
    previewDemo(key) {
      const src = this.getStepDemoSrc(key)
      if (!src) return
      uni.previewImage({ urls: [src], current: src })
    },
    removeStepPhoto(stepIdx, photoIdx) {
      const i = Math.min(Math.max(Number(stepIdx) || 0, 0), this.steps.length - 1)
      const step = this.steps[i]
      if (!step) return
      const nextPhotos = (step.photoUrls || []).slice()
      nextPhotos.splice(photoIdx, 1)
      const nextSteps = this.steps.slice()
      nextSteps.splice(i, 1, { ...step, photoUrls: nextPhotos })
      this.steps = nextSteps
    },
    onStepNoteInput(e) {
      const value = e && e.detail ? e.detail.value : ''
      const i = Math.min(Math.max(Number(this.currentStepIndex) || 0, 0), this.steps.length - 1)
      const step = this.steps[i]
      if (!step) return
      const nextSteps = this.steps.slice()
      nextSteps.splice(i, 1, { ...step, note: value })
      this.steps = nextSteps
    },
    getStepDemoSrc(key) {
      const k = String(key || '')
      const pngKeys = {
        batteryOk: true,
        propellerOk: true,
        motorOk: true,
        airframeOk: true,
        upperCoverOk: true,
        winchOk: true,
        contactsOk: true,
        aerialCameraOk: true,
        antennaOk: true,
        landingCameraOk: true,
        lidarOk: true,
      }
      if (pngKeys[k]) return `/static/check/${k}.png`

      const map = {
        propellerOk: 'propOk',
        motorOk: 'signalOk',
        airframeOk: 'propOk',
        upperCoverOk: 'propOk',
        winchOk: 'signalOk',
        contactsOk: 'batteryOk',
        aerialCameraOk: 'routeOk',
        antennaOk: 'signalOk',
        landingCameraOk: 'gpsOk',
        lidarOk: 'gpsOk',
        routerOk: 'signalOk',
        remoteServerOk: 'signalOk',
        dockOk: 'routeOk',
        rtkOk: 'gpsOk',
        parachuteOk: 'propOk',
        remoteServerM2MOk: 'signalOk',
        batteryOk: 'batteryOk',
      }
      const mapped = map[k] || 'routeOk'
      return STEP_DEMOS[mapped] || STEP_DEMOS.routeOk
    },
    resetFlow() {
      this.steps = this.steps.map((s) => ({ ...s, ok: null, photoUrls: [], note: '' }))
      this.currentStepIndex = 0
      this.flowView = 'steps'
      this.reviewFromSummary = false
      this.draft = { note: '' }
    },
    getDraftsMap() {
      const raw = uni.getStorageSync(STORAGE_KEYS.preflightDrafts)
      if (raw && typeof raw === 'object') return raw
      return {}
    },
    setDraftsMap(map) {
      uni.setStorageSync(STORAGE_KEYS.preflightDrafts, map || {})
    },
    buildDraftPayload() {
      return {
        v: 1,
        droneId: String(this.selectedDroneId || ''),
        droneAlias: String(this.selectedDroneAlias || ''),
        currentStepIndex: Number(this.currentStepIndex) || 0,
        flowView: String(this.flowView || 'steps'),
        draft: { note: String((this.draft && this.draft.note) || '') },
        steps: (this.steps || []).map((s) => ({
          key: String((s && s.key) || ''),
          ok: s && (s.ok === true || s.ok === false) ? Boolean(s.ok) : null,
          note: String((s && s.note) || ''),
          photoUrls: Array.isArray(s && s.photoUrls) ? s.photoUrls.filter(Boolean) : [],
        })),
        ts: Date.now(),
      }
    },
    saveDraft(opts) {
      if (!this.canSaveDraft) return
      if (!this.selectedDroneId) return
      const payload = this.buildDraftPayload()
      const map = this.getDraftsMap()
      map[String(this.selectedDroneId)] = payload
      this.setDraftsMap(map)
      this.lastAutosaveFingerprint = this.draftFingerprint(payload)
      const silent = opts && opts.silent
      if (!silent) {
        uni.showToast({ title: this.tt('message.preflight.draftSaved'), icon: 'none' })
      }
    },
    draftFingerprint(payload) {
      const p = payload || this.buildDraftPayload()
      try {
        const copy = { ...p }
        delete copy.ts
        return JSON.stringify(copy)
      } catch {
        return ''
      }
    },
    startDraftAutosave() {
      this.stopDraftAutosave()
      const ms = Number(PREFLIGHT_DRAFT_AUTOSAVE_MS) || 30000
      this._draftAutosaveTimer = setInterval(() => {
        this.autosaveDraftTick()
      }, ms)
    },
    stopDraftAutosave() {
      if (this._draftAutosaveTimer) {
        clearInterval(this._draftAutosaveTimer)
        this._draftAutosaveTimer = null
      }
    },
    autosaveDraftTick() {
      if (this.discardingDraft || this.hasSubmittedCurrent || this.leavePrompting) return
      if (!this.canSaveDraft) return
      const fp = this.draftFingerprint()
      if (fp && fp === this.lastAutosaveFingerprint) return
      this.saveDraft({ silent: true })
    },
    clearDraft(droneId) {
      const id = String(droneId || '').trim()
      if (!id) return
      const map = this.getDraftsMap()
      if (!Object.prototype.hasOwnProperty.call(map, id)) return
      delete map[id]
      this.setDraftsMap(map)
    },
    tryRestoreDraft() {
      const id = String(this.selectedDroneId || '').trim()
      if (!id) return false
      const map = this.getDraftsMap()
      const payload = map && Object.prototype.hasOwnProperty.call(map, id) ? map[id] : null
      if (!payload || !payload.steps) return false
      const savedSteps = Array.isArray(payload.steps) ? payload.steps : []
      const byKey = new Map()
      for (const s of savedSteps) {
        const k = String((s && s.key) || '').trim()
        if (!k) continue
        byKey.set(k, s)
      }
      this.steps = this.steps.map((s) => {
        const k = String((s && s.key) || '').trim()
        const saved = byKey.get(k)
        if (!saved) return { ...s }
        return {
          ...s,
          ok: saved.ok === true || saved.ok === false ? Boolean(saved.ok) : null,
          note: String(saved.note || ''),
          photoUrls: Array.isArray(saved.photoUrls) ? saved.photoUrls.filter(Boolean).slice(0, PREFLIGHT_MAX_PHOTOS_PER_ITEM) : [],
        }
      })
      const idx = Number(payload.currentStepIndex) || 0
      this.currentStepIndex = Math.min(Math.max(idx, 0), this.steps.length - 1)
      const fv = String(payload.flowView || 'steps')
      this.flowView = fv === 'summary' ? 'summary' : 'steps'
      this.reviewFromSummary = false
      this.draft = { note: String((payload.draft && payload.draft.note) || '') }
      return true
    },
    markStep(ok) {
      const next = this.steps.slice()
      const item = next[this.currentStepIndex]
      if (!item) return
      next.splice(this.currentStepIndex, 1, { ...item, ok: Boolean(ok) })
      this.steps = next
      const after = this.steps[this.currentStepIndex]
      if (after && after.photoRequired && (!after.photoUrls || !after.photoUrls.length)) {
        uni.showToast({ title: this.tt('message.preflight.photoRequired'), icon: 'none' })
        return
      }
      if (this.flowView !== 'steps') return
      if (this.reviewFromSummary) {
        this.flowView = 'summary'
        this.reviewFromSummary = false
        return
      }
      const isLast = this.currentStepIndex >= this.steps.length - 1
      if (!isLast) {
        this.currentStepIndex += 1
        return
      }
      if (!this.flowCompleted) return
      const missing = this.steps.find((s) => s.photoRequired && (!s.photoUrls || !s.photoUrls.length))
      if (missing) {
        uni.showToast({ title: this.tt('message.preflight.photoRequired'), icon: 'none' })
        return
      }
      this.flowView = 'summary'
    },
    prevStep() {
      if (this.flowView === 'summary') {
        this.flowView = 'steps'
        this.currentStepIndex = Math.max(0, this.steps.length - 1)
        return
      }
      this.currentStepIndex = Math.max(0, this.currentStepIndex - 1)
    },
    nextStep() {
      if (this.flowView !== 'steps') return
      const cur = this.currentStep
      if (!(cur.ok === true || cur.ok === false)) {
        uni.showToast({ title: this.tt('message.preflight.chooseResultFirst'), icon: 'none' })
        return
      }
      if (cur.photoRequired && (!cur.photoUrls || !cur.photoUrls.length)) {
        uni.showToast({ title: this.tt('message.preflight.photoRequired'), icon: 'none' })
        return
      }
      if (this.currentStepIndex >= this.steps.length - 1) return
      this.currentStepIndex = Math.min(this.steps.length - 1, this.currentStepIndex + 1)
    },
    gotoSummary() {
      if (this.flowView !== 'steps') return
      const cur = this.currentStep
      if (!(cur.ok === true || cur.ok === false)) {
        uni.showToast({ title: this.tt('message.preflight.chooseResultFirst'), icon: 'none' })
        return
      }
      if (cur.photoRequired && (!cur.photoUrls || !cur.photoUrls.length)) {
        uni.showToast({ title: this.tt('message.preflight.photoRequired'), icon: 'none' })
        return
      }
      const missing = this.steps.find((s) => s.photoRequired && (!s.photoUrls || !s.photoUrls.length))
      if (missing) {
        uni.showToast({ title: this.tt('message.preflight.photoRequired'), icon: 'none' })
        return
      }
      if (!this.flowCompleted) return
      this.flowView = 'summary'
    },
    editFrom(idx) {
      const start = Math.min(Math.max(Number(idx) || 0, 0), this.steps.length - 1)
      this.steps = this.steps.map((s, i) => (i >= start ? { ...s, ok: null, photoUrls: [], note: '' } : s))
      this.currentStepIndex = start
      this.flowView = 'steps'
    },
    openSummaryItem(idx) {
      const i = Math.min(Math.max(Number(idx) || 0, 0), this.steps.length - 1)
      this.flowView = 'steps'
      this.currentStepIndex = i
      this.reviewFromSummary = true
    },
    resolveUploadedUrl(path) {
      const p = String(path || '')
        .trim()
        .replace(/^`+|`+$/g, '')
        .trim()
      if (!p) return ''
      if (/^https?:\/\//i.test(p)) return p
      const base = getApiBaseUrl()
      if (p.startsWith('/') && base) return `${base}${p}`
      return p
    },
    uploadOne(filePath) {
      const base = getApiBaseUrl()
      const url = `${base || ''}${API.preflight.uploadImages}`
      const parseUploadRes = (res) => {
        const http = Number(res && res.statusCode) || 0
        let parsed = res && res.data
        if (typeof parsed === 'string') {
          try {
            parsed = JSON.parse(parsed)
          } catch {
            parsed = null
          }
        }
        const bizCode = parsed && typeof parsed === 'object' && parsed.code !== undefined ? Number(parsed.code) : null
        const unauthorized = http === 401 || bizCode === 401
        return { parsed, unauthorized, http }
      }
      const doUpload = () => {
        const token = getAccessToken()
        const headers = {
          [HTTP_HEADERS.lang]: this.lang,
        }
        if (token) headers[HTTP_HEADERS.authorization] = `${AUTH.bearerPrefix}${token}`

        return new Promise((resolve, reject) => {
          uni.uploadFile({
            url,
            filePath,
            name: 'files[]',
            header: headers,
            success: (res) => {
              const { parsed, unauthorized } = parseUploadRes(res)
              if (unauthorized) {
                reject({ response: { ...res, statusCode: 401, data: parsed } })
                return
              }
              try {
                const payload = parsed && typeof parsed.data === 'string' ? JSON.parse(parsed.data) : parsed
                const files = (payload && payload.uploaded_files) || (payload && payload.data && payload.data.uploaded_files)
                if (Array.isArray(files) && files[0]) {
                  resolve(this.resolveUploadedUrl(files[0]))
                  return
                }
                const msg = (parsed && (parsed.msg || parsed.message)) || 'Upload failed'
                reject(new Error(msg))
              } catch (e) {
                reject(e)
              }
            },
            fail: (e) => reject(e),
          })
        })
      }

      return Promise.resolve()
        .then(() => (hasRefreshToken() ? ensureFreshAccessToken().catch(() => {}) : null))
        .then(() => doUpload())
        .catch(async (err) => {
        const code = err && err.response ? err.response.statusCode : 0
        if (code === 401 && hasRefreshToken()) {
          try {
            await refreshTokens()
            return await doUpload()
          } catch {}
        }
        if (code === 401) {
          clearSession()
          try {
            uni.showToast({ title: this.tt('message.auth.sessionExpired'), icon: 'none' })
          } catch {}
          safeReLaunch(PAGES.login).catch(() => {})
        }
        throw err
      })
    },
    getFileSize(filePath) {
      return new Promise((resolve) => {
        uni.getFileInfo({
          filePath,
          success: (res) => resolve(Number(res && res.size) || 0),
          fail: () => resolve(0),
        })
      })
    },
    getImageInfo(src) {
      return new Promise((resolve, reject) => {
        uni.getImageInfo({
          src,
          success: resolve,
          fail: reject,
        })
      })
    },
    compressImageOnce(src, quality, targetWidth, targetHeight) {
      return new Promise((resolve, reject) => {
        const opts = {
          src,
          quality,
          success: (res) => {
            const out = res && (res.tempFilePath || res.filePath || res.path)
            if (out) resolve(out)
            else reject(new Error('compressImage failed'))
          },
          fail: reject,
        }
        if (targetWidth && targetHeight) {
          opts.compressedWidth = targetWidth
          opts.compressedHeight = targetHeight
          opts.width = targetWidth
          opts.height = targetHeight
        }
        uni.compressImage(opts)
      })
    },
    async compressOneImage(filePath) {
      const cfg = this.imageCompress || {}
      if (!cfg.enabled) return filePath

      const maxSide = Number(cfg.maxSide) || 1600
      const targetKB = Number(cfg.targetKB) || 500
      const targetBytes = Math.max(1, Math.floor(targetKB * 1024))
      const qualitySteps = Array.isArray(cfg.qualitySteps) && cfg.qualitySteps.length ? cfg.qualitySteps : [80, 70, 60, 50, 45, 40]
      const maxAttempts = Math.max(1, Math.min(Number(cfg.maxAttempts) || qualitySteps.length, qualitySteps.length))

      const initialSize = await this.getFileSize(filePath)
      if (initialSize > 0 && initialSize <= targetBytes) return filePath

      let curPath = filePath

      try {
        const info = await this.getImageInfo(curPath)
        const w = Number(info && info.width) || 0
        const h = Number(info && info.height) || 0
        const curMax = Math.max(w, h)
        if (curMax > maxSide && w > 0 && h > 0) {
          const ratio = maxSide / curMax
          const tw = Math.max(1, Math.floor(w * ratio))
          const th = Math.max(1, Math.floor(h * ratio))
          try {
            curPath = await this.compressImageOnce(curPath, 100, tw, th)
          } catch {
            curPath = await this.compressImageOnce(curPath, 100)
          }
        }
      } catch {
      }

      for (let i = 0; i < maxAttempts; i += 1) {
        const q = Number(qualitySteps[i]) || 60
        try {
          curPath = await this.compressImageOnce(curPath, q)
        } catch {
          continue
        }
        const sz = await this.getFileSize(curPath)
        if (sz > 0 && sz <= targetBytes) return curPath
      }

      return curPath
    },
    async compressBeforeUpload(paths) {
      const list = Array.isArray(paths) ? paths.filter(Boolean) : []
      if (!list.length) return []
      if (!this.imageCompress || !this.imageCompress.enabled) return list

      const out = []
      for (const p of list) {
        try {
          const cp = await this.compressOneImage(p)
          out.push(cp || p)
        } catch {
          out.push(p)
        }
      }
      return out
    },
    async chooseAndUploadToStep(stepIdx) {
      if (this.uploading) return
      const i = Math.min(Math.max(Number(stepIdx) || 0, 0), this.steps.length - 1)
      const step = this.steps[i]
      if (!step) return
      const existing = (step.photoUrls || []).filter(Boolean)
      const remaining = PREFLIGHT_MAX_PHOTOS_PER_ITEM - existing.length
      if (remaining <= 0) {
        uni.showToast({ title: this.tt('message.preflight.photoLimitReached'), icon: 'none' })
        return
      }
      try {
        const { tempFilePaths } = await new Promise((resolve, reject) => {
          uni.chooseImage({
            count: remaining,
            sizeType: ['compressed'],
            sourceType: ['camera'],
            success: resolve,
            fail: reject,
          })
        })
        const paths = (Array.isArray(tempFilePaths) ? tempFilePaths : []).slice(0, remaining)
        if (!paths.length) return
        this.uploading = true
        uni.showLoading({ title: this.tt('message.preflight.uploading'), mask: true })
        const compressedPaths = await this.compressBeforeUpload(paths)
        const uploaded = []
        if (this.mockUpload) {
          for (const p of compressedPaths) uploaded.push(p)
        } else {
          for (const p of compressedPaths) {
            const serverPath = await this.uploadOne(p)
            const url = this.resolveUploadedUrl(serverPath)
            if (url) uploaded.push(url)
          }
        }
        const nextSteps = this.steps.slice()
        nextSteps.splice(i, 1, {
          ...step,
          photoUrls: existing.concat(uploaded).slice(0, PREFLIGHT_MAX_PHOTOS_PER_ITEM),
        })
        this.steps = nextSteps
      } catch {
      } finally {
        this.uploading = false
        uni.hideLoading()
      }
    },
    doSubmitPreflight() {
      if (this.submittingCheck) {
        uni.showToast({ title: this.tt('message.preflight.uploading'), icon: 'none' })
        return
      }
      if (!this.flowCompleted) {
        uni.showToast({ title: this.tt('message.preflight.completeToSubmit'), icon: 'none' })
        return
      }
      if (!this.selectedDroneId) {
        uni.showToast({ title: this.tt('message.preflight.noDrones'), icon: 'none' })
        return
      }
      const payload = {
        scope: 'ground_daily',
        drone_id: this.selectedDroneId || '',
        summary_note: this.draft.note || '',
        items: this.steps.map((s) => ({
          item_key: s.key,
          ok: Boolean(s.ok),
          note: s.note || '',
          photo_urls: (s.photoUrls || []).filter(Boolean),
        })),
      }

      const fingerprint = JSON.stringify(payload)
      if (this.hasSubmittedCurrent && this.lastSubmitFingerprint === fingerprint) {
        uni.showToast({ title: this.tt('message.preflight.uploaded'), icon: 'none' })
        return
      }

      this.submittingCheck = true
      this.lastSubmitFingerprint = fingerprint
      this.uploading = true
      uni.showLoading({ title: this.tt('message.preflight.uploading'), mask: true })
      requestPost(API.preflight.createCheck, payload, { dedup: false })
        .then(() => {
          this.hasSubmittedCurrent = true
          uni.showToast({ title: this.tt('message.preflight.uploaded'), icon: 'none' })
          this.clearDraft(this.selectedDroneId)
          safeSwitchTab(PAGES.check).catch(() => {})
        })
        .catch((err) => {
          let message = ''
          try {
            const resp = err && err.response ? err.response : null
            const data = resp && resp.data !== undefined ? resp.data : null
            if (data && typeof data === 'object') {
              message =
                String(data.message || data.msg || data.error || data.detail || data.errMsg || '').trim() ||
                JSON.stringify(data)
            } else if (typeof data === 'string') {
              message = String(data).trim()
            }
            if (!message) message = String((err && err.errMsg) || '').trim()
          } catch {
            message = ''
          }
          if (!message) message = this.tt('message.pub.error.network')
          const photoMatch = String(message || '').match(/photo\s+required\s+for\s+([A-Za-z0-9_]+)/i)
          if (photoMatch && photoMatch[1]) {
            const key = String(photoMatch[1] || '').trim()
            const meta = this.steps.find((s) => s.key === key) || this.stepMetas.find((s) => s.key === key)
            const label = meta && meta.labelKey ? this.tt(meta.labelKey) : key
            message = `${label}：${this.tt('message.preflight.photoRequired')}`
          } else if (/photo\s+required/i.test(String(message || ''))) {
            message = this.tt('message.preflight.photoRequired')
          }
          uni.showModal({
            title: this.tt('label.pub.confirm.title'),
            content: message,
            showCancel: false,
            confirmText: this.tt('label.pub.btn.confirm'),
          })
        })
        .finally(() => {
          this.submittingCheck = false
          this.uploading = false
          uni.hideLoading()
        })
    },
    submitPreflight() {
      uni.showModal({
        title: this.tt('label.pub.confirm.title'),
        content: this.tt('message.preflight.submitConfirm'),
        confirmText: this.tt('label.pub.btn.confirm'),
        cancelText: this.tt('label.pub.btn.cancel'),
        success: (res) => {
          if (!res.confirm) return
          this.doSubmitPreflight()
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

.edge-guard {
  position: fixed;
  bottom: 0;
  width: 48px;
  z-index: 300;
  background-color: transparent;
}

.edge-guard-left {
  left: 0;
}

.edge-guard-right {
  right: 0;
}

.head {
  background-color: #fff;
  border-bottom-width: 1rpx;
  border-bottom-style: solid;
  border-bottom-color: #f0f0f0;
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
  flex: 1;
  text-align: center;
  font-size: 34rpx;
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
  padding: 24rpx 24rpx calc(24rpx + 160rpx + env(safe-area-inset-bottom));
  box-sizing: border-box;
}

.card {
  background-color: #fff;
  border-radius: 16rpx;
  padding: 24rpx;
}

.flow {
  border-radius: 12rpx;
  background-color: #f7f7f7;
  padding: 16rpx;
}

.flow-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12rpx;
}

.flow-nav {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.flow-progress-wrap {
  display: flex;
  flex-direction: column;
  gap: 4rpx;
}

.flow-progress {
  font-size: 26rpx;
  color: #333;
}

.flow-drone {
  font-size: 22rpx;
  color: #666;
}

.flow-drone-wrap {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.flow-drone-change {
  font-size: 22rpx;
  color: #1677ff;
}

.flow-body {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.drone-select {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.drone-search-wrap {
  position: relative;
}

.drone-search {
  width: 100%;
  height: 72rpx;
  background-color: #f7f7f7;
  border-radius: 12rpx;
  padding: 0 72rpx 0 20rpx;
  font-size: 26rpx;
  color: #333;
}

.drone-search-clear {
  position: absolute;
  right: 18rpx;
  top: 50%;
  transform: translateY(-50%);
  width: 44rpx;
  height: 44rpx;
  line-height: 44rpx;
  text-align: center;
  border-radius: 22rpx;
  background-color: #e8e8e8;
  color: #666;
  font-size: 30rpx;
}

.drone-list {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.drone-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16rpx;
  border-radius: 12rpx;
  background-color: #fff;
  border-width: 2rpx;
  border-style: solid;
  border-color: transparent;
}

.drone-item.active {
  border-color: #1677ff;
  background-color: rgba(22, 119, 255, 0.06);
}

.drone-item-left {
  display: flex;
  flex-direction: column;
  gap: 6rpx;
}

.drone-name {
  font-size: 28rpx;
  color: #333;
  font-weight: 600;
}

.drone-sub {
  font-size: 22rpx;
  color: #666;
}

.drone-check {
  font-size: 30rpx;
  color: #1677ff;
  width: 40rpx;
  text-align: right;
}

.flow-item {
  font-size: 28rpx;
  color: #333;
  font-weight: 600;
  line-height: 40rpx;
}

.flow-desc {
  font-size: 24rpx;
  color: #666;
  line-height: 36rpx;
  white-space: pre-wrap;
}

.step-top {
  display: flex;
  align-items: flex-start;
  gap: 12rpx;
}

.step-text {
  flex: 1;
  min-width: 0;
}

.step-demo {
  width: 220rpx;
  height: 220rpx;
  border-radius: 12rpx;
  overflow: hidden;
  background-color: #fff;
  border: 1px solid #f0f0f0;
  flex-shrink: 0;
}

.step-demo-img {
  width: 100%;
  height: 100%;
}

.flow-actions {
  display: flex;
  gap: 12rpx;
}

.step-bottom-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 16rpx 24rpx calc(16rpx + env(safe-area-inset-bottom));
  background-color: rgba(255, 255, 255, 0.98);
  border-top: 1px solid #eee;
  z-index: 30;
}

.btn-ok {
  flex: 1;
  height: 84rpx;
  font-size: 30rpx;
  line-height: 84rpx;
  background-color: #52c41a;
  color: #fff;
}

.btn-danger {
  flex: 1;
  height: 84rpx;
  font-size: 30rpx;
  line-height: 84rpx;
  background-color: #ff4d4f;
  color: #fff;
}

.history {
  display: flex;
  flex-direction: column;
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

.detail-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12rpx;
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
  gap: 12rpx;
  margin-top: 12rpx;
}

.detail-photo {
  width: 150rpx;
  height: 150rpx;
  border-radius: 12rpx;
  background-color: #f2f2f2;
}

.delete-wrap {
  margin-top: 40rpx;
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

.flow-summary {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.summary-title {
  font-size: 26rpx;
  color: #333;
}

.summary-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12rpx;
  border-radius: 12rpx;
  background-color: #fff;
}

.summary-label {
  font-size: 26rpx;
  color: #333;
  flex: 1;
  margin-right: 12rpx;
}

.summary-right {
  display: flex;
  align-items: center;
  gap: 10rpx;
}

.summary-count {
  font-size: 24rpx;
  color: #666;
}

.summary-status {
  font-size: 24rpx;
  padding: 4rpx 10rpx;
  border-radius: 999rpx;
  background-color: #f5f5f5;
  color: #666;
}

.summary-status.ok {
  background-color: rgba(82, 196, 26, 0.15);
  color: #389e0d;
}

.summary-status.bad {
  background-color: rgba(255, 77, 79, 0.15);
  color: #cf1322;
}

.photos {
  margin-top: 16rpx;
}

.photos-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12rpx;
  margin-bottom: 12rpx;
}

.photos-title {
  font-size: 26rpx;
  color: #333;
  flex: 1;
  min-width: 0;
}

.upload-btn {
  height: 72rpx;
  padding: 0 56rpx;
  border-radius: 12rpx;
  background-color: #1677ff;
  color: #fff;
  font-size: 28rpx;
  line-height: 72rpx;
}

.photos-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  margin-bottom: 12rpx;
}

.item-note {
  margin-top: 16rpx;
}

.item-note-title {
  font-size: 26rpx;
  color: #333;
  margin-bottom: 12rpx;
}

.item-note-input {
  width: 100%;
  min-height: 100rpx;
  padding: 16rpx;
  background-color: #fff;
  border-radius: 12rpx;
  font-size: 26rpx;
  color: #333;
}

.photo-item {
  width: 150rpx;
  height: 150rpx;
  position: relative;
  border-radius: 12rpx;
  overflow: hidden;
  background-color: #f2f2f2;
}

.photo {
  width: 150rpx;
  height: 150rpx;
}

.photo-remove {
  position: absolute;
  right: 6rpx;
  top: 6rpx;
  width: 36rpx;
  height: 36rpx;
  border-radius: 18rpx;
  background-color: rgba(0, 0, 0, 0.55);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 26rpx;
}

.note {
  margin-top: 16rpx;
}

.note-title {
  font-size: 26rpx;
  color: #333;
  margin-bottom: 12rpx;
}

.note-input {
  width: 100%;
  min-height: 120rpx;
  padding: 16rpx;
  background-color: #f7f7f7;
  border-radius: 12rpx;
  font-size: 26rpx;
  color: #333;
}

.btn {
  margin-top: 8rpx;
}

.btn-prev {
  margin-bottom: 12rpx;
}

.btn-next {
  margin-bottom: 12rpx;
}

.summary-actions {
  margin-top: 16rpx;
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.btn-draft {
  margin-top: 0;
  background-color: #fff;
  color: #1677ff;
  border: 1px solid #1677ff;
}

.btn-primary {
  margin-top: 0;
  background-color: #1677ff;
  color: #fff;
}
</style>
