import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
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

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY','DC'
]

const EMPTY_INVESTOR = {
  name: '', entity_name: '', state: 'CA', pipeline_stage: 'prospect',
  commitment_amount: '', is_accredited: true, is_qualified_client: false, notes: ''
}
const EMPTY_FUND_EDIT = {
  name: '', exemption_type: '506b', first_sale_date: '', target_raise: '', status: 'active', notes: ''
}

export default function FundDetail() {
  const { id } = useParams()
  const [fund, setFund] = useState(null)
  const [investors, setInvestors] = useState([])
  const [filings, setFilings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [activeTab, setActiveTab] = useState('pipeline')
  const [stageFilter, setStageFilter] = useState('all')

  // Investor modal
  const [showInvModal, setShowInvModal] = useState(false)
  const [editingInvestor, setEditingInvestor] = useState(null)
  const [invForm, setInvForm] = useState(EMPTY_INVESTOR)
  const [savingInv, setSavingInv] = useState(false)

  // Fund edit modal
  const [showFundEdit, setShowFundEdit] = useState(false)
  const [fundForm, setFundForm] = useState(EMPTY_FUND_EDIT)
  const [savingFund, setSavingFund] = useState(false)

  // Filing edit modal
  const [editingFiling, setEditingFiling] = useState(null)
  const [filingForm, setFilingForm] = useState({})
  const [savingFiling, setSavingFiling] = useState(false)

  const loadFund = () => {
    setLoading(true)
    fetch(`/api/funds/${id}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) throw new Error(data.error)
        setFund(data)
        setInvestors(data.investors || [])
        setFilings(data.filings || [])
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadFund() }, [id])

  // Investor actions
  const openAddInvestor = () => {
    setEditingInvestor(null)
    setInvForm(EMPTY_INVESTOR)
    setShowInvModal(true)
  }
  const openEditInvestor = (inv) => {
    setEditingInvestor(inv)
    setInvForm({
      name: inv.name, entity_name: inv.entity_name || '', state: inv.state,
      pipeline_stage: inv.pipeline_stage, commitment_amount: inv.commitment_amount || '',
      is_accredited: !!inv.is_accredited, is_qualified_client: !!inv.is_qualified_client,
      notes: inv.notes || ''
    })
    setShowInvModal(true)
  }
  const saveInvestor = async () => {
    setSavingInv(true)
    try {
      const body = {
        ...invForm,
        fund_id: id,
        commitment_amount: invForm.commitment_amount ? parseFloat(invForm.commitment_amount) : null,
        is_accredited: invForm.is_accredited ? 1 : 0,
        is_qualified_client: invForm.is_qualified_client ? 1 : 0,
      }
      const url = editingInvestor ? `/api/investors/${editingInvestor.id}` : '/api/investors'
      const method = editingInvestor ? 'PUT' : 'POST'
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (!res.ok) throw new Error((await res.json()).error)
      setShowInvModal(false)
      loadFund()
    } catch (err) { alert('Error: ' + err.message) }
    finally { setSavingInv(false) }
  }
  const deleteInvestor = async (invId) => {
    if (!confirm('Delete this investor?')) return
    await fetch(`/api/investors/${invId}`, { method: 'DELETE' })
    loadFund()
  }

  // Fund edit
  const openEditFund = () => {
    setFundForm({
      name: fund.name, exemption_type: fund.exemption_type,
      first_sale_date: fund.first_sale_date || '', target_raise: fund.target_raise || '',
      status: fund.status, notes: fund.notes || ''
    })
    setShowFundEdit(true)
  }
  const saveFund = async () => {
    setSavingFund(true)
    try {
      const body = { ...fundForm, target_raise: fundForm.target_raise ? parseFloat(fundForm.target_raise) : null, first_sale_date: fundForm.first_sale_date || null }
      const res = await fetch(`/api/funds/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (!res.ok) throw new Error((await res.json()).error)
      setShowFundEdit(false)
      loadFund()
    } catch (err) { alert('Error: ' + err.message) }
    finally { setSavingFund(false) }
  }

  // Filing edit
  const openEditFiling = (f) => {
    setEditingFiling(f)
    setFilingForm({
      status: f.status, filed_date: f.filed_date || '', due_date: f.due_date || '',
      confirmation_number: f.confirmation_number || '', fee_paid: f.fee_paid || '',
      notes: f.notes || ''
    })
  }
  const saveFiling = async () => {
    setSavingFiling(true)
    try {
      const body = {
        ...filingForm,
        fee_paid: filingForm.fee_paid ? parseFloat(filingForm.fee_paid) : null,
        filed_date: filingForm.filed_date || null,
        due_date: filingForm.due_date || null,
      }
      const res = await fetch(`/api/filings/${editingFiling.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (!res.ok) throw new Error((await res.json()).error)
      setEditingFiling(null)
      loadFund()
    } catch (err) { alert('Error: ' + err.message) }
    finally { setSavingFiling(false) }
  }
  const markFiled = async (filing) => {
    const today = new Date().toISOString().split('T')[0]
    await fetch(`/api/filings/${filing.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'filed', filed_date: today }),
    })
    loadFund()
  }

  if (loading) return <div className="text-gray-400 text-sm p-8">Loading fund...</div>
  if (error) return <div className="text-red-600 text-sm p-4">Error: {error}</div>
  if (!fund) return <div className="text-gray-400 text-sm p-4">Fund not found.</div>

  const filteredInvestors = stageFilter === 'all'
    ? investors
    : investors.filter(i => i.pipeline_stage === stageFilter)

  const totalCommitted = investors
    .filter(i => i.pipeline_stage === 'committed' || i.pipeline_stage === 'closed')
    .reduce((sum, i) => sum + (i.commitment_amount || 0), 0)

  return (
    <div className="space-y-5">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link to="/funds" className="hover:text-gray-700">Funds</Link>
        <span>/</span>
        <span className="text-gray-900 font-medium">{fund.name}</span>
      </div>

      {/* Fund Header */}
      <div className="card p-5">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-gray-900">{fund.name}</h1>
              <StatusBadge status={fund.status} />
              <span className="font-mono text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                {fund.exemption_type === '506b' ? '506(b)' : '506(c)'}
              </span>
            </div>
            {fund.notes && <p className="text-sm text-gray-500 mt-1">{fund.notes}</p>}
          </div>
          <button onClick={openEditFund} className="btn-secondary btn-sm">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Edit Fund
          </button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 pt-4 border-t border-gray-100">
          <div>
            <p className="text-xs text-gray-500">First Sale Date</p>
            <p className="font-medium text-sm mt-0.5">{formatDate(fund.first_sale_date)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Target Raise</p>
            <p className="font-medium text-sm mt-0.5">{formatCurrency(fund.target_raise)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Committed / Closed</p>
            <p className="font-medium text-sm mt-0.5">{formatCurrency(totalCommitted)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Total Investors</p>
            <p className="font-medium text-sm mt-0.5">{investors.length}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {[['pipeline', 'Investor Pipeline'], ['filings', 'Filings']].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === key
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {label}
            {key === 'pipeline' && <span className="ml-1.5 text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">{investors.length}</span>}
            {key === 'filings' && <span className="ml-1.5 text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">{filings.length}</span>}
          </button>
        ))}
      </div>

      {/* Investor Pipeline Tab */}
      {activeTab === 'pipeline' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              {['all', 'prospect', 'committed', 'closed'].map(stage => (
                <button
                  key={stage}
                  onClick={() => setStageFilter(stage)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    stageFilter === stage
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  {stage.charAt(0).toUpperCase() + stage.slice(1)}
                  {stage !== 'all' && (
                    <span className="ml-1 opacity-75">
                      ({investors.filter(i => i.pipeline_stage === stage).length})
                    </span>
                  )}
                </button>
              ))}
            </div>
            <button onClick={openAddInvestor} className="btn-primary btn-sm">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Investor
            </button>
          </div>

          {filteredInvestors.length === 0 ? (
            <div className="card p-8 text-center">
              <p className="text-gray-500 text-sm">No investors in this stage. <button onClick={openAddInvestor} className="text-blue-600 hover:underline">Add one.</button></p>
            </div>
          ) : (
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="table-th">Name</th>
                      <th className="table-th">Entity</th>
                      <th className="table-th">State</th>
                      <th className="table-th">Stage</th>
                      <th className="table-th">Amount</th>
                      <th className="table-th">Accredited</th>
                      <th className="table-th">Notes</th>
                      <th className="table-th">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredInvestors.map(inv => (
                      <tr key={inv.id} className="hover:bg-gray-50 transition-colors">
                        <td className="table-td font-medium text-gray-900">{inv.name}</td>
                        <td className="table-td text-gray-500">{inv.entity_name || '—'}</td>
                        <td className="table-td">
                          <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">{inv.state}</span>
                        </td>
                        <td className="table-td"><StatusBadge status={inv.pipeline_stage} /></td>
                        <td className="table-td">{formatCurrency(inv.commitment_amount)}</td>
                        <td className="table-td">
                          {inv.is_accredited ? (
                            <span className="text-green-600 text-xs font-medium">Yes</span>
                          ) : (
                            <span className="text-red-600 text-xs font-medium">No</span>
                          )}
                        </td>
                        <td className="table-td max-w-xs truncate text-gray-500 text-xs">{inv.notes || '—'}</td>
                        <td className="table-td">
                          <div className="flex items-center gap-2">
                            <button onClick={() => openEditInvestor(inv)} className="text-blue-600 hover:text-blue-800 text-xs font-medium">Edit</button>
                            <button onClick={() => deleteInvestor(inv.id)} className="text-red-500 hover:text-red-700 text-xs font-medium">Delete</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Filings Tab */}
      {activeTab === 'filings' && (
        <div className="space-y-4">
          {!fund.first_sale_date && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
              <strong>Note:</strong> No first sale date set. Filing due dates cannot be computed until you set one. <button onClick={openEditFund} className="underline">Set first sale date.</button>
            </div>
          )}
          {filings.length === 0 ? (
            <div className="card p-8 text-center">
              <p className="text-gray-500 text-sm">No filings yet. Add investors with committed or closed status to auto-generate filing obligations.</p>
            </div>
          ) : (
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="table-th">State</th>
                      <th className="table-th">Investors</th>
                      <th className="table-th">Form</th>
                      <th className="table-th">Due Date</th>
                      <th className="table-th">Status</th>
                      <th className="table-th">Filed Date</th>
                      <th className="table-th">Fee Paid</th>
                      <th className="table-th">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filings.map(f => (
                      <tr key={f.id} className={`hover:bg-gray-50 transition-colors ${f.status === 'overdue' ? 'bg-red-50/30' : ''}`}>
                        <td className="table-td">
                          <div>
                            <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">{f.state_code}</span>
                            {f.state_name && <span className="ml-1 text-xs text-gray-500">{f.state_name}</span>}
                          </div>
                        </td>
                        <td className="table-td text-center">{f.investor_count || 0}</td>
                        <td className="table-td text-xs text-gray-600">{f.form_name || '—'}</td>
                        <td className="table-td">
                          <span className={f.status === 'overdue' ? 'text-red-600 font-medium' : ''}>
                            {formatDate(f.due_date)}
                          </span>
                          {f.due_date_manual === 1 && <span className="ml-1 text-xs text-gray-400">(manual)</span>}
                        </td>
                        <td className="table-td"><StatusBadge status={f.status} /></td>
                        <td className="table-td">{formatDate(f.filed_date)}</td>
                        <td className="table-td">{f.fee_paid != null ? formatCurrency(f.fee_paid) : '—'}</td>
                        <td className="table-td">
                          <div className="flex items-center gap-2">
                            {(f.status === 'pending' || f.status === 'overdue') && (
                              <button
                                onClick={() => markFiled(f)}
                                className="text-xs bg-green-100 text-green-700 hover:bg-green-200 px-2 py-1 rounded font-medium transition-colors"
                              >
                                Mark Filed
                              </button>
                            )}
                            <button onClick={() => openEditFiling(f)} className="text-blue-600 hover:text-blue-800 text-xs font-medium">Edit</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Investor Modal */}
      {showInvModal && (
        <Modal
          title={editingInvestor ? 'Edit Investor' : 'Add Investor'}
          onClose={() => setShowInvModal(false)}
          onConfirm={saveInvestor}
          confirmLabel={savingInv ? 'Saving...' : editingInvestor ? 'Save Changes' : 'Add Investor'}
          confirmDisabled={savingInv || !invForm.name || !invForm.state}
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Full Name *</label>
                <input className="input" value={invForm.name} onChange={e => setInvForm(f => ({ ...f, name: e.target.value }))} placeholder="John Smith" />
              </div>
              <div>
                <label className="label">Entity Name</label>
                <input className="input" value={invForm.entity_name} onChange={e => setInvForm(f => ({ ...f, entity_name: e.target.value }))} placeholder="Smith Family LP" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">State *</label>
                <select className="input" value={invForm.state} onChange={e => setInvForm(f => ({ ...f, state: e.target.value }))}>
                  {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Pipeline Stage *</label>
                <select className="input" value={invForm.pipeline_stage} onChange={e => setInvForm(f => ({ ...f, pipeline_stage: e.target.value }))}>
                  <option value="prospect">Prospect</option>
                  <option value="committed">Committed</option>
                  <option value="closed">Closed</option>
                </select>
              </div>
            </div>
            <div>
              <label className="label">Commitment Amount ($)</label>
              <input type="number" className="input" value={invForm.commitment_amount} onChange={e => setInvForm(f => ({ ...f, commitment_amount: e.target.value }))} placeholder="250000" />
            </div>
            <div className="flex gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="w-4 h-4 rounded" checked={invForm.is_accredited} onChange={e => setInvForm(f => ({ ...f, is_accredited: e.target.checked }))} />
                <span className="text-sm text-gray-700">Accredited Investor</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="w-4 h-4 rounded" checked={invForm.is_qualified_client} onChange={e => setInvForm(f => ({ ...f, is_qualified_client: e.target.checked }))} />
                <span className="text-sm text-gray-700">Qualified Client</span>
              </label>
            </div>
            <div>
              <label className="label">Notes</label>
              <textarea className="input" rows={2} value={invForm.notes} onChange={e => setInvForm(f => ({ ...f, notes: e.target.value }))} placeholder="Internal notes..." />
            </div>
            {(invForm.pipeline_stage === 'committed' || invForm.pipeline_stage === 'closed') && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700">
                A blue sky filing obligation will be auto-generated for <strong>{invForm.state}</strong> if not already tracked.
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Fund Edit Modal */}
      {showFundEdit && (
        <Modal
          title="Edit Fund"
          onClose={() => setShowFundEdit(false)}
          onConfirm={saveFund}
          confirmLabel={savingFund ? 'Saving...' : 'Save Changes'}
          confirmDisabled={savingFund}
        >
          <div className="space-y-4">
            <div>
              <label className="label">Fund Name *</label>
              <input className="input" value={fundForm.name} onChange={e => setFundForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <label className="label">Exemption Type *</label>
              <select className="input" value={fundForm.exemption_type} onChange={e => setFundForm(f => ({ ...f, exemption_type: e.target.value }))}>
                <option value="506b">Rule 506(b)</option>
                <option value="506c">Rule 506(c)</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">First Sale Date</label>
                <input type="date" className="input" value={fundForm.first_sale_date} onChange={e => setFundForm(f => ({ ...f, first_sale_date: e.target.value }))} />
              </div>
              <div>
                <label className="label">Target Raise ($)</label>
                <input type="number" className="input" value={fundForm.target_raise} onChange={e => setFundForm(f => ({ ...f, target_raise: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="label">Status</label>
              <select className="input" value={fundForm.status} onChange={e => setFundForm(f => ({ ...f, status: e.target.value }))}>
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="closed">Closed</option>
              </select>
            </div>
            <div>
              <label className="label">Notes</label>
              <textarea className="input" rows={3} value={fundForm.notes} onChange={e => setFundForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
        </Modal>
      )}

      {/* Filing Edit Modal */}
      {editingFiling && (
        <Modal
          title={`Edit Filing — ${editingFiling.state_code}`}
          onClose={() => setEditingFiling(null)}
          onConfirm={saveFiling}
          confirmLabel={savingFiling ? 'Saving...' : 'Save Changes'}
          confirmDisabled={savingFiling}
        >
          <div className="space-y-4">
            {editingFiling.special_requirements && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
                <strong>Note:</strong> {editingFiling.special_requirements}
              </div>
            )}
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
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Due Date (override)</label>
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
                <input type="number" className="input" value={filingForm.fee_paid} onChange={e => setFilingForm(f => ({ ...f, fee_paid: e.target.value }))} placeholder={editingFiling.fee_amount || ''} />
              </div>
            </div>
            <div>
              <label className="label">Notes</label>
              <textarea className="input" rows={3} value={filingForm.notes} onChange={e => setFilingForm(f => ({ ...f, notes: e.target.value }))} placeholder="Internal notes about this filing..." />
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
