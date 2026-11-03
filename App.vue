<script>
	import { getLang, onLangChange, setLang, t } from '@/common/i18n'
	import { PAGES, STORAGE_KEYS } from '@/common/constants'
	import { getAccessToken, hasRefreshToken, ensureFreshAccessToken, clearSession } from '@/common/session'
	import { safeReLaunch, safeSwitchTab } from '@/common/navigation'

	const TAB_ROUTES = [PAGES.home, PAGES.check, PAGES.settings]

	const currentRoutePath = () => {
		try {
			const pages = getCurrentPages()
			const current = pages && pages.length ? pages[pages.length - 1] : null
			return current && current.route ? `/${current.route}` : ''
		} catch {
			return ''
		}
	}

	const applyTabBarTexts = () => {
		const route = currentRoutePath()
		if (!TAB_ROUTES.includes(route)) return
		try {
			uni.setTabBarItem({ index: 0, text: t('tab.home') })
			uni.setTabBarItem({ index: 1, text: t('tab.check') })
			uni.setTabBarItem({ index: 2, text: t('tab.settings') })
		} catch {}
	}

	let offTabLang = null

	export default {
		onLaunch: function() {
			const stored = uni.getStorageSync(STORAGE_KEYS.lang)
			if (!stored) {
				setLang(getLang())
			}
			if (!offTabLang) offTabLang = onLangChange(() => applyTabBarTexts())
		},
		onShow: function() {
			const route = currentRoutePath()
			applyTabBarTexts()
			const hasTokens = Boolean(getAccessToken()) && hasRefreshToken()
			if (!hasTokens && route !== PAGES.login) {
				safeReLaunch(PAGES.login).catch(() => {})
				return
			}
			if (!hasTokens && route === PAGES.login) return
			ensureFreshAccessToken()
				.then(() => {
					if (currentRoutePath() === PAGES.login) {
						safeSwitchTab(PAGES.home).catch(() => {})
					}
				})
				.catch(() => {
					clearSession()
					if (currentRoutePath() !== PAGES.login) {
						safeReLaunch(PAGES.login).catch(() => {})
					}
				})
		},
		onHide: function() {
		}
	}
</script>

<style>
	/*每个页面公共css */
</style>
