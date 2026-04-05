import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import Modal from '../components/Modal'
import StatusBadge from '../components/StatusBadge'

function formatDate(d) {
  if (!d) return '—'
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatCurrency(n) {
  if (n == null) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

const EMPTY_FORM = {
  name: '',
  exemption_type: '506b',
  first_sale_date: '',
  target_raise: '',
  status: 'active',
  notes: '',
}

export default function FundList() {
  const [funds, setFunds] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(null)

  const loadFunds = () => {
    fetch('/api/funds')
      .then(r => r.json())
      .then(data => setFunds(Array.isArray(data) ? data : []))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadFunds() }, [])

  const openNew = () => {
    setForm(EMPTY_FORM)
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!form.name || !form.exemption_type) return
    setSaving(true)
    try {
      const body = {
        ...form,
        first_sale_date: form.first_sale_date || null,
        target_raise: form.target_raise ? parseFloat(form.target_raise) : null,
      }
      const res = await fetch('/api/funds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      setShowModal(false)
      loadFunds()
    } catch (err) {
      alert('Error saving fund: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    try {
      await fetch(`/api/funds/${id}`, { method: 'DELETE' })
      loadFunds()
    } catch (err) {
      alert('Error deleting: ' + err.message)
    }
    setDeleteConfirm(null)
  }

  if (loading) return <div className="text-gray-400 text-sm p-8">Loading funds...</div>
  if (error) return <div className="text-red-600 text-sm p-4">Error: {error}</div>

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Funds</h1>
          <p className="text-sm text-gray-500 mt-1">Manage your Reg D fund offerings</p>
        </div>
        <button onClick={openNew} className="btn-primary">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Fund
        </button>
      </div>

      {funds.length === 0 ? (
        <div className="card p-10 text-center">
          <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <p className="font-medium text-gray-900">No funds yet</p>
          <p className="text-sm text-gray-500 mt-1 mb-4">Create your first Reg D fund to start tracking blue sky filings.</p>
          <button onClick={openNew} className="btn-primary mx-auto">Add Fund</button>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="table-th">Fund Name</th>
                  <th className="table-th">Type</th>
                  <th className="table-th">Status</th>
                  <th className="table-th">First Sale</th>
                  <th className="table-th">Target Raise</th>
                  <th className="table-th">Investors</th>
                  <th className="table-th">Filings</th>
                  <th className="table-th">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {funds.map(fund => (
                  <tr key={fund.id} className="hover:bg-gray-50 transition-colors">
                    <td className="table-td">
                      <Link to={`/funds/${fund.id}`} className="font-semibold text-blue-700 hover:text-blue-900">
                        {fund.name}
                      </Link>
                    </td>
                    <td className="table-td">
                      <span className="font-mono text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                        {fund.exemption_type === '506b' ? '506(b)' : '506(c)'}
                      </span>
                    </td>
                    <td className="table-td">
                      <StatusBadge status={fund.status} />
                    </td>
                    <td className="table-td">{formatDate(fund.first_sale_date)}</td>
                    <td className="table-td">{formatCurrency(fund.target_raise)}</td>
                    <td className="table-td">
                      <span className="font-medium">{fund.investor_count || 0}</span>
                    </td>
                    <td className="table-td">
                      <div className="flex gap-1 flex-wrap">
                        {(fund.filings_overdue || 0) > 0 && (
                          <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded">
                            {fund.filings_overdue} overdue
                          </span>
                        )}
                        {(fund.filings_pending || 0) > 0 && (
                          <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">
                            {fund.filings_pending} pending
                          </span>
                        )}
                        {(fund.filings_filed || 0) > 0 && (
                          <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">
                            {fund.filings_filed} filed
                          </span>
                        )}
                        {(fund.filings_total || 0) === 0 && (
                          <span className="text-xs text-gray-400">None</span>
                        )}
                      </div>
                    </td>
                    <td className="table-td">
                      <div className="flex items-center gap-2">
                        <Link to={`/funds/${fund.id}`} className="text-blue-600 hover:text-blue-800 text-xs font-medium">
                          View
                        </Link>
                        <button
                          onClick={() => setDeleteConfirm(fund)}
                          className="text-red-500 hover:text-red-700 text-xs font-medium"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* New Fund Modal */}
      {showModal && (
        <Modal
          title="New Fund"
          onClose={() => setShowModal(false)}
          onConfirm={handleSave}
          confirmLabel={saving ? 'Saving...' : 'Create Fund'}
          confirmDisabled={saving || !form.name}
        >
          <div className="space-y-4">
            <div>
              <label className="label">Fund Name *</label>
              <input
                className="input"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Acme Growth Fund II"
              />
            </div>
            <div>
              <label className="label">Exemption Type *</label>
              <select
                className="input"
                value={form.exemption_type}
                onChange={e => setForm(f => ({ ...f, exemption_type: e.target.value }))}
              >
                <option value="506b">Rule 506(b) — Up to 35 non-accredited investors</option>
                <option value="506c">Rule 506(c) — General solicitation allowed; accredited only</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">First Sale Date</label>
                <input
                  type="date"
                  className="input"
                  value={form.first_sale_date}
                  onChange={e => setForm(f => ({ ...f, first_sale_date: e.target.value }))}
                />
                <p className="text-xs text-gray-400 mt-1">Used to compute filing deadlines</p>
              </div>
              <div>
                <label className="label">Target Raise ($)</label>
                <input
                  type="number"
                  className="input"
                  value={form.target_raise}
                  onChange={e => setForm(f => ({ ...f, target_raise: e.target.value }))}
                  placeholder="e.g. 10000000"
                />
              </div>
            </div>
            <div>
              <label className="label">Status</label>
              <select
                className="input"
                value={form.status}
                onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
              >
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="closed">Closed</option>
              </select>
            </div>
            <div>
              <label className="label">Notes</label>
              <textarea
                className="input"
                rows={3}
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Internal notes about this fund..."
              />
            </div>
          </div>
        </Modal>
      )}

      {/* Delete confirmation */}
      {deleteConfirm && (
        <Modal
          title="Delete Fund"
          onClose={() => setDeleteConfirm(null)}
          onConfirm={() => handleDelete(deleteConfirm.id)}
          confirmLabel="Delete"
          size="sm"
        >
          <p className="text-sm text-gray-600">
            Are you sure you want to delete <strong>{deleteConfirm.name}</strong>? This will also delete all associated investors and filings. This action cannot be undone.
          </p>
        </Modal>
      )}
    </div>
  )
}
