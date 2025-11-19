import { Link } from 'react-router-dom'
import WalrusTest from './WalrusTest'
import '../css/PageLayout.css'

export default function WalrusTestPage() {
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
        <WalrusTest />
      </div>
    </div>
  )
}

