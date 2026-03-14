import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getRun, editAnswer, regenerateAnswer, exportRun } from './api'

function ConfBar({ value }) {
  const pct = Math.round(value * 100)
  const color = pct >= 75 ? 'var(--accent2)' : pct >= 45 ? 'var(--warn)' : 'var(--danger)'
  return (
    <div style={{ display:'flex', alignItems:'center', gap:'0.5rem' }}>
      <div className="conf-bar-wrap"><div className="conf-bar" style={{ width:`${pct}%`, background:color }} /></div>
      <span style={{ fontSize:'0.75rem', color, fontWeight:600, minWidth:30 }}>{pct}%</span>
    </div>
  )
}

export default function Review() {
  const { runId } = useParams()
  const navigate  = useNavigate()

  const [run, setRun]           = useState(null)
  const [loading, setLoading]   = useState(true)
  const [editing, setEditing]   = useState({})    // index → draft text
  const [saving, setSaving]     = useState(null)
  const [regen, setRegen]       = useState(null)
  const [exporting, setExporting] = useState(false)
  const [toast, setToast]       = useState(null)

  useEffect(() => {
    getRun(runId).then(r => setRun(r.data)).finally(() => setLoading(false))
  }, [runId])

  function showToast(msg, type = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  function startEdit(i, currentAnswer) {
    setEditing(prev => ({ ...prev, [i]: currentAnswer }))
  }
  function cancelEdit(i) {
    setEditing(prev => { const n = { ...prev }; delete n[i]; return n })
  }

  async function saveEdit(i) {
    setSaving(i)
    try {
      const res = await editAnswer(runId, i, editing[i])
      setRun(prev => {
        const results = [...prev.results]
        results[i] = { ...results[i], answer: editing[i], edited: true }
        return { ...prev, results, coverage: res.data.coverage }
      })
      cancelEdit(i)
      showToast('Answer saved')
    } catch { showToast('Save failed', 'error') }
    setSaving(null)
  }

  async function handleRegen(i) {
    setRegen(i)
    try {
      const res = await regenerateAnswer(runId, i)
      setRun(prev => {
        const results = [...prev.results]
        results[i] = res.data.result
        return { ...prev, results, coverage: res.data.coverage }
      })
      showToast('Answer regenerated')
    } catch { showToast('Regeneration failed', 'error') }
    setRegen(null)
  }

  async function handleExport() {
    setExporting(true)
    try {
      const res = await exportRun(runId)
      const url = URL.createObjectURL(new Blob([res.data]))
      const a   = document.createElement('a')
      a.href    = url
      a.download = `${run.questionnaire_name?.replace(/\.[^.]+$/, '') || 'answers'}_answered.docx`
      a.click()
      URL.revokeObjectURL(url)
      showToast('Export downloaded!')
    } catch { showToast('Export failed', 'error') }
    setExporting(false)
  }

  if (loading) return (
    <div style={{ display:'flex', justifyContent:'center', alignItems:'center', minHeight:'100vh' }}>
      <span className="spinner" style={{ width:36, height:36, borderWidth:3 }} />
    </div>
  )

  if (!run) return (
    <div style={{ textAlign:'center', padding:'4rem', color:'var(--text-muted)' }}>
      Run not found. <button className="btn-ghost" onClick={() => navigate('/')}>Go Home</button>
    </div>
  )

  const cov = run.coverage || {}
  const pct = cov.total ? Math.round((cov.answered / cov.total) * 100) : 0

  return (
    <div style={s.root}>
      <div style={s.glowBg} />

      {/* Sticky header */}
      <div style={s.header}>
        <button className="btn-ghost" onClick={() => navigate('/')} style={{padding:'0.4rem 0.8rem',fontSize:'0.85rem'}}>← Home</button>
        <div style={{flex:1,minWidth:0}}>
          <h2 style={{fontFamily:'var(--font-display)',fontSize:'1.15rem',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
            {run.questionnaire_name}
          </h2>
          <p style={{color:'var(--text-muted)',fontSize:'0.78rem'}}>Review & Edit before export</p>
        </div>
        <div style={{display:'flex',gap:'0.75rem',alignItems:'center'}}>
          <button className="btn-secondary" onClick={() => navigate(`/results/${runId}`)}>
            📊 View Results
          </button>
          <button className="btn-primary" onClick={handleExport} disabled={exporting}>
            {exporting
              ? <><span className="spinner" style={{width:15,height:15}}/> Exporting…</>
              : '⬇ Export .docx'}
          </button>
        </div>
      </div>

      <div style={s.body}>
        {/* Coverage bar */}
        <div style={s.summaryBanner} className="fade-up">
          <div style={{display:'flex',gap:'1.5rem',flexWrap:'wrap'}}>
            <span style={s.summStat}><b style={{color:'var(--text)'}}>{cov.total}</b> Total</span>
            <span style={s.summStat}><b style={{color:'var(--accent2)'}}>{cov.answered}</b> Answered</span>
            <span style={s.summStat}><b style={{color:'var(--danger)'}}>{cov.not_found}</b> Not Found</span>
            <span style={s.summStat}><b style={{color:'var(--accent)'}}>{pct}%</b> Coverage</span>
          </div>
          <div style={s.bigBar}>
            <div style={{...s.bigBarFill, width:`${pct}%`}} />
          </div>
        </div>

        {/* Edit instructions */}
        <p style={{color:'var(--text-muted)',fontSize:'0.85rem',marginBottom:'1.5rem'}}>
          Click <b>Edit</b> to modify any answer, or <b>Regenerate</b> to re-run AI for a single question. Export when ready.
        </p>

        {/* Question cards */}
        <div style={s.list}>
          {run.results.map((item, i) => {
            const isEditing = i in editing
            const isRegen   = regen === i
            const notFound  = item.answer === 'Not found in references.'

            return (
              <div key={i} style={{
                ...s.card,
                borderColor: isEditing ? 'var(--accent)' : item.edited ? 'rgba(247,201,74,0.3)' : 'var(--border)'
              }} className="fade-up">

                {/* Q header */}
                <div style={s.qHeader}>
                  <span style={s.qNum}>Q{i+1}</span>
                  <p style={s.qText}>{item.question}</p>
                  <div style={{display:'flex',gap:'0.4rem',flexShrink:0}}>
                    {item.edited && <span className="badge badge-warn">Edited</span>}
                    {notFound
                      ? <span className="badge badge-danger">Not Found</span>
                      : <span className="badge badge-success">Answered</span>
                    }
                  </div>
                </div>

                {/* Answer / Edit area */}
                {isEditing ? (
                  <div style={{marginTop:'0.75rem'}}>
                    <textarea
                      value={editing[i]}
                      onChange={e => setEditing(prev => ({ ...prev, [i]: e.target.value }))}
                      rows={5}
                      style={{resize:'vertical'}}
                    />
                    <div style={{display:'flex',gap:'0.6rem',marginTop:'0.6rem'}}>
                      <button className="btn-primary" style={{padding:'0.55rem 1.2rem',fontSize:'0.85rem'}}
                        onClick={() => saveEdit(i)} disabled={saving === i}>
                        {saving === i ? <><span className="spinner" style={{width:14,height:14}}/> Saving…</> : '✓ Save'}
                      </button>
                      <button className="btn-secondary" onClick={() => cancelEdit(i)} style={{fontSize:'0.85rem'}}>
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={s.answerBox}>
                    <p style={{fontSize:'0.9rem', lineHeight:1.65, color: notFound ? 'var(--text-dim)' : 'var(--text)'}}>
                      {item.answer}
                    </p>
                  </div>
                )}

                {/* Meta + actions */}
                {!isEditing && (
                  <div style={s.metaRow}>
                    {!notFound && (
                      <>
                        <div style={s.citationTag}>
                          <span style={{fontSize:'0.75rem',color:'var(--text-muted)'}}>📎</span>
                          <span style={{fontSize:'0.8rem',color:'var(--accent)'}}>{item.citation}</span>
                        </div>
                        <div style={s.confWrap}>
                          <span style={{fontSize:'0.75rem',color:'var(--text-muted)',whiteSpace:'nowrap'}}>Confidence</span>
                          <ConfBar value={item.confidence || 0} />
                        </div>
                      </>
                    )}
                    <div style={{marginLeft:'auto',display:'flex',gap:'0.5rem'}}>
                      <button className="btn-ghost" style={{fontSize:'0.78rem',padding:'0.3rem 0.8rem'}}
                        onClick={() => startEdit(i, item.answer)}>
                        ✏ Edit
                      </button>
                      <button className="btn-secondary" style={{fontSize:'0.78rem',padding:'0.3rem 0.8rem'}}
                        onClick={() => handleRegen(i)} disabled={isRegen}>
                        {isRegen ? <><span className="spinner" style={{width:12,height:12}}/></> : '↺ Regen'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Bottom export */}
        <div style={s.exportFooter}>
          <p style={{color:'var(--text-muted)',fontSize:'0.875rem'}}>
            All edits are saved automatically. Export a .docx with all questions, answers, and citations.
          </p>
          <button className="btn-primary" onClick={handleExport} disabled={exporting}
            style={{padding:'0.85rem 2rem',fontSize:'1rem'}}>
            {exporting ? <><span className="spinner" style={{width:18,height:18}}/> Exporting…</> : '⬇ Export Answered Questionnaire'}
          </button>
        </div>
      </div>

      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  )
}

const s = {
  root: { minHeight:'100vh', position:'relative' },
  glowBg: {
    position:'fixed', bottom:'20%', right:'5%', width:450, height:450,
    background:'radial-gradient(circle, rgba(124,106,247,0.07) 0%, transparent 70%)',
    pointerEvents:'none',
  },
  header: {
    display:'flex', alignItems:'center', gap:'1rem',
    padding:'1.25rem 2rem',
    borderBottom:'1px solid var(--border)',
    background:'rgba(10,10,15,0.85)',
    backdropFilter:'blur(12px)',
    position:'sticky', top:0, zIndex:10,
  },
  body: { maxWidth:900, margin:'0 auto', padding:'2.5rem 2rem' },
  summaryBanner: {
    background:'linear-gradient(135deg,rgba(124,106,247,0.08),rgba(74,240,196,0.04))',
    border:'1px solid rgba(124,106,247,0.2)',
    borderRadius:'var(--radius-lg)',
    padding:'1.25rem 1.5rem',
    marginBottom:'1.5rem',
    display:'flex', flexDirection:'column', gap:'0.85rem',
  },
  summStat: { fontSize:'0.88rem', color:'var(--text-muted)' },
  bigBar: { height:5, background:'var(--bg3)', borderRadius:3, overflow:'hidden' },
  bigBarFill: { height:'100%', background:'linear-gradient(90deg,var(--accent),var(--accent2))', borderRadius:3, transition:'width 0.6s ease' },
  list: { display:'flex', flexDirection:'column', gap:'1rem' },
  card: {
    background:'var(--bg2)', borderRadius:'var(--radius-lg)',
    border:'1px solid var(--border)', padding:'1.25rem',
    transition:'border-color 0.2s',
  },
  qHeader: { display:'flex', alignItems:'flex-start', gap:'0.7rem' },
  qNum: {
    fontFamily:'var(--font-display)', fontWeight:700, fontSize:'0.72rem',
    color:'var(--accent)', background:'var(--accent-glow)',
    border:'1px solid rgba(124,106,247,0.25)',
    borderRadius:6, padding:'0.2rem 0.5rem', whiteSpace:'nowrap', flexShrink:0,
  },
  qText: { flex:1, fontWeight:600, fontSize:'0.92rem', lineHeight:1.5 },
  answerBox: {
    background:'var(--bg3)', borderRadius:8,
    padding:'0.9rem 1rem', marginTop:'0.75rem', marginBottom:'0.75rem',
  },
  metaRow: { display:'flex', alignItems:'center', gap:'1rem', flexWrap:'wrap' },
  citationTag: { display:'flex', alignItems:'center', gap:'0.35rem' },
  confWrap: { display:'flex', alignItems:'center', gap:'0.5rem', flex:1, minWidth:150, maxWidth:220 },
  exportFooter: {
    marginTop:'3rem', paddingTop:'2rem',
    borderTop:'1px solid var(--border)',
    display:'flex', flexDirection:'column', alignItems:'center', gap:'1.25rem', textAlign:'center',
  },
}
