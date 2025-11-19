/**
 * Open OAuth authorization page in a popup window (like Chrome extension)
 * @param serviceId The OAuth service ID
 * @returns The opened window reference
 */
export function openOAuthWindow(serviceId: string): Window | null {
  const width = 480
  const height = 600
  const screenWidth = window.screen.availWidth
  const screenHeight = window.screen.availHeight
  
  // Calculate position for top-right corner
  const left = screenWidth - width - 20 // 20px margin from right edge
  const top = 20 // 20px margin from top
  
  // Build the URL
  const url = `/bowheadwhale/doauth_page_new_window?service=${encodeURIComponent(serviceId)}`
  
  // Open popup window with specific features
  const popup = window.open(
    url,
    'oauth_popup',
    `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes,status=no,toolbar=no,menubar=no,location=no`
  )
  
  // Focus the popup window
  if (popup) {
    popup.focus()
  }
  
  return popup
}

/**
 * Open OAuth authorization page in a popup window with callback
 * @param serviceId The OAuth service ID
 * @param onClose Callback function when window is closed
 * @returns The opened window reference
 */
export function openOAuthWindowWithCallback(
  serviceId: string,
  onClose?: () => void
): Window | null {
  const popup = openOAuthWindow(serviceId)
  
  if (popup && onClose) {
    // Poll to check if window is closed
    const checkClosed = setInterval(() => {
      if (popup.closed) {
        clearInterval(checkClosed)
        onClose()
      }
    }, 500)
  }
  
  return popup
}

