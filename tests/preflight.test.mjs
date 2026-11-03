import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  PREFLIGHT_STEP_METAS,
  createPreflightSteps,
  restorePreflightSteps,
  restorePreflightDraft,
  buildPreflightItems,
} from '../common/preflight.js'

const legacyKeys = [
  'airframeOk', 'contactsOk', 'motorOk', 'propellerOk', 'upperCoverOk',
  'antennaOk', 'landingCameraOk', 'aerialCameraOk', 'lidarOk', 'parachuteOk',
  'winchOk', 'batteryOk', 'routerOk', 'remoteServerOk', 'dockOk', 'rtkOk', 'remoteServerM2MOk',
]
const mergedStep = (steps) => steps.find((step) => step.key === 'motorPropellerOk')

// 当前项目未安装 Vue 构建依赖，通过服务桩隔离网络与导航，执行页面实际方法。
// 覆盖 16 项提交、旧草稿合并、步骤位置恢复以及历史详情展示。
function loadPage(relativePath, bindings) {
  const source = readFileSync(new URL(relativePath, import.meta.url), 'utf8')
  const script = source.match(/<script>([\s\S]*?)<\/script>/)[1]
    .replace(/^import .*$/gm, '')
    .replace('export default', 'return')
  return new Function(...Object.keys(bindings), script)(...Object.values(bindings))
}

test('the displayed list has 16 steps, a merged third step, and battery before winch', () => {
  const steps = createPreflightSteps()
  assert.deepEqual(steps.map((step) => step.key), [
    'airframeOk', 'contactsOk', 'motorPropellerOk', 'upperCoverOk', 'antennaOk',
    'landingCameraOk', 'aerialCameraOk', 'lidarOk', 'parachuteOk', 'batteryOk',
    'winchOk', 'routerOk', 'remoteServerOk', 'dockOk', 'rtkOk', 'remoteServerM2MOk',
  ])
  assert.equal(steps.filter((step) => step.photoRequired).length, 10)
  steps[2].photoUrls.push('/photo.jpg')
  assert.deepEqual(createPreflightSteps()[2].photoUrls, [])
})

test('legacy results are combined conservatively, retaining both notes and unique photos', () => {
  const sources = [
    { key: 'motorOk', ok: true, note: 'Motor note', photoUrls: ['/motor.jpg', '/shared.jpg'] },
    { key: 'propellerOk', ok: false, note: 'Propeller note', photoUrls: ['/propeller.jpg', '/shared.jpg'] },
  ]
  const result = mergedStep(restorePreflightSteps(sources))
  assert.equal(result.ok, false)
  assert.equal(result.note, 'Motor note\nPropeller note')
  assert.deepEqual(result.photoUrls, ['/motor.jpg', '/shared.jpg', '/propeller.jpg'])
  sources[1].ok = true
  assert.equal(mergedStep(restorePreflightSteps(sources)).ok, true)
  sources[1].ok = null
  assert.equal(mergedStep(restorePreflightSteps(sources)).ok, null)
  assert.equal(mergedStep(restorePreflightSteps(sources.slice(0, 1))).ok, null)
})

test('legacy draft cursors follow the original item after merging and reordering', () => {
  const steps = legacyKeys.map((key) => ({ key, ok: true, note: '', photoUrls: [] }))
  for (let i = 0; i < steps.length; i += 1) {
    const result = restorePreflightDraft({ v: 1, steps, currentStepIndex: i })
    const expected = ['motorOk', 'propellerOk'].includes(steps[i].key) ? 'motorPropellerOk' : steps[i].key
    assert.equal(result.steps[result.currentStepIndex].key, expected)
  }
})

test('merging and saving old drafts does not discard photos over the new per-step limit', () => {
  const motorPhotos = Array.from({ length: 10 }, (_, i) => `/motor-${i}.jpg`)
  const propellerPhotos = Array.from({ length: 10 }, (_, i) => `/propeller-${i}.jpg`)
  const restored = restorePreflightDraft({
    v: 1,
    currentStepIndex: 1,
    flowView: 'summary',
    draft: { note: 'Summary' },
    steps: [
      { key: 'motorOk', ok: true, photoUrls: motorPhotos },
      { key: 'propellerOk', ok: true, photoUrls: propellerPhotos },
    ],
  })
  assert.deepEqual(mergedStep(restored.steps).photoUrls, [...motorPhotos, ...propellerPhotos])
  const savedAgain = restorePreflightDraft({ v: 2, ...restored })
  assert.deepEqual(mergedStep(savedAgain.steps).photoUrls, [...motorPhotos, ...propellerPhotos])
  assert.equal(savedAgain.steps[savedAgain.currentStepIndex].key, 'motorPropellerOk')
  assert.equal(savedAgain.flowView, 'summary')
  assert.equal(savedAgain.draft.note, 'Summary')
})

