import { useState, useEffect } from 'react'
import Modal from '../components/Modal'
import StatusBadge from '../components/StatusBadge'

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

const EMPTY_FORM = {
  name: '', entity_name: '', state: 'CA', pipeline_stage: 'prospect',
  commitment_amount: '', is_accredited: true, is_qualified_client: false, notes: ''
}

export default function InvestorPipeline({ fundId, fundExemptionType, onUpdate }) {
  const [investors, setInvestors] = useState([])
  const [loading, setLoading] = useState(true)
  const [stageFilter, setStageFilter] = useState('all')
  const [showModal, setShowModal] = useState(false)
  const [editingInvestor, setEditingInvestor] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  const load = () => {
    if (!fundId) return
    fetch(`/api/investors?fund_id=${fundId}`)
      .then(r => r.json())
      .then(data => setInvestors(data.investors || []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [fundId])

  const openAdd = () => {
    setEditingInvestor(null)
    setForm(EMPTY_FORM)
    setShowModal(true)
  }
  const openEdit = (inv) => {
    setEditingInvestor(inv)
    setForm({
      name: inv.name, entity_name: inv.entity_name || '', state: inv.state,
      pipeline_stage: inv.pipeline_stage, commitment_amount: inv.commitment_amount || '',
      is_accredited: !!inv.is_accredited, is_qualified_client: !!inv.is_qualified_client,
      notes: inv.notes || ''
    })
    setShowModal(true)
  }

  const save = async () => {
    setSaving(true)
    try {
      const body = {
        ...form, fund_id: fundId,
        commitment_amount: form.commitment_amount ? parseFloat(form.commitment_amount) : null,
        is_accredited: form.is_accredited ? 1 : 0,
        is_qualified_client: form.is_qualified_client ? 1 : 0,
      }
      const url = editingInvestor ? `/api/investors/${editingInvestor.id}` : '/api/investors'
      const method = editingInvestor ? 'PUT' : 'POST'
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (!res.ok) throw new Error((await res.json()).error)
      setShowModal(false)
      load()
      if (onUpdate) onUpdate()
    } catch (err) { alert('Error: ' + err.message) }
    finally { setSaving(false) }
  }

  const deleteInvestor = async (id) => {
    if (!confirm('Delete this investor?')) return
    await fetch(`/api/investors/${id}`, { method: 'DELETE' })
    load()
    if (onUpdate) onUpdate()
  }

  const filtered = stageFilter === 'all' ? investors : investors.filter(i => i.pipeline_stage === stageFilter)

  if (loading) return <div className="text-gray-400 text-sm p-4">Loading investors...</div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {['all', 'prospect', 'committed', 'closed'].map(s => (
            <button
              key={s}
              onClick={() => setStageFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${stageFilter === s ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
              {s !== 'all' && <span className="ml-1 opacity-75">({investors.filter(i => i.pipeline_stage === s).length})</span>}
            </button>
          ))}
        </div>
        <button onClick={openAdd} className="btn-primary btn-sm">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Investor
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="card p-6 text-center text-gray-400 text-sm">
          No investors found. <button onClick={openAdd} className="text-blue-600 hover:underline">Add one.</button>
        </div>
      ) : (
        <div className="card overflow-hidden">
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
              {filtered.map(inv => (
                <tr key={inv.id} className="hover:bg-gray-50 transition-colors">
                  <td className="table-td font-medium text-gray-900">{inv.name}</td>
                  <td className="table-td text-gray-500 text-xs">{inv.entity_name || '—'}</td>
                  <td className="table-td">
                    <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">{inv.state}</span>
                  </td>
                  <td className="table-td"><StatusBadge status={inv.pipeline_stage} /></td>
                  <td className="table-td">{formatCurrency(inv.commitment_amount)}</td>
                  <td className="table-td">
                    {inv.is_accredited
                      ? <span className="text-green-600 text-xs font-medium">Yes</span>
                      : <span className="text-red-600 text-xs font-medium">No</span>
                    }
                  </td>
                  <td className="table-td max-w-xs truncate text-gray-400 text-xs">{inv.notes || '—'}</td>
                  <td className="table-td">
                    <div className="flex gap-2">
                      <button onClick={() => openEdit(inv)} className="text-blue-600 hover:text-blue-800 text-xs font-medium">Edit</button>
                      <button onClick={() => deleteInvestor(inv.id)} className="text-red-500 hover:text-red-700 text-xs font-medium">Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <Modal
          title={editingInvestor ? 'Edit Investor' : 'Add Investor'}
          onClose={() => setShowModal(false)}
          onConfirm={save}
          confirmLabel={saving ? 'Saving...' : editingInvestor ? 'Save' : 'Add'}
          confirmDisabled={saving || !form.name}
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Name *</label>
                <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label className="label">Entity Name</label>
                <input className="input" value={form.entity_name} onChange={e => setForm(f => ({ ...f, entity_name: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">State *</label>
                <select className="input" value={form.state} onChange={e => setForm(f => ({ ...f, state: e.target.value }))}>
                  {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Stage</label>
                <select className="input" value={form.pipeline_stage} onChange={e => setForm(f => ({ ...f, pipeline_stage: e.target.value }))}>
                  <option value="prospect">Prospect</option>
                  <option value="committed">Committed</option>
                  <option value="closed">Closed</option>
                </select>
              </div>
            </div>
            <div>
              <label className="label">Commitment Amount ($)</label>
              <input type="number" className="input" value={form.commitment_amount} onChange={e => setForm(f => ({ ...f, commitment_amount: e.target.value }))} />
            </div>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input type="checkbox" className="w-4 h-4" checked={form.is_accredited} onChange={e => setForm(f => ({ ...f, is_accredited: e.target.checked }))} />
                Accredited Investor
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input type="checkbox" className="w-4 h-4" checked={form.is_qualified_client} onChange={e => setForm(f => ({ ...f, is_qualified_client: e.target.checked }))} />
                Qualified Client
              </label>
            </div>
            <div>
              <label className="label">Notes</label>
              <textarea className="input" rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
