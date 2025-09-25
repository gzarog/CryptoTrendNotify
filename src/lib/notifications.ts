export type AppNotificationPayload = {
  title: string
  body: string
  tag?: string
  icon?: string
  data?: NotificationOptions['data']
}

export function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!isNotificationSupported()) {
    return 'denied'
  }

  if (Notification.permission !== 'default') {
    return Notification.permission
  }

  try {
    return await Notification.requestPermission()
  } catch (error) {
    console.error('Failed to request notification permission', error)
    return Notification.permission
  }
}

export async function showAppNotification({
  title,
  body,
  tag,
  icon,
  data,
}: AppNotificationPayload): Promise<boolean> {
  if (!isNotificationSupported() || Notification.permission !== 'granted') {
    return false
  }

  const options: NotificationOptions = {
    body,
    tag,
    data,
    renotify: true,
    timestamp: Date.now(),
  }

  if (icon) {
    options.icon = icon
    options.badge = icon
  }

  try {
    const registration = await navigator.serviceWorker?.getRegistration()

    if (registration) {
      await registration.showNotification(title, options)
      return true
    }

    new Notification(title, options)
    return true
  } catch (error) {
    console.error('Failed to display notification', error)
    return false
  }
}
