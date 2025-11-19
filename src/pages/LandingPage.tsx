import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import './css/LandingPage.css'

export default function LandingPage() {
  useEffect(() => {
    // Add class to body to override default styles
    document.body.classList.add('landing-page-active')
    return () => {
      // Remove class when component unmounts
      document.body.classList.remove('landing-page-active')
    }
  }, [])

  return (
    <div className="landing">
      {/* Hero Section */}
      <section className="hero">
        <div className="hero-container">
          <div className="hero-emoji">🐋</div>
          <h1 className="hero-heading">Bowhead Whale</h1>
          <p className="hero-tagline">Decentralized OAuth Infrastructure</p>
          <p className="hero-description">
            Secure data management and seamless third-party authorization
            <br />
            powered by Walrus, Seal, and Move smart contracts
          </p>
          
          <div className="hero-actions">
            <Link to="/bowheadwhale/user" className="cta-button primary">
              User Registration
            </Link>
            <Link to="/bowheadwhale/thirdparty-service" className="cta-button secondary">
              Service Provider
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="features">
        <div className="features-container">
          <div className="feature-item">
            <div className="feature-icon">🔐</div>
            <h3 className="feature-title">Secure & Private</h3>
            <p className="feature-text">
              End-to-end encryption with Seal protocol ensures your data remains private
            </p>
          </div>
          
          <div className="feature-item">
            <div className="feature-icon">🌐</div>
            <h3 className="feature-title">Decentralized Storage</h3>
            <p className="feature-text">
              Powered by Walrus distributed storage, your data is always accessible
            </p>
          </div>
          
          <div className="feature-item">
            <div className="feature-icon">⚡</div>
            <h3 className="feature-title">Seamless OAuth</h3>
            <p className="feature-text">
              Authorize third-party services without compromising your security
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="footer-container">
          <div className="footer-links">
            <Link to="/walrus-test" className="footer-link">Walrus Test</Link>
            <Link to="/wallet-test" className="footer-link">Wallet Test</Link>
            <Link to="/seal-test" className="footer-link">Seal Test</Link>
            <Link to="/demo" className="footer-link">Demo</Link>
          </div>
          <p className="footer-copyright">
            © 2024 Bowhead Whale. Built on Sui Network.
          </p>
        </div>
      </footer>
    </div>
  )
}

