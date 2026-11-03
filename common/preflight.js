import { PREFLIGHT_MAX_PHOTOS_PER_ITEM } from './constants.js'

// legacyKeys 仅用于识别旧记录和草稿，新提交统一使用当前检查项 key。
function defineStep(key, name, photoRequired = true, legacyKeys = [key]) {
  return {
    key,
    labelKey: `label.preflight.item.${name}`,
    descKey: `label.preflight.itemDesc.${name}`,
    photoRequired,
    legacyKeys,
  }
}

// 与 A2ZDispatch 的 16 项模板保持一致：电机和桨叶合并，电池排在绞盘之前。
export const PREFLIGHT_STEP_METAS = [
  defineStep('airframeOk', 'airframe'),
  defineStep('contactsOk', 'contacts'),
  defineStep('motorPropellerOk', 'motorPropeller', true, ['motorOk', 'propellerOk']),
  defineStep('upperCoverOk', 'upperCover'),
  defineStep('antennaOk', 'antenna'),
  defineStep('landingCameraOk', 'landingCamera'),
  defineStep('aerialCameraOk', 'aerialCamera'),
  defineStep('lidarOk', 'lidar'),
  defineStep('parachuteOk', 'parachute', false),
  defineStep('batteryOk', 'battery'),
  defineStep('winchOk', 'winch'),
  defineStep('routerOk', 'router', false),
  defineStep('remoteServerOk', 'remoteServer', false),
  defineStep('dockOk', 'dockPosition', false),
  defineStep('rtkOk', 'rtk', false),
  defineStep('remoteServerM2MOk', 'remoteServerM2M', false),
]

// 每次创建独立的检查状态，避免不同页面或检查任务共享可变数组。
export function createPreflightSteps() {
  return PREFLIGHT_STEP_METAS.map((meta) => ({
    ...meta,
    legacyKeys: meta.legacyKeys.slice(),
    ok: null,
    note: '',
    photoUrls: [],
  }))
}

// 同时兼容 App 草稿的 key/photoUrls 和后端历史的 item_key/photo_urls。
export function restorePreflightSteps(savedSteps) {
  const byKey = new Map()
  for (const item of Array.isArray(savedSteps) ? savedSteps : []) {
    if (!item) continue
    const key = String(item.key || item.item_key || '').trim()
    if (key) byKey.set(key, item)
  }
  return createPreflightSteps().map((step) => {
    // 优先读取新版合并项；只有新版字段不存在时，才从旧电机、桨叶两项恢复。
    const direct = byKey.get(step.key)
    const sources = direct ? [direct] : step.legacyKeys.map((key) => byKey.get(key)).filter(Boolean)
    if (!sources.length) return step

    // 任一旧项不通过则合并为不通过；两项都明确通过才通过，否则保持未完成。
    const complete = Boolean(direct) || sources.length === step.legacyKeys.length
    const ok = sources.some((item) => item.ok === false)
      ? false
      : complete && sources.every((item) => item.ok === true) ? true : null
    // 备注和照片分别去重，保留旧两项的有效内容，避免重复显示同一份资料。
    const notes = [...new Set(sources.map((item) => String(item.note || '').trim()).filter(Boolean))]
    const photos = [...new Set(sources.flatMap((item) => {
      const urls = item.photoUrls || item.photo_urls
      return Array.isArray(urls) ? urls.filter(Boolean) : []
    }))]
    return {
      ...step,
      ok,
      note: notes.join('\n'),
      // 旧两项可能各有 10 张照片，恢复时全部保留，避免静默丢图。
      // 新增仍受页面上限约束；超过新接口上限时，需由用户删减后再提交。
      photoUrls: step.legacyKeys.length > 1 ? photos : photos.slice(0, PREFLIGHT_MAX_PHOTOS_PER_ITEM),
    }
  })
}

export function restorePreflightDraft(payload) {
  const savedSteps = Array.isArray(payload.steps) ? payload.steps : []
  const steps = restorePreflightSteps(savedSteps)
  const index = Math.min(Math.max(Math.trunc(Number(payload.currentStepIndex)) || 0, 0), Math.max(savedSteps.length - 1, 0))
  // 按原检查项 key 定位步骤，避免合并一项、交换电池/绞盘后直接沿用旧下标。
  const savedKey = savedSteps[index] && savedSteps[index].key
  const mappedIndex = steps.findIndex((step) => step.key === savedKey || step.legacyKeys.includes(savedKey))
  return {
    steps,
    currentStepIndex: mappedIndex >= 0 ? mappedIndex : Math.min(index, steps.length - 1),
    flowView: payload.flowView === 'summary' ? 'summary' : 'steps',
    draft: { note: String((payload.draft && payload.draft.note) || '') },
  }
}

// 新提交只生成 16 项，旧版 17 项请求的兼容转换由 A2ZDispatch 后端负责。
export function buildPreflightItems(steps) {
  return steps.map((step) => ({
    item_key: step.key,
    ok: Boolean(step.ok),
    note: step.note || '',
    photo_urls: (step.photoUrls || []).filter(Boolean),
  }))
}
