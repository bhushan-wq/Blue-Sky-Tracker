import { useState, useEffect, useRef } from 'react'

function formatCurrency(n) {
  if (n == null || n === '') return '—'
  if (n === 0) return '$0'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

function isStale(dateStr) {
  if (!dateStr) return true
  const d = new Date(dateStr)
  const oneYearAgo = new Date()
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)
  return d < oneYearAgo
}

function EditableCell({ value, onSave, type = 'text', options, className = '' }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(value ?? '')
  const inputRef = useRef()

  useEffect(() => { setVal(value ?? '') }, [value])
  useEffect(() => { if (editing && inputRef.current) inputRef.current.focus() }, [editing])

  const commit = () => {
    setEditing(false)
    if (val !== (value ?? '')) onSave(val)
  }
  const handleKey = (e) => {
    if (e.key === 'Enter') commit()
    if (e.key === 'Escape') { setVal(value ?? ''); setEditing(false) }
  }

  if (editing) {
    if (options) {
      return (
        <select
          ref={inputRef}
          className="input text-xs py-1 px-2"
          value={val}
          onChange={e => setVal(e.target.value)}
          onBlur={commit}
          onKeyDown={handleKey}
        >
          {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      )
    }
    return (
      <input
        ref={inputRef}
        type={type}
        className="input text-xs py-1 px-2"
        value={val}
        onChange={e => setVal(e.target.value)}
        onBlur={commit}
        onKeyDown={handleKey}
      />
    )
  }

  return (
    <span
      className={`cursor-pointer hover:bg-blue-50 hover:text-blue-700 px-1 py-0.5 rounded transition-colors ${className}`}
      title="Click to edit"
      onClick={() => setEditing(true)}
    >
      {val !== '' && val != null ? String(val) : <span className="text-gray-300">—</span>}
    </span>
  )
}

export default function StateRulesRef() {
  const [rules, setRules] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filingFilter, setFilingFilter] = useState('all')
  const [saving, setSaving] = useState({})

  useEffect(() => {
    fetch('/api/state-rules')
      .then(r => r.json())
      .then(data => setRules(Array.isArray(data) ? data : []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const updateRule = async (id, field, value) => {
    setSaving(s => ({ ...s, [id]: true }))
    try {
      const res = await fetch(`/api/state-rules/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value })
      })
      if (!res.ok) throw new Error((await res.json()).error)
      const updated = await res.json()
      setRules(rs => rs.map(r => r.id === id ? updated : r))
    } catch (err) {
      alert('Error saving: ' + err.message)
    } finally {
      setSaving(s => ({ ...s, [id]: false }))
    }
  }

  const exportCSV = () => {
    const headers = ['State Code','State Name','Exemption Type','Filing Required','Form Name','Filing Method','Deadline Days','Fee Amount','Fee Structure','Special Requirements','Last Verified']
    const rows = rules.map(r => [
      r.state_code, r.state_name, r.exemption_type,
      r.filing_required ? 'Yes' : 'No',
      r.form_name || '', r.filing_method || '',
      r.deadline_days ?? '', r.fee_amount ?? '',
      r.fee_structure || '', (r.special_requirements || '').replace(/,/g, ';'),
      r.last_verified || ''
    ])
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'blue-sky-state-rules.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  const filtered = rules.filter(r => {
    const matchSearch = !search ||
      r.state_name.toLowerCase().includes(search.toLowerCase()) ||
      r.state_code.toLowerCase().includes(search.toLowerCase())
    const matchFiling = filingFilter === 'all' ||
      (filingFilter === 'required' && r.filing_required) ||
      (filingFilter === 'not_required' && !r.filing_required)
    return matchSearch && matchFiling
  })

  const staleCount = rules.filter(r => isStale(r.last_verified)).length

  if (loading) return <div className="text-gray-400 text-sm p-8">Loading state rules...</div>

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">State Rules Reference</h1>
          <p className="text-sm text-gray-500 mt-1">
            All 51 jurisdictions — Reg D 506(b) & 506(c) notice filing requirements.
            Click any cell to edit inline.
          </p>
        </div>
        <button onClick={exportCSV} className="btn-secondary btn-sm">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Export CSV
        </button>
      </div>

      {staleCount > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center gap-3 text-sm text-amber-800">
          <svg className="w-5 h-5 text-amber-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.96-.833-2.73 0L4.07 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <span>
            <strong>{staleCount} state rule{staleCount !== 1 ? 's' : ''}</strong> have not been verified in over 1 year.
            Always confirm current requirements with each state's securities regulator or legal counsel.
          </span>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            className="input pl-9"
            placeholder="Search states..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          {[['all','All States'], ['required','Filing Required'], ['not_required','No Filing']].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFilingFilter(key)}
              className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${filingFilter === key ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
            >
              {label}
            </button>
          ))}
        </div>
        <span className="text-xs text-gray-400">{filtered.length} of {rules.length} states</span>
      </div>

      {/* Disclaimer */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700">
        <strong>Disclaimer:</strong> This reference data is provided for informational purposes only and was last verified January 2024.
        State securities laws change frequently. Always verify current requirements with a qualified securities attorney or each state's securities regulator before filing.
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="table-th whitespace-nowrap">State</th>
                <th className="table-th whitespace-nowrap">Exemption</th>
                <th className="table-th whitespace-nowrap">Filing Req.</th>
                <th className="table-th whitespace-nowrap">Form Name</th>
                <th className="table-th whitespace-nowrap">Method</th>
                <th className="table-th whitespace-nowrap">Deadline</th>
                <th className="table-th whitespace-nowrap">Fee</th>
                <th className="table-th whitespace-nowrap">Last Verified</th>
                <th className="table-th whitespace-nowrap">Special Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(r => (
                <tr
                  key={r.id}
                  className={`hover:bg-gray-50 transition-colors ${saving[r.id] ? 'opacity-60' : ''}`}
                >
                  <td className="table-td">
                    <div>
                      <span className="font-mono font-semibold text-xs bg-slate-100 px-2 py-0.5 rounded">{r.state_code}</span>
                      <div className="text-gray-700 mt-0.5 font-medium">{r.state_name}</div>
                    </div>
                  </td>
                  <td className="table-td">
                    <EditableCell
                      value={r.exemption_type}
                      onSave={v => updateRule(r.id, 'exemption_type', v)}
                      options={[
                        { value: 'both', label: 'Both' },
                        { value: '506b', label: '506(b)' },
                        { value: '506c', label: '506(c)' },
                      ]}
                    />
                  </td>
                  <td className="table-td">
                    <button
                      onClick={() => updateRule(r.id, 'filing_required', r.filing_required ? 0 : 1)}
                      className={`px-2 py-0.5 rounded-full text-xs font-medium transition-colors ${
                        r.filing_required
                          ? 'bg-red-100 text-red-700 hover:bg-red-200'
                          : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                      }`}
                      title="Click to toggle"
                    >
                      {r.filing_required ? 'Required' : 'Not Required'}
                    </button>
                  </td>
                  <td className="table-td max-w-32">
                    <EditableCell
                      value={r.form_name}
                      onSave={v => updateRule(r.id, 'form_name', v)}
                      className="text-xs"
                    />
                  </td>
                  <td className="table-td max-w-36">
                    <EditableCell
                      value={r.filing_method}
                      onSave={v => updateRule(r.id, 'filing_method', v)}
                      className="text-xs"
                    />
                  </td>
                  <td className="table-td whitespace-nowrap">
                    <EditableCell
                      value={r.deadline_days}
                      onSave={v => updateRule(r.id, 'deadline_days', v === '' ? null : parseInt(v))}
                      type="number"
                      className="text-xs"
                    />
                    {r.deadline_days != null && <span className="text-gray-400 ml-0.5">days</span>}
                  </td>
                  <td className="table-td whitespace-nowrap">
                    <EditableCell
                      value={r.fee_amount}
                      onSave={v => updateRule(r.id, 'fee_amount', v === '' ? null : parseFloat(v))}
                      type="number"
                      className="text-xs"
                    />
                    {r.fee_amount != null && r.fee_amount > 0 && <span className="text-gray-400 ml-0.5">USD</span>}
                  </td>
                  <td className="table-td whitespace-nowrap">
                    <div className="flex items-center gap-1">
                      {isStale(r.last_verified) && (
                        <svg className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.96-.833-2.73 0L4.07 16.5c-.77.833.192 2.5 1.732 2.5z" />
                        </svg>
                      )}
                      <EditableCell
                        value={r.last_verified}
                        onSave={v => updateRule(r.id, 'last_verified', v)}
                        type="date"
                        className={`text-xs ${isStale(r.last_verified) ? 'text-amber-600' : 'text-gray-600'}`}
                      />
                    </div>
                  </td>
                  <td className="table-td max-w-48">
                    <EditableCell
                      value={r.special_requirements}
                      onSave={v => updateRule(r.id, 'special_requirements', v)}
                      className="text-xs text-gray-500"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
