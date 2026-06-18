export type SupportedMobilePlatform = 'android' | 'ios' | 'unknown'

export interface MobilePlatformAdapter {
  platform: SupportedMobilePlatform
  isTouchDevice: boolean
}

export const detectMobilePlatform = (): MobilePlatformAdapter => {
  if (typeof navigator === 'undefined') {
    return {
      platform: 'unknown',
      isTouchDevice: false,
    }
  }

  const userAgent = navigator.userAgent.toLowerCase()
  const isAndroid = userAgent.includes('android')
  const isIOS = /iphone|ipad|ipod/.test(userAgent)

  return {
    platform: isAndroid ? 'android' : isIOS ? 'ios' : 'unknown',
    isTouchDevice: 'ontouchstart' in window,
  }
}
