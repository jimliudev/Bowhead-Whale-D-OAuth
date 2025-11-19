import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  useCurrentAccount,
  useCurrentWallet,
  useDisconnectWallet,
  ConnectButton,
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
}

export default function Header({ title, backTo = '/', backLabel = 'Back', rightLink }: HeaderProps) {
  const location = useLocation()
  const currentAccount = useCurrentAccount()
  const { currentWallet } = useCurrentWallet()
  const { mutate: disconnect } = useDisconnectWallet()
  const [showSettings, setShowSettings] = useState(false)

  const isConnected = Boolean(currentAccount)
  const isLandingPage = location.pathname === '/'

  if (isLandingPage) {
    return null
  }

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
                      <path d="M10 12.5C11.3807 12.5 12.5 11.3807 12.5 10C12.5 8.61929 11.3807 7.5 10 7.5C8.61929 7.5 7.5 8.61929 7.5 10C7.5 11.3807 8.61929 12.5 10 12.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M16.25 10C16.1574 10.8696 15.9651 11.7246 15.6783 12.5458L17.5 15.4167L15.4167 17.5L12.5458 15.6783C11.7246 15.9651 10.8696 16.1574 10 16.25C9.13038 16.1574 8.27542 15.9651 7.45417 15.6783L4.58333 17.5L2.5 15.4167L4.32167 12.5458C4.03493 11.7246 3.84264 10.8696 3.75 10C3.84264 9.13038 4.03493 8.27542 4.32167 7.45417L2.5 4.58333L4.58333 2.5L7.45417 4.32167C8.27542 4.03493 9.13038 3.84264 10 3.75C10.8696 3.84264 11.7246 4.03493 12.5458 4.32167L15.4167 2.5L17.5 4.58333L15.6783 7.45417C15.9651 8.27542 16.1574 9.13038 16.25 10Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                </>
              ) : (
                <ConnectButton />
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Settings Modal */}
      {showSettings && (
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
                  <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
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
                      <path d="M6 12L10 8L6 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </Link>
                  <Link to="/bowheadwhale/user" className="settings-link" onClick={() => setShowSettings(false)}>
                    <span>User Registration</span>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M6 12L10 8L6 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </Link>
                  <Link to="/bowheadwhale/thirdparty-service" className="settings-link" onClick={() => setShowSettings(false)}>
                    <span>Service Provider</span>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M6 12L10 8L6 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </Link>
                  <Link to="/demo" className="settings-link" onClick={() => setShowSettings(false)}>
                    <span>Demo</span>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M6 12L10 8L6 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </Link>
                </div>
              </div>

              <div className="settings-section">
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
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

