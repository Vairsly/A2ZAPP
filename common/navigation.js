let switchingTab = false
let relaunching = false
let navigating = false
let switchOwner = null
let relaunchOwner = null
let navigateOwner = null
let navGuardUntil = 0

function currentRoutePath() {
  try {
    const pages = getCurrentPages()
    const current = pages && pages.length ? pages[pages.length - 1] : null
    const route = current && current.route ? `/${current.route}` : ''
    return route
  } catch {
    return ''
  }
}

function urlPathOnly(url) {
  const s = String(url || '').trim()
  if (!s) return ''
  const idx = s.indexOf('?')
  return idx >= 0 ? s.slice(0, idx) : s
}

export function safeSwitchTab(url, { retries = 2, retryDelay = 120 } = {}) {
  return new Promise((resolve, reject) => {
    if (!url) {
      reject(new Error('switchTab url required'))
      return
    }

    if (currentRoutePath() === url) {
      resolve({ sameRoute: true })
      return
    }

    const owner = Symbol('switchTab')
    const run = (leftRetries) => {
      if (switchingTab && switchOwner !== owner) {
        if (leftRetries > 0) {
          setTimeout(() => run(leftRetries - 1), retryDelay)
          return
        }
        reject(new Error(`switchTab busy: ${url}`))
        return
      }

      switchingTab = true
      switchOwner = owner
      navGuardUntil = Date.now() + 450
      uni.switchTab({
        url,
        success: (res) => {
          switchingTab = false
          switchOwner = null
          resolve(res)
        },
        fail: (err) => {
          const msg = String((err && err.errMsg) || '')
          if ((msg.includes('locked') || msg.includes('do not operate continuously')) && leftRetries > 0) {
            setTimeout(() => run(leftRetries - 1), retryDelay)
            return
          }
          switchingTab = false
          switchOwner = null
          reject(err)
        },
      })
    }

    run(retries)
  })
}

export function isNavGuardActive() {
  return Date.now() < navGuardUntil
}

export function safeNavigateTo(url, { retries = 2, retryDelay = 120 } = {}) {
  return new Promise((resolve, reject) => {
    if (!url) {
      reject(new Error('navigateTo url required'))
      return
    }

    const current = currentRoutePath()
    if (current && urlPathOnly(url) === current) {
      resolve({ sameRoute: true })
      return
    }

    const owner = Symbol('navigateTo')
    const run = (leftRetries) => {
      if (Date.now() < navGuardUntil) {
        if (leftRetries > 0) {
          setTimeout(() => run(leftRetries - 1), retryDelay)
          return
        }
        reject(new Error(`navigateTo guard active: ${url}`))
        return
      }

      if (navigating && navigateOwner !== owner) {
        if (leftRetries > 0) {
          setTimeout(() => run(leftRetries - 1), retryDelay)
          return
        }
        reject(new Error(`navigateTo busy: ${url}`))
        return
      }

      navigating = true
      navigateOwner = owner
      navGuardUntil = Date.now() + 450
      uni.navigateTo({
        url,
        success: (res) => {
          navigating = false
          navigateOwner = null
          resolve(res)
        },
        fail: (err) => {
          const msg = String((err && err.errMsg) || '')
          if ((msg.includes('locked') || msg.includes('do not operate continuously')) && leftRetries > 0) {
            setTimeout(() => run(leftRetries - 1), retryDelay)
            return
          }
          navigating = false
          navigateOwner = null
          reject(err)
        },
      })
    }

    run(retries)
  })
}

export function safeReLaunch(url, { retries = 2, retryDelay = 150 } = {}) {
  return new Promise((resolve, reject) => {
    if (!url) {
      reject(new Error('reLaunch url required'))
      return
    }

    if (currentRoutePath() === url) {
      resolve({ sameRoute: true })
      return
    }

    const owner = Symbol('reLaunch')
    const run = (leftRetries) => {
      if (relaunching && relaunchOwner !== owner) {
        if (leftRetries > 0) {
          setTimeout(() => run(leftRetries - 1), retryDelay)
          return
        }
        reject(new Error(`reLaunch busy: ${url}`))
        return
      }

      relaunching = true
      relaunchOwner = owner
      uni.reLaunch({
        url,
        success: (res) => {
          relaunching = false
          relaunchOwner = null
          resolve(res)
        },
        fail: (err) => {
          const msg = String((err && err.errMsg) || '')
          if ((msg.includes('locked') || msg.includes('do not operate continuously')) && leftRetries > 0) {
            setTimeout(() => run(leftRetries - 1), retryDelay)
            return
          }
          relaunching = false
          relaunchOwner = null
          reject(err)
        },
      })
    }

    run(retries)
  })
}
