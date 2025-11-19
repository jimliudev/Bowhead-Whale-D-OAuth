import { BrowserRouter, Routes, Route } from 'react-router-dom'
import LandingPage from './pages/LandingPage'
import HomePage from './pages/Test/WalrusTestPage'
import WalrusTestPage from './pages/Test/WalrusTestPage'
import WalletSignTestPage from './pages/Test/WalletSignTestPage'
import SealTestPage from './pages/Test/SealTestPage'
import ThirdPartyServicePage from './pages/ThirdPartyServicePage'
import UserPage from './pages/UserPage'
import DOAuthPage from './pages/DOAuthPage'
import './App.css'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/demo" element={<HomePage />} />
        <Route path="/walrus-test" element={<WalrusTestPage />} />
        <Route path="/wallet-test" element={<WalletSignTestPage />} />
        <Route path="/seal-test" element={<SealTestPage />} />
        <Route path="/bowheadwhale/thirdparty-service" element={<ThirdPartyServicePage />} />
        <Route path="/bowheadwhale/user" element={<UserPage />} />
        <Route path="/bowheadwhale/doauth_page" element={<DOAuthPage />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
