import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import FundList from './pages/FundList'
import FundDetail from './pages/FundDetail'
import FilingTracker from './pages/FilingTracker'
import StateRulesRef from './pages/StateRulesRef'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="funds" element={<FundList />} />
          <Route path="funds/:id" element={<FundDetail />} />
          <Route path="filings" element={<FilingTracker />} />
          <Route path="state-rules" element={<StateRulesRef />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
