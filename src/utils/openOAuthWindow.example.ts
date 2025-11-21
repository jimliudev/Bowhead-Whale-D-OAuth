/**
 * Example usage of openOAuthWindow function
 * 
 * This file shows how to use the openOAuthWindow utility to open
 * the OAuth authorization page in a popup window (like Chrome extension)
 */

import { openOAuthWindow, openOAuthWindowWithCallback } from './openOAuthWindow'

// Example 1: Simple usage
export function example1() {
  const serviceId = '0x3f58a419f88a0b054daebff43c2a759a7a390a6f749cfc991793134cf6a89e21'
  const popup = openOAuthWindow(serviceId)
  
  if (popup) {
    console.log('Popup window opened:', popup)
  } else {
    console.error('Failed to open popup window (might be blocked by browser)')
  }
}

// Example 2: With callback when window closes
export function example2() {
  const serviceId = '0x3f58a419f88a0b054daebff43c2a759a7a390a6f749cfc991793134cf6a89e21'
  
  const popup = openOAuthWindowWithCallback(serviceId, () => {
    console.log('OAuth popup window was closed')
    // Do something when window closes, e.g., refresh data, check authorization status, etc.
  })
  
  if (!popup) {
    alert('Popup window was blocked. Please allow popups for this site.')
  }
}

// Example 3: In a React component
// Note: This is a TypeScript example. In actual React component, use .tsx extension
export function ExampleComponent() {
  const handleOpenOAuth = () => {
    const serviceId = '0x3f58a419f88a0b054daebff43c2a759a7a390a6f749cfc991793134cf6a89e21'
    
    const popup = openOAuthWindowWithCallback(serviceId, () => {
      console.log('Authorization completed or cancelled')
      // Refresh user data or update UI
    })
    
    if (!popup) {
      alert('Please allow popups to open the authorization window')
    }
  }
  
  // In actual React component (.tsx), you would return JSX like:
  // return <button onClick={handleOpenOAuth}>Authorize Service</button>
  return null
}

// Example 4: In a button click handler
export function handleAuthorizeButtonClick(serviceId: string) {
  // This should be called from a user-initiated action (button click, etc.)
  // to avoid popup blockers
  
  const popup = openOAuthWindow(serviceId)
  
  if (!popup) {
    // Fallback: open in same window if popup is blocked
    window.location.href = `/bowheadwhale/doauth_page_new_window?service=${encodeURIComponent(serviceId)}`
    return
  }
  
  // Monitor popup for messages or closure
  const checkClosed = setInterval(() => {
    if (popup.closed) {
      clearInterval(checkClosed)
      console.log('Authorization window closed')
      // Handle window close event
    }
  }, 500)
}

