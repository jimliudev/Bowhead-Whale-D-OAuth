import { Link } from 'react-router-dom'
import SealTest from './SealTest'
import '../css/PageLayout.css'

export default function SealTestPage() {
  return (
    <div className="app">
      <div className="container">
        <div className="page-header">
          <Link to="/" className="btn btn-secondary">
            ← 返回主頁
          </Link>
          <h1 style={{ margin: 0 }}>Seal 加密測試</h1>
          <Link to="/wallet-test" className="btn btn-secondary">
            前往錢包簽章測試 →
          </Link>
        </div>
        <SealTest />
      </div>
    </div>
  )
}

