import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  useCurrentAccount,
  useWallets,
  useConnectWallet,
  useDisconnectWallet,
  useCurrentWallet,
} from '@mysten/dapp-kit'
import './Header.css'

interface HeaderProps {
  title: string
  backTo?: string
  backLabel?: string
  rightLink?: {
    to: string
    label: string
  }
  onAccountClick?: () => void
}

export default function Header({ title, backTo = '/', backLabel = 'Back', rightLink, onAccountClick }: HeaderProps) {
  const location = useLocation()
  const currentAccount = useCurrentAccount()
  const { currentWallet } = useCurrentWallet()
  const { mutate: disconnect } = useDisconnectWallet()
  const [showSettings, setShowSettings] = useState(false)
  const [showLoginModal, setShowLoginModal] = useState(false)

  const { mutate: connect } = useConnectWallet();
  const wallets = useWallets();

  // 調試：顯示所有可用的錢包
  console.log('🔍 All available wallets:', wallets.map(w => ({ name: w.name, features: Object.keys(w.features) })));

  // 過濾出登入相關的錢包（名稱包含 "Sign in"）
  const authWallets = wallets.filter(w => w.name.includes('Sign in'));
  console.log('🍄 Auth wallets found:', authWallets.map(w => w.name));

  const googleWallet = authWallets.find(w => w.name.includes('Google'));
  const facebookWallet = authWallets.find(w => w.name.includes('Facebook'));

  console.log('✅ Google wallet:', googleWallet?.name || 'NOT FOUND');
  console.log('✅ Facebook wallet:', facebookWallet?.name || 'NOT FOUND');

  const isConnected = Boolean(currentAccount)
  const isLandingPage = location.pathname === '/'

  if (isLandingPage) {
    return null
  }

  const handleLogin = (wallet: any) => {
    connect({ wallet });
  };

  return (
    <>
      <header className="app-header">
        <div className="header-container">
          <div className="header-left">
            {backTo && (
              <Link to={backTo} className="header-link">
                ← {backLabel}
              </Link>
            )}
          </div>

          <div className="header-center">
            <h1 className="header-title">{title}</h1>
          </div>

          <div className="header-right">
            {rightLink && (
              <Link to={rightLink.to} className="header-link">
                {rightLink.label} →
              </Link>
            )}

            <div className="header-actions">
              {isConnected ? (
                <>
                  <div className="wallet-info-mini">
                    <div className="wallet-address">
                      {currentAccount?.address.slice(0, 6)}...{currentAccount?.address.slice(-4)}
                    </div>
                    <div className="wallet-name">{currentWallet?.name || 'Wallet'}</div>
                  </div>
                  <button
                    className="header-icon-button"
                    onClick={() => setShowSettings(true)}
                    aria-label="Settings"
                  >
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M10 12.5C11.3807 12.5 12.5 11.3807 12.5 10C12.5 8.61929 11.3807 7.5 10 7.5C8.61929 7.5 7.5 8.61929 7.5 10C7.5 11.3807 8.61929 12.5 10 12.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M16.25 10C16.1574 10.8696 15.9651 11.7246 15.6783 12.5458L17.5 15.4167L15.4167 17.5L12.5458 15.6783C11.7246 15.9651 10.8696 16.1574 10 16.25C9.13038 16.1574 8.27542 15.9651 7.45417 15.6783L4.58333 17.5L2.5 15.4167L4.32167 12.5458C4.03493 11.7246 3.84264 10.8696 3.75 10C3.84264 9.13038 4.03493 8.27542 4.32167 7.45417L2.5 4.58333L4.58333 2.5L7.45417 4.32167C8.27542 4.03493 9.13038 3.84264 10 3.75C10.8696 3.84264 11.7246 4.03493 12.5458 4.32167L15.4167 2.5L17.5 4.58333L15.6783 7.45417C15.9651 8.27542 16.1574 9.13038 16.25 10Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                </>
              ) : (
                <button
                  className="btn btn-primary"
                  onClick={() => setShowLoginModal(true)}
                  style={{
                    padding: '8px 16px',
                    fontSize: '14px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: '#4285f4',
                    color: 'white',
                    cursor: 'pointer',
                    fontWeight: '600',
                  }}
                >
                  Login
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Login Modal */}
      {showLoginModal && (
        <div className="modal-overlay" onClick={() => setShowLoginModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">🍄 Login</h2>
              <button
                className="modal-close"
                onClick={() => setShowLoginModal(false)}
                aria-label="Close"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>

            <div className="modal-body">
              <p style={{ textAlign: 'center', marginBottom: '20px', color: '#718096' }}>
                使用 Web2 登入方式體驗 Sui 區塊鏈
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                {googleWallet && (
                  <button
                    onClick={() => { setShowLoginModal(false); handleLogin(googleWallet); }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '12px',
                      padding: '16px 24px',
                      fontSize: '16px',
                      fontWeight: '600',
                      border: 'none',
                      borderRadius: '12px',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      color: 'white',
                      backgroundColor: '#4285f4',
                    }}
                  >
                    <svg width="24" height="24" viewBox="0 0 24 24">
                      <path
                        fill="currentColor"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="currentColor"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="currentColor"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      />
                      <path
                        fill="currentColor"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      />
                    </svg>
                    使用 Google 登入
                  </button>
                )}

                {facebookWallet && (
                  <button
                    onClick={() => handleLogin(facebookWallet)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '12px',
                      padding: '16px 24px',
                      fontSize: '16px',
                      fontWeight: '600',
                      border: 'none',
                      borderRadius: '12px',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      color: 'white',
                      backgroundColor: '#1877f2',
                    }}
                  >
                    <svg width="24" height="24" viewBox="0 0 24 24">
                      <path
                        fill="currentColor"
                        d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"
                      />
                    </svg>
                    使用 Facebook 登入
                  </button>
                )}

                {!googleWallet && !facebookWallet && (
                  <div style={{
                    textAlign: 'center',
                    padding: '20px',
                    backgroundColor: '#fff3cd',
                    borderRadius: '12px',
                    color: '#856404',
                  }}>
                    <p>⚠️ 沒有可用的登入選項</p>
                    <p style={{ fontSize: '14px', marginTop: '8px' }}>
                      請確認已在 Enoki Portal 設定 OAuth 提供者
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div >
      )
      }

      {/* Settings Modal */}
      {
        showSettings && (
          <div className="modal-overlay" onClick={() => setShowSettings(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2 className="modal-title">Settings</h2>
                <button
                  className="modal-close"
                  onClick={() => setShowSettings(false)}
                  aria-label="Close"
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>

              <div className="modal-body">
                {isConnected && currentAccount && (
                  <div className="settings-section">
                    <h3 className="settings-section-title">Wallet</h3>
                    <div className="settings-item">
                      <div className="settings-item-label">Connected Wallet</div>
                      <div className="settings-item-value">{currentWallet?.name || 'Unknown'}</div>
                    </div>
                    <div className="settings-item">
                      <div className="settings-item-label">Address</div>
                      <div className="settings-item-value settings-address">
                        {currentAccount.address}
                      </div>
                    </div>
                    <button
                      className="btn btn-secondary"
                      onClick={() => {
                        disconnect()
                        setShowSettings(false)
                      }}
                      style={{ width: '100%', marginTop: '1rem' }}
                    >
                      Disconnect Wallet
                    </button>
                  </div>
                )}

                <div className="settings-section">
                  <h3 className="settings-section-title">Navigation</h3>
                  <div className="settings-links">
                    <Link to="/" className="settings-link" onClick={() => setShowSettings(false)}>
                      <span>Home</span>
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path d="M6 12L10 8L6 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </Link>
                    <Link to="/bowheadwhale/user" className="settings-link" onClick={() => setShowSettings(false)}>
                      <span>User Registration</span>
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path d="M6 12L10 8L6 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </Link>
                    <Link to="/bowheadwhale/thirdparty-service" className="settings-link" onClick={() => setShowSettings(false)}>
                      <span>Service Provider</span>
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path d="M6 12L10 8L6 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </Link>
                    {/* <Link to="/demo" className="settings-link" onClick={() => setShowSettings(false)}>
                    <span>Demo</span>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M6 12L10 8L6 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </Link> */}
                    {onAccountClick && (
                      <button
                        className="settings-link"
                        onClick={() => {
                          setShowSettings(false)
                          onAccountClick()
                        }}
                        style={{
                          border: 'none',
                          cursor: 'pointer',
                          fontFamily: 'inherit',
                        }}
                      >
                        <span>Account</span>
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                          <path d="M6 12L10 8L6 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>

                {/* <div className="settings-section">
                <h3 className="settings-section-title">Test Pages</h3>
                <div className="settings-links">
                  <Link to="/walrus-test" className="settings-link" onClick={() => setShowSettings(false)}>
                    <span>Walrus Test</span>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M6 12L10 8L6 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </Link>
                  <Link to="/wallet-test" className="settings-link" onClick={() => setShowSettings(false)}>
                    <span>Wallet Test</span>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M6 12L10 8L6 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </Link>
                  <Link to="/seal-test" className="settings-link" onClick={() => setShowSettings(false)}>
                    <span>Seal Test</span>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M6 12L10 8L6 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </Link>
                </div>
              </div> */}
              </div>
            </div>
          </div>
        )
      }
    </>
  )
}

