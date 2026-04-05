import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import StatusBadge from '../components/StatusBadge'

function StatCard({ label, value, color = 'blue', sub }) {
  const colors = {
    blue:   'bg-blue-50 text-blue-700 border-blue-200',
    red:    'bg-red-50 text-red-700 border-red-200',
    amber:  'bg-amber-50 text-amber-700 border-amber-200',
    green:  'bg-green-50 text-green-700 border-green-200',
  }
  return (
    <div className={`card p-5 border ${colors[color]}`}>
      <p className="text-sm font-medium opacity-75">{label}</p>
      <p className="text-3xl font-bold mt-1">{value ?? '—'}</p>
      {sub && <p className="text-xs mt-1 opacity-60">{sub}</p>}
    </div>
  )
}

function formatDate(d) {
  if (!d) return '—'
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function Dashboard() {
  const [data, setData] = useState(null)
  const [funds, setFunds] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    Promise.all([
      fetch('/api/filings/dashboard').then(r => r.json()),
      fetch('/api/funds').then(r => r.json()),
    ])
      .then(([dashData, fundsData]) => {
        setData(dashData)
        setFunds(Array.isArray(fundsData) ? fundsData : [])
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-gray-400 text-sm">Loading dashboard...</div>
    </div>
  )

  if (error) return (
    <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">
      Error loading dashboard: {error}. Is the backend running on port 3001?
    </div>
  )

  const statusMap = {}
  if (data?.statusCounts) {
    for (const row of data.statusCounts) {
      statusMap[row.status] = row.count
    }
  }

  const activeFunds = funds.filter(f => f.status === 'active')

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Overview of all Reg D blue sky filing obligations</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Active Funds"
          value={data?.totalActiveFunds ?? 0}
          color="blue"
          sub="Currently raising"
        />
        <StatCard
          label="Total Investors"
          value={data?.totalInvestors ?? 0}
          color="blue"
          sub="All pipeline stages"
        />
        <StatCard
          label="Filings Overdue"
          value={data?.overdue?.length ?? 0}
          color={data?.overdue?.length > 0 ? 'red' : 'green'}
          sub="Require immediate action"
        />
        <StatCard
          label="Due in 30 Days"
          value={data?.upcoming?.length ?? 0}
          color={data?.upcoming?.length > 0 ? 'amber' : 'green'}
          sub="Upcoming deadlines"
        />
      </div>

      {/* Overdue filings */}
      {data?.overdue?.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-200 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
            <h2 className="font-semibold text-gray-900">Overdue Filings</h2>
            <span className="ml-auto text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">
              {data.overdue.length} overdue
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="table-th">Fund</th>
                  <th className="table-th">State</th>
                  <th className="table-th">Type</th>
                  <th className="table-th">Due Date</th>
                  <th className="table-th">Days Overdue</th>
                  <th className="table-th">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.overdue.map(f => (
                  <tr key={f.id} className="hover:bg-red-50/50 transition-colors">
                    <td className="table-td font-medium text-gray-900">{f.fund_name}</td>
                    <td className="table-td">
                      <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">{f.state_code}</span>
                    </td>
                    <td className="table-td capitalize">{f.filing_type}</td>
                    <td className="table-td text-red-600 font-medium">{formatDate(f.due_date)}</td>
                    <td className="table-td">
                      <span className="text-red-700 font-semibold">{f.days_overdue} days</span>
                    </td>
                    <td className="table-td">
                      <Link
                        to={`/filings?fund_id=${f.fund_id}`}
                        className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                      >
                        Manage
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Upcoming filings */}
      {data?.upcoming?.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-200 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-amber-400"></div>
            <h2 className="font-semibold text-gray-900">Upcoming Filings — Next 30 Days</h2>
            <span className="ml-auto text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
              {data.upcoming.length} due soon
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="table-th">Fund</th>
                  <th className="table-th">State</th>
                  <th className="table-th">Due Date</th>
                  <th className="table-th">Days Until Due</th>
                  <th className="table-th">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.upcoming.map(f => (
                  <tr key={f.id} className="hover:bg-amber-50/50 transition-colors">
                    <td className="table-td font-medium text-gray-900">{f.fund_name}</td>
                    <td className="table-td">
                      <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">{f.state_code}</span>
                    </td>
                    <td className="table-td font-medium">{formatDate(f.due_date)}</td>
                    <td className="table-td">
                      <span className={`font-semibold ${f.days_until_due <= 7 ? 'text-red-600' : 'text-amber-600'}`}>
                        {f.days_until_due} days
                      </span>
                    </td>
                    <td className="table-td">
                      <Link
                        to={`/filings?fund_id=${f.fund_id}`}
                        className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                      >
                        Manage
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* No issues message */}
      {data?.overdue?.length === 0 && data?.upcoming?.length === 0 && (
        <div className="card p-6 text-center">
          <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="font-medium text-gray-900">All clear</p>
          <p className="text-sm text-gray-500 mt-1">No overdue or upcoming filings in the next 30 days.</p>
        </div>
      )}

      {/* Fund Status Grid */}
      {funds.length > 0 && (
        <div>
          <h2 className="font-semibold text-gray-900 mb-3">Fund Status Overview</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {funds.map(fund => (
              <Link
                key={fund.id}
                to={`/funds/${fund.id}`}
                className="card p-4 hover:shadow-md transition-shadow block"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-gray-900 text-sm leading-tight">{fund.name}</h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {fund.exemption_type === '506b' ? '506(b)' : '506(c)'} &middot; {fund.investor_count} investor{fund.investor_count !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <StatusBadge status={fund.status} />
                </div>
                <div className="flex gap-2 mt-2">
                  {fund.filings_overdue > 0 && (
                    <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                      {fund.filings_overdue} overdue
                    </span>
                  )}
                  {fund.filings_pending > 0 && (
                    <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                      {fund.filings_pending} pending
                    </span>
                  )}
                  {fund.filings_filed > 0 && (
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                      {fund.filings_filed} filed
                    </span>
                  )}
                  {(fund.filings_total || 0) === 0 && (
                    <span className="text-xs text-gray-400">No filings yet</span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {funds.length === 0 && !loading && (
        <div className="card p-8 text-center">
          <p className="text-gray-500 text-sm">No funds yet. <Link to="/funds" className="text-blue-600 hover:underline">Add your first fund</Link> to get started.</p>
        </div>
      )}
    </div>
  )
}
