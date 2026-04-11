import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import FundList from './pages/FundList'
import FundDetail from './pages/FundDetail'
import FilingTracker from './pages/FilingTracker'
import StateRulesRef from './pages/StateRulesRef'
import Login from './pages/Login'

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-900">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route 
            path="/" 
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="funds" element={<FundList />} />
            <Route path="funds/:id" element={<FundDetail />} />
            <Route path="filings" element={<FilingTracker />} />
            <Route path="state-rules" element={<StateRulesRef />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
