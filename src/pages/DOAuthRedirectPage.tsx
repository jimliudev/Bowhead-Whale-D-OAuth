import { useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import './css/PageLayout.css'

/**
 * DOAuthRedirectPage
 * 
 * This page handles the OAuth redirect with service parameter.
 * It extracts the service parameter from URL, stores it in sessionStorage,
 * and redirects to the clean /bowheadwhale/doauth_page URL.
 * 
 * Flow:
 * 1. User visits: /bowheadwhale/redirect_doauth_page?service=0xbee29b15...
 * 2. Extract service parameter
 * 3. Store in sessionStorage
 * 4. Redirect to: /bowheadwhale/doauth_page (clean URL)
 * 5. DOAuthPage reads from sessionStorage
 */
export default function DOAuthRedirectPage() {
    const [searchParams] = useSearchParams()
    const navigate = useNavigate()

    useEffect(() => {
        // Add class to body to override default styles
        document.body.classList.add('page-container-active')
        return () => {
            document.body.classList.remove('page-container-active')
        }
    }, [])

    useEffect(() => {
        const serviceId = searchParams.get('service')

        if (serviceId) {
            // Store service ID in sessionStorage
            sessionStorage.setItem('oauth_service_id', serviceId)
            console.log('✅ Stored service ID in sessionStorage:', serviceId)

            // Redirect to clean URL
            navigate('/bowheadwhale/doauth_page', { replace: true })
        } else {
            // No service parameter, redirect to error or home
            console.error('❌ No service parameter found')
            navigate('/bowheadwhale/doauth_page', { replace: true })
        }
    }, [searchParams, navigate])

    return (
        <div className="oauth-page">
            <div className="oauth-container">
                <div className="oauth-card">
                    <div className="oauth-header">
                        <div className="oauth-logo">🐋</div>
                        <div className="oauth-header-text">
                            <h1 className="oauth-title">Redirecting...</h1>
                            <p className="oauth-subtitle">Please wait while we process your request.</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
