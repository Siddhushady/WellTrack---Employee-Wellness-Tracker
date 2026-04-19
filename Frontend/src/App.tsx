import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import Dashboard from './pages/Dashboard'
import AdminPage from './pages/AdminPage'
import EmployeeConsentPage from './pages/EmployeeConsentPage'
import EmployeeInsightsPage from './pages/EmployeeInsightsPage'
import FlagsPage from './pages/FlagsPage'

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/employee-consent" element={<EmployeeConsentPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/admin/employee-insights" element={<EmployeeInsightsPage />} />
        <Route path="/admin/flags" element={<FlagsPage />} />
      </Routes>
    </Router>
  )
}

export default App
