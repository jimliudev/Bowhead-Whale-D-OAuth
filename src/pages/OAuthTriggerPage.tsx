import { useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { openOAuthWindow } from '../utils/openOAuthWindow'

/**
 * OAuth Trigger Page
 * This page listens for HTTP requests and triggers the OAuth popup window
 * 
 * Usage:
 * - Direct URL: /bowheadwhale/oauth_trigger?service=SERVICE_ID
 * - Redirect from third-party service
 * - HTTP GET request to this endpoint
 */
export default function OAuthTriggerPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  
  const serviceId = searchParams.get('service')
  const autoClose = searchParams.get('auto_close') === 'true'
  const redirect = searchParams.get('redirect')

  useEffect(() => {
    if (!serviceId) {
      console.error('Missing service parameter')
      return
    }

    // Open popup window
    const popup = openOAuthWindow(serviceId)
    
    if (popup) {
      console.log('OAuth popup opened successfully')
      
      // Listen for messages from popup window
      const handleMessage = (event: MessageEvent) => {
        // Verify origin for security
        if (event.origin !== window.location.origin) {
          return
        }

        if (event.data.type === 'OAUTH_SUCCESS') {
          console.log('OAuth authorization successful', event.data)
          
          // Close this trigger page if auto_close is enabled
          if (autoClose) {
            window.close()
          }
          
          // Redirect if redirect URL is provided
          if (redirect) {
            window.location.href = redirect
          } else if (window.opener) {
            // If opened from another window, close this one
            window.close()
          } else {
            // Otherwise, redirect to home
            navigate('/')
          }
        } else if (event.data.type === 'OAUTH_CANCELLED') {
          console.log('OAuth authorization cancelled')
          
          if (autoClose) {
            window.close()
          } else if (window.opener) {
            window.close()
          } else {
            navigate('/')
          }
        }
      }

      window.addEventListener('message', handleMessage)

      // Check if popup is closed manually
      const checkClosed = setInterval(() => {
        if (popup.closed) {
          clearInterval(checkClosed)
          window.removeEventListener('message', handleMessage)
          
          if (autoClose) {
            window.close()
          } else if (window.opener) {
            window.close()
          } else {
            navigate('/')
          }
        }
      }, 500)

      return () => {
        clearInterval(checkClosed)
        window.removeEventListener('message', handleMessage)
      }
    } else {
      // Popup was blocked, redirect to full page
      console.warn('Popup blocked, redirecting to full page')
      navigate(`/bowheadwhale/doauth_page_new_window?service=${encodeURIComponent(serviceId)}`)
    }
  }, [serviceId, autoClose, redirect, navigate])

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      padding: '2rem',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      background: '#f8f9fa'
    }}>
      <div style={{
        textAlign: 'center',
        maxWidth: '400px'
      }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🐋</div>
        <h1 style={{ fontSize: '1.5rem', marginBottom: '0.5rem', color: '#202124' }}>
          Opening Authorization Window...
        </h1>
        <p style={{ fontSize: '0.875rem', color: '#5f6368', marginBottom: '2rem' }}>
          Please wait while we open the authorization window.
        </p>
        {serviceId && (
          <div style={{
            padding: '1rem',
            background: '#ffffff',
            borderRadius: '8px',
            border: '1px solid #dadce0',
            marginTop: '1rem'
          }}>
            <p style={{ fontSize: '0.8125rem', color: '#5f6368', margin: 0 }}>
              <strong>Service ID:</strong> {serviceId.slice(0, 20)}...
            </p>
          </div>
        )}
        <p style={{ fontSize: '0.75rem', color: '#86868b', marginTop: '2rem' }}>
          If the popup window doesn't open, please allow popups for this site.
        </p>
      </div>
    </div>
  )
}