test('submission sends one merged API item with the combined result, note and photos', () => {
  const steps = createPreflightSteps()
  Object.assign(mergedStep(steps), { ok: false, note: 'Combined note', photoUrls: ['/combined.jpg'] })
  const items = buildPreflightItems(steps)
  assert.equal(items.length, 16)
  assert.ok(!items.some((item) => ['motorOk', 'propellerOk'].includes(item.item_key)))
  assert.deepEqual(items.find((item) => item.item_key === 'motorPropellerOk'), {
    item_key: 'motorPropellerOk', ok: false, note: 'Combined note', photo_urls: ['/combined.jpg'],
  })
  assert.ok(items.findIndex((item) => item.item_key === 'batteryOk') < items.findIndex((item) => item.item_key === 'winchOk'))
  const roundTrip = mergedStep(restorePreflightSteps(items))
  assert.equal(roundTrip.note, 'Combined note')
  assert.deepEqual(roundTrip.photoUrls, ['/combined.jpg'])
})

test('both languages provide the merged title and all original motor/propeller instructions', () => {
  for (const lang of ['en', 'zh']) {
    const pack = JSON.parse(readFileSync(new URL(`../common/lang/${lang}.json`, import.meta.url), 'utf8'))
    for (const step of PREFLIGHT_STEP_METAS) {
      assert.ok(pack[step.labelKey])
      assert.ok(pack[step.descKey])
    }
    const mergedDescription = pack['label.preflight.itemDesc.motorPropeller']
    for (const name of ['motor', 'propeller']) {
      for (const line of pack[`label.preflight.itemDesc.${name}`].split('\n')) {
        assert.ok(mergedDescription.includes(line), `${lang}: missing ${line}`)
      }
    }
  }
})

test('the check page uses the shared list and submits the new 16-item payload', async () => {
  let submitted
  const options = loadPage('../pages/check/check.vue', {
    getLang: () => 'zh',
    PREFLIGHT_STEP_METAS, createPreflightSteps, restorePreflightDraft, buildPreflightItems,
    PREFLIGHT_MAX_PHOTOS_PER_ITEM: 10,
    API: { preflight: { createCheck: '/checks' } },
    PAGES: { check: '/history' },
    uni: { showLoading() {}, hideLoading() {}, showToast() {} },
    requestPost: async (_url, payload) => { submitted = payload },
    safeSwitchTab: async () => {},
  })
  const page = { ...options.data(), ...options.methods, tt: (key) => key, clearDraft() {} }
  page.selectedDroneId = '6003'
  page.steps.forEach((step) => { step.ok = true; step.photoUrls = ['/test.jpg'] })
  page.flowCompleted = options.computed.flowCompleted.call(page)
  assert.equal(page.steps.length, 16)
  page.doSubmitPreflight()
  await new Promise((resolve) => setImmediate(resolve))
  assert.equal(submitted.drone_id, '6003')
  assert.equal(submitted.items.length, 16)
  assert.equal(page.hasSubmittedCurrent, true)
})

test('history renders one merged failure, both notes and unique photos from old records', async () => {
  const options = loadPage('../pages/preflightHistoryDetail/preflightHistoryDetail.vue', {
    getLang: () => 'zh',
    PREFLIGHT_STEP_METAS, restorePreflightSteps,
    API: { preflight: { getCheckById: (id) => `/checks/${id}` } },
    getApiBaseUrl: () => 'https://example.invalid',
    requestGet: async () => ({ data: {
      passed: false,
      items: [
        { item_key: 'motorOk', ok: true, note: 'Motor note', photo_urls: ['/motor.jpg', '/shared.jpg'] },
        { item_key: 'propellerOk', ok: false, note: 'Propeller note', photo_urls: ['/propeller.jpg', '/shared.jpg'] },
      ],
    } }),
  })
  const page = { ...options.data(), ...options.methods, id: '123' }
  await page.loadDetail()
  assert.equal(page.stepMetas.length, 16)
  assert.equal(page.resolveOk('motorPropellerOk'), false)
  assert.equal(page.resolveNote('motorPropellerOk'), 'Motor note\nPropeller note')
  assert.equal(page.detail.photoUrls.length, 3)
  assert.equal(page.stepMetas[9].key, 'batteryOk')
  assert.equal(page.stepMetas[10].key, 'winchOk')
})
