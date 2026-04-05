import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
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

export default function FilingTracker() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [funds, setFunds] = useState([])
  const [selectedFundId, setSelectedFundId] = useState(searchParams.get('fund_id') || '')
  const [filings, setFilings] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [statusFilter, setStatusFilter] = useState('all')

  // Filing edit modal
  const [editingFiling, setEditingFiling] = useState(null)
  const [filingForm, setFilingForm] = useState({})
  const [savingFiling, setSavingFiling] = useState(false)

  // Manual add modal
  const [showAddModal, setShowAddModal] = useState(false)
  const [addForm, setAddForm] = useState({ state_code: '', filing_type: 'notice', status: 'pending', due_date: '', notes: '' })
  const [savingAdd, setSavingAdd] = useState(false)

  useEffect(() => {
    fetch('/api/funds').then(r => r.json()).then(data => {
      setFunds(Array.isArray(data) ? data : [])
      if (!selectedFundId && Array.isArray(data) && data.length > 0) {
        setSelectedFundId(String(data[0].id))
      }
    })
  }, [])

  useEffect(() => {
    if (!selectedFundId) return
    setSearchParams({ fund_id: selectedFundId })
    loadFilings(selectedFundId)
  }, [selectedFundId])

  const loadFilings = (fundId) => {
    setLoading(true)
    setError(null)
    fetch(`/api/filings?fund_id=${fundId}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) throw new Error(data.error)
        setFilings(Array.isArray(data) ? data : [])
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }

  const markFiled = async (filing) => {
    const today = new Date().toISOString().split('T')[0]
    await fetch(`/api/filings/${filing.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'filed', filed_date: today }),
    })
    loadFilings(selectedFundId)
  }

  const openEditFiling = (f) => {
    setEditingFiling(f)
    setFilingForm({
      status: f.status, filed_date: f.filed_date || '', due_date: f.due_date || '',
      confirmation_number: f.confirmation_number || '', fee_paid: f.fee_paid !== null ? f.fee_paid : '',
      notes: f.notes || '', filing_type: f.filing_type || 'notice'
    })
  }
  const saveFiling = async () => {
    setSavingFiling(true)
    try {
      const body = {
        ...filingForm,
        fee_paid: filingForm.fee_paid !== '' ? parseFloat(filingForm.fee_paid) : null,
        filed_date: filingForm.filed_date || null,
        due_date: filingForm.due_date || null,
      }
      const res = await fetch(`/api/filings/${editingFiling.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
      })
      if (!res.ok) throw new Error((await res.json()).error)
      setEditingFiling(null)
      loadFilings(selectedFundId)
    } catch (err) { alert('Error: ' + err.message) }
    finally { setSavingFiling(false) }
  }

  const saveAdd = async () => {
    setSavingAdd(true)
    try {
      const res = await fetch('/api/filings', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...addForm, fund_id: selectedFundId })
      })
      if (!res.ok) throw new Error((await res.json()).error)
      setShowAddModal(false)
      loadFilings(selectedFundId)
    } catch (err) { alert('Error: ' + err.message) }
    finally { setSavingAdd(false) }
  }

  const deleteFiling = async (id) => {
    if (!confirm('Delete this filing record?')) return
    await fetch(`/api/filings/${id}`, { method: 'DELETE' })
    loadFilings(selectedFundId)
  }

  const recompute = async () => {
    if (!selectedFundId) return
    const res = await fetch(`/api/filings/recompute/${selectedFundId}`, { method: 'POST' })
    const data = await res.json()
    if (data.error) { alert('Error: ' + data.error); return }
    alert(`Recomputed ${data.updated} filing due dates.`)
    loadFilings(selectedFundId)
  }

  const selectedFund = funds.find(f => String(f.id) === String(selectedFundId))

  const filteredFilings = statusFilter === 'all'
    ? filings
    : filings.filter(f => f.status === statusFilter)

  const counts = filings.reduce((acc, f) => {
    acc[f.status] = (acc[f.status] || 0) + 1
    return acc
  }, {})

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Filing Tracker</h1>
          <p className="text-sm text-gray-500 mt-1">Track blue sky notice filing obligations by state</p>
        </div>
        <div className="flex items-center gap-3">
          {selectedFundId && (
            <button onClick={recompute} className="btn-secondary btn-sm" title="Recompute due dates from first sale date">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Recompute Dates
            </button>
          )}
          {selectedFundId && (
            <button onClick={() => setShowAddModal(true)} className="btn-primary btn-sm">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Manual Filing
            </button>
          )}
        </div>
      </div>

      {/* Fund selector */}
      <div className="card p-4">
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium text-gray-700 whitespace-nowrap">Select Fund:</label>
          <select
            className="input max-w-sm"
            value={selectedFundId}
            onChange={e => setSelectedFundId(e.target.value)}
          >
            <option value="">— Choose a fund —</option>
            {funds.map(f => (
              <option key={f.id} value={f.id}>
                {f.name} ({f.exemption_type === '506b' ? '506(b)' : '506(c)'}) — {f.status}
              </option>
            ))}
          </select>
          {selectedFund && (
            <div className="flex items-center gap-2 ml-2">
              <span className="text-sm text-gray-500">First Sale:</span>
              <span className="text-sm font-medium">{formatDate(selectedFund.first_sale_date)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Status summary */}
      {filings.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {[
            ['all', 'All', filings.length, 'bg-gray-100 text-gray-700'],
            ['overdue', 'Overdue', counts.overdue || 0, 'bg-red-100 text-red-700'],
            ['pending', 'Pending', counts.pending || 0, 'bg-amber-100 text-amber-700'],
            ['filed', 'Filed', counts.filed || 0, 'bg-green-100 text-green-700'],
            ['not_required', 'Not Required', counts.not_required || 0, 'bg-gray-100 text-gray-500'],
          ].map(([key, label, count, cls]) => (
            <button
              key={key}
              onClick={() => setStatusFilter(key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                statusFilter === key ? 'ring-2 ring-offset-1 ring-blue-500 ' + cls : cls + ' opacity-70 hover:opacity-100'
              }`}
            >
              {label} ({count})
            </button>
          ))}
        </div>
      )}

      {!selectedFundId && (
        <div className="card p-8 text-center text-gray-400 text-sm">Select a fund above to view its filing obligations.</div>
      )}

      {loading && <div className="text-gray-400 text-sm p-4">Loading filings...</div>}
      {error && <div className="text-red-600 text-sm p-4">Error: {error}</div>}

      {selectedFundId && !loading && filteredFilings.length === 0 && (
        <div className="card p-8 text-center">
          <p className="text-gray-500 text-sm">
            {statusFilter === 'all'
              ? 'No filing obligations yet. Add investors with committed or closed status to auto-generate filings.'
              : `No filings with status "${statusFilter}".`}
          </p>
        </div>
      )}

      {filteredFilings.length > 0 && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="table-th">State</th>
                  <th className="table-th">Investors</th>
                  <th className="table-th">Form</th>
                  <th className="table-th">Method</th>
                  <th className="table-th">Deadline</th>
                  <th className="table-th">Due Date</th>
                  <th className="table-th">Status</th>
                  <th className="table-th">Filed Date</th>
                  <th className="table-th">Fee Paid</th>
                  <th className="table-th">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredFilings.map(f => (
                  <tr
                    key={f.id}
                    className={`hover:bg-gray-50 transition-colors ${
                      f.status === 'overdue' ? 'bg-red-50/30' : ''
                    }`}
                  >
                    <td className="table-td">
                      <div>
                        <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded font-medium">{f.state_code}</span>
                        {f.state_name && <div className="text-xs text-gray-500 mt-0.5">{f.state_name}</div>}
                      </div>
                    </td>
                    <td className="table-td text-center font-medium">{f.investor_count || 0}</td>
                    <td className="table-td text-xs text-gray-600 max-w-32">
                      <span title={f.form_name}>{f.form_name || '—'}</span>
                    </td>
                    <td className="table-td text-xs text-gray-600 max-w-28">
                      <span title={f.filing_method}>{f.filing_method ? f.filing_method.split('(')[0].trim() : '—'}</span>
                    </td>
                    <td className="table-td text-xs text-gray-600">
                      {f.deadline_days != null ? `${f.deadline_days} days` : f.deadline_notes || '—'}
                    </td>
                    <td className="table-td">
                      <span className={f.status === 'overdue' ? 'text-red-600 font-semibold' : 'font-medium'}>
                        {formatDate(f.due_date)}
                      </span>
                      {f.due_date_manual === 1 && (
                        <span className="ml-1 text-xs text-gray-400" title="Manually overridden">*</span>
                      )}
                    </td>
                    <td className="table-td"><StatusBadge status={f.status} /></td>
                    <td className="table-td">{formatDate(f.filed_date)}</td>
                    <td className="table-td">{f.fee_paid != null ? formatCurrency(f.fee_paid) : (f.fee_amount ? <span className="text-gray-400 text-xs">{formatCurrency(f.fee_amount)} est.</span> : '—')}</td>
                    <td className="table-td">
                      <div className="flex items-center gap-2 flex-wrap">
                        {(f.status === 'pending' || f.status === 'overdue') && (
                          <button
                            onClick={() => markFiled(f)}
                            className="text-xs bg-green-100 text-green-700 hover:bg-green-200 px-2 py-1 rounded font-medium transition-colors whitespace-nowrap"
                          >
                            Mark Filed
                          </button>
                        )}
                        <button onClick={() => openEditFiling(f)} className="text-blue-600 hover:text-blue-800 text-xs font-medium">Edit</button>
                        <button onClick={() => deleteFiling(f.id)} className="text-red-400 hover:text-red-600 text-xs font-medium">Del</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Edit Filing Modal */}
      {editingFiling && (
        <Modal
          title={`Edit Filing — ${editingFiling.state_code} ${editingFiling.state_name ? `(${editingFiling.state_name})` : ''}`}
          onClose={() => setEditingFiling(null)}
          onConfirm={saveFiling}
          confirmLabel={savingFiling ? 'Saving...' : 'Save Changes'}
          confirmDisabled={savingFiling}
          size="lg"
        >
          <div className="space-y-4">
            {editingFiling.special_requirements && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
                <strong>State Note:</strong> {editingFiling.special_requirements}
              </div>
            )}
            {editingFiling.filing_method && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700">
                <strong>Filing Method:</strong> {editingFiling.filing_method}
                {editingFiling.form_name && <> &middot; <strong>Form:</strong> {editingFiling.form_name}</>}
                {editingFiling.fee_amount != null && <> &middot; <strong>Expected Fee:</strong> {formatCurrency(editingFiling.fee_amount)}</>}
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Status</label>
                <select className="input" value={filingForm.status} onChange={e => setFilingForm(f => ({ ...f, status: e.target.value }))}>
                  <option value="pending">Pending</option>
                  <option value="filed">Filed</option>
                  <option value="overdue">Overdue</option>
                  <option value="not_required">Not Required</option>
                  <option value="waived">Waived</option>
                </select>
              </div>
              <div>
                <label className="label">Filing Type</label>
                <select className="input" value={filingForm.filing_type} onChange={e => setFilingForm(f => ({ ...f, filing_type: e.target.value }))}>
                  <option value="notice">Notice</option>
                  <option value="amendment">Amendment</option>
                  <option value="renewal">Renewal</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Due Date <span className="text-gray-400 text-xs">(overrides auto-computed)</span></label>
                <input type="date" className="input" value={filingForm.due_date} onChange={e => setFilingForm(f => ({ ...f, due_date: e.target.value }))} />
              </div>
              <div>
                <label className="label">Filed Date</label>
                <input type="date" className="input" value={filingForm.filed_date} onChange={e => setFilingForm(f => ({ ...f, filed_date: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Confirmation Number</label>
                <input className="input" value={filingForm.confirmation_number} onChange={e => setFilingForm(f => ({ ...f, confirmation_number: e.target.value }))} placeholder="e.g. CA-2024-00123" />
              </div>
              <div>
                <label className="label">Fee Paid ($)</label>
                <input type="number" className="input" value={filingForm.fee_paid} onChange={e => setFilingForm(f => ({ ...f, fee_paid: e.target.value }))} placeholder={editingFiling.fee_amount != null ? `${editingFiling.fee_amount} (est.)` : ''} />
              </div>
            </div>
            <div>
              <label className="label">Notes</label>
              <textarea className="input" rows={3} value={filingForm.notes} onChange={e => setFilingForm(f => ({ ...f, notes: e.target.value }))} placeholder="Internal notes, portal login info, etc..." />
            </div>
          </div>
        </Modal>
      )}

      {/* Add Manual Filing Modal */}
      {showAddModal && (
        <Modal
          title="Add Manual Filing"
          onClose={() => setShowAddModal(false)}
          onConfirm={saveAdd}
          confirmLabel={savingAdd ? 'Saving...' : 'Add Filing'}
          confirmDisabled={savingAdd || !addForm.state_code}
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">State Code *</label>
                <input
                  className="input uppercase"
                  maxLength={2}
                  value={addForm.state_code}
                  onChange={e => setAddForm(f => ({ ...f, state_code: e.target.value.toUpperCase() }))}
                  placeholder="e.g. CA"
                />
              </div>
              <div>
                <label className="label">Filing Type</label>
                <select className="input" value={addForm.filing_type} onChange={e => setAddForm(f => ({ ...f, filing_type: e.target.value }))}>
                  <option value="notice">Notice</option>
                  <option value="amendment">Amendment</option>
                  <option value="renewal">Renewal</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Status</label>
                <select className="input" value={addForm.status} onChange={e => setAddForm(f => ({ ...f, status: e.target.value }))}>
                  <option value="pending">Pending</option>
                  <option value="filed">Filed</option>
                  <option value="not_required">Not Required</option>
                </select>
              </div>
              <div>
                <label className="label">Due Date</label>
                <input type="date" className="input" value={addForm.due_date} onChange={e => setAddForm(f => ({ ...f, due_date: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="label">Notes</label>
              <textarea className="input" rows={2} value={addForm.notes} onChange={e => setAddForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
