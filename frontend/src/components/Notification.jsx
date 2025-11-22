import { useEffect } from 'react'
import useUIStore from '../stores/useUIStore'

export default function Notification() {
  const { notification, hideNotification } = useUIStore()

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => {
        hideNotification()
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [notification, hideNotification])

  if (!notification) return null

  const getIcon = () => {
    switch(notification.type) {
      case 'success': return '✅'
      case 'error': return '❌'
      case 'warning': return '⚠️'
      case 'info': return 'ℹ️'
      default: return '📢'
    }
  }

  const getClassName = () => {
    return `notification notification-${notification.type}`
  }

  return (
    <div className={getClassName()}>
      <span className="notification-icon">{getIcon()}</span>
      <span className="notification-message">{notification.message}</span>
      <button 
        className="notification-close"
        onClick={hideNotification}
      >
        ✕
      </button>
    </div>
  )
}