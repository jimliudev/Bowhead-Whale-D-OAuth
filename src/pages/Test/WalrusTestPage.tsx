import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import WalrusTest from './WalrusTest'
import { openOAuthWindow } from '../../utils/openOAuthWindow'
import '../css/PageLayout.css'

export default function WalrusTestPage() {
  const [serviceId, setServiceId] = useState('0x3f58a419f88a0b054daebff43c2a759a7a390a6f749cfc991793134cf6a89e21')
  const [authStatus, setAuthStatus] = useState<string>('')
  const [authResult, setAuthResult] = useState<any>(null)

  // Listen for OAuth messages
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Verify origin
      if (event.origin !== window.location.origin) {
        return
      }

      if (event.data.type === 'OAUTH_SUCCESS') {
        setAuthStatus('✅ 授权成功！')
        setAuthResult(event.data)
        console.log('OAuth authorization successful:', event.data)
      } else if (event.data.type === 'OAUTH_CANCELLED') {
        setAuthStatus('❌ 授权已取消')
        setAuthResult(null)
        console.log('OAuth authorization cancelled')
      }
    }

    window.addEventListener('message', handleMessage)

    return () => {
      window.removeEventListener('message', handleMessage)
    }
  }, [])

  const handleOpenPopup = () => {
    if (!serviceId.trim()) {
      setAuthStatus('❌ 请输入 Service ID')
      return
    }

    setAuthStatus('正在打开弹窗...')
    setAuthResult(null)

    const popup = openOAuthWindow(serviceId)
    
    if (!popup) {
      setAuthStatus('❌ 弹窗被阻止！请允许此网站的弹窗。')
    } else {
      setAuthStatus('⏳ 弹窗已打开，请在弹窗中完成授权...')
    }
  }

  const handleTriggerViaHTTP = () => {
    if (!serviceId.trim()) {
      setAuthStatus('❌ 请输入 Service ID')
      return
    }

    setAuthStatus('正在通过 HTTP 触发...')
    setAuthResult(null)

    // Open trigger page in a small hidden window
    const triggerWindow = window.open(
      `${window.location.origin}/bowheadwhale/oauth_trigger?service=${encodeURIComponent(serviceId)}&auto_close=true`,
      'oauth_trigger',
      'width=1,height=1,left=-1000,top=-1000,resizable=no,scrollbars=no,status=no,toolbar=no,menubar=no,location=no'
    )

    if (!triggerWindow) {
      setAuthStatus('❌ 弹窗被阻止！请允许此网站的弹窗。')
    } else {
      setAuthStatus('⏳ 通过 HTTP 触发，弹窗应该已打开...')
    }
  }

  return (
    <div className="app">
      <div className="container">
        <div className="page-header">
          <Link to="/" className="btn btn-secondary">
            ← 返回主頁
          </Link>
          <h1 style={{ margin: 0 }}>Walrus 錢包簽名測試</h1>
          <Link to="/seal-test" className="btn btn-secondary">
            前往 Seal 測試 →
          </Link>
        </div>

        {/* OAuth 弹窗测试区域 */}
        <div style={{
          marginBottom: '2rem',
          padding: '1.5rem',
          background: '#ffffff',
          borderRadius: '8px',
          border: '1px solid #e0e0e0',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <h2 style={{ marginTop: 0, marginBottom: '1rem', fontSize: '1.25rem' }}>
            🪟 OAuth 弹窗测试
          </h2>
          
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
              Service ID:
            </label>
            <input
              type="text"
              value={serviceId}
              onChange={(e) => setServiceId(e.target.value)}
              placeholder="输入 OAuth Service ID"
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #d0d0d0',
                borderRadius: '4px',
                fontSize: '0.875rem',
                fontFamily: 'monospace'
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
            <button
              onClick={handleOpenPopup}
              style={{
                padding: '0.75rem 1.5rem',
                background: '#1a73e8',
                color: '#ffffff',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: 500
              }}
            >
              🪟 直接打开弹窗
            </button>
            
            <button
              onClick={handleTriggerViaHTTP}
              style={{
                padding: '0.75rem 1.5rem',
                background: '#34a853',
                color: '#ffffff',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: 500
              }}
            >
              🌐 通过 HTTP 触发
            </button>

            <button
              onClick={() => {
                window.open(
                  `${window.location.origin}/bowheadwhale/oauth_trigger?service=${encodeURIComponent(serviceId)}&auto_close=true`,
                  '_blank'
                )
              }}
              style={{
                padding: '0.75rem 1.5rem',
                background: '#ea8600',
                color: '#ffffff',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: 500
              }}
            >
              📄 在新标签页打开 Trigger
            </button>
          </div>

          {authStatus && (
            <div style={{
              padding: '1rem',
              background: authStatus.includes('✅') ? '#e8f5e9' : authStatus.includes('❌') ? '#ffebee' : '#e3f2fd',
              borderRadius: '4px',
              marginBottom: '1rem',
              border: `1px solid ${authStatus.includes('✅') ? '#c8e6c9' : authStatus.includes('❌') ? '#ffcdd2' : '#bbdefb'}`,
              color: authStatus.includes('✅') ? '#2e7d32' : authStatus.includes('❌') ? '#c62828' : '#1976d2'
            }}>
              <strong>{authStatus}</strong>
            </div>
          )}

          {authResult && (
            <div style={{
              padding: '1rem',
              background: '#f5f5f5',
              borderRadius: '4px',
              border: '1px solid #e0e0e0'
            }}>
              <h3 style={{ marginTop: 0, fontSize: '1rem' }}>授权结果：</h3>
              <pre style={{
                margin: 0,
                padding: '0.75rem',
                background: '#ffffff',
                borderRadius: '4px',
                fontSize: '0.75rem',
                overflow: 'auto',
                maxHeight: '200px'
              }}>
                {JSON.stringify(authResult, null, 2)}
              </pre>
            </div>
          )}

          <div style={{
            marginTop: '1rem',
            padding: '0.75rem',
            background: '#f8f9fa',
            borderRadius: '4px',
            fontSize: '0.8125rem',
            color: '#5f6368'
          }}>
            <p style={{ margin: 0, marginBottom: '0.5rem' }}>
              <strong>测试说明：</strong>
            </p>
            <ul style={{ margin: 0, paddingLeft: '1.5rem' }}>
              <li><strong>直接打开弹窗：</strong>使用 openOAuthWindow 函数直接打开弹窗</li>
              <li><strong>通过 HTTP 触发：</strong>在隐藏窗口中打开 trigger 页面，然后自动打开弹窗</li>
              <li><strong>在新标签页打开：</strong>在新标签页打开 trigger 页面进行测试</li>
            </ul>
          </div>
        </div>

        <WalrusTest />
      </div>
    </div>
  )
}

