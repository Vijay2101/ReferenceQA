import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getRun } from './api'

function ConfBar({ value }) {
  const pct = Math.round(value * 100)
  const color = pct >= 75 ? 'var(--accent2)' : pct >= 45 ? 'var(--warn)' : 'var(--danger)'
  return (
    <div style={{ display:'flex', alignItems:'center', gap:'0.6rem' }}>
      <div className="conf-bar-wrap">
        <div className="conf-bar" style={{ width:`${pct}%`, background:color }} />
      </div>
      <span style={{ fontSize:'0.78rem', color, fontWeight:600, minWidth:32 }}>{pct}%</span>
    </div>
  )
}

export default function Results() {
  const { runId } = useParams()
  const navigate  = useNavigate()
  const [run, setRun]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState({})

  useEffect(() => {
    getRun(runId)
      .then(r => setRun(r.data))
      .finally(() => setLoading(false))
  }, [runId])

  function toggleExpand(i) {
    setExpanded(prev => ({ ...prev, [i]: !prev[i] }))
  }

  if (loading) return (
    <div style={{ display:'flex', justifyContent:'center', alignItems:'center', minHeight:'100vh' }}>
      <div style={{ textAlign:'center' }}>
        <span className="spinner" style={{ width:32, height:32, borderWidth:3 }} />
        <p style={{ color:'var(--text-muted)', marginTop:'1rem' }}>Loading results…</p>
      </div>
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

      {/* Header */}
      <div style={s.header}>
        <button className="btn-ghost" onClick={() => navigate('/')} style={{padding:'0.4rem 0.8rem',fontSize:'0.85rem'}}>← Home</button>
        <div style={{flex:1}}>
          <h2 style={{fontFamily:'var(--font-display)',fontSize:'1.2rem'}}>{run.questionnaire_name}</h2>
          <p style={{color:'var(--text-muted)',fontSize:'0.8rem'}}>
            {new Date(run.created_at).toLocaleString()}
          </p>
        </div>
        <button className="btn-primary" onClick={() => navigate(`/review/${runId}`)}>
          Review & Export →
        </button>
      </div>

      <div style={s.body}>
        {/* Coverage summary */}
        <div style={s.coverageCard} className="fade-up">
          <h3 style={{marginBottom:'1.25rem',fontFamily:'var(--font-display)'}}>📊 Coverage Summary</h3>
          <div style={s.coverageGrid}>
            <div style={s.statBox}>
              <span style={s.statNum}>{cov.total}</span>
              <span style={s.statLabel}>Total Questions</span>
            </div>
            <div style={s.statBox}>
              <span style={{...s.statNum, color:'var(--accent2)'}}>{cov.answered}</span>
              <span style={s.statLabel}>Answered</span>
            </div>
            <div style={s.statBox}>
              <span style={{...s.statNum, color:'var(--danger)'}}>{cov.not_found}</span>
              <span style={s.statLabel}>Not Found</span>
            </div>
            <div style={s.statBox}>
              <span style={{...s.statNum, color:'var(--accent)'}}>{pct}%</span>
              <span style={s.statLabel}>Coverage</span>
            </div>
          </div>
          <div style={s.bigBar}>
            <div style={{...s.bigBarFill, width:`${pct}%`}} />
          </div>
        </div>

        {/* Results table */}
        <div style={{marginTop:'2rem'}}>
          <h3 style={{fontFamily:'var(--font-display)',marginBottom:'1rem'}}>Questions & Answers</h3>
          <div style={s.resultsList}>
            {run.results.map((item, i) => {
              const notFound = item.answer === 'Not found in references.'
              const isExpanded = expanded[i]
              return (
                <div key={i} style={s.resultCard} className="fade-up">
                  {/* Question */}
                  <div style={s.qRow}>
                    <span style={s.qNum}>Q{i+1}</span>
                    <p style={s.qText}>{item.question}</p>
                    {item.edited && <span className="badge badge-warn">Edited</span>}
                    {notFound
                      ? <span className="badge badge-danger">Not Found</span>
                      : <span className="badge badge-success">Answered</span>
                    }
                  </div>

                  {/* Answer */}
                  <div style={s.answerBox}>
                    <p style={{color: notFound ? 'var(--text-dim)' : 'var(--text)', lineHeight:1.6, fontSize:'0.9rem'}}>
                      {item.answer}
                    </p>
                  </div>

                  {/* Meta row */}
                  {!notFound && (
                    <div style={s.metaRow}>
                      <div style={s.citationBox}>
                        <span style={s.metaLabel}>📎</span>
                        <span style={{fontSize:'0.82rem',color:'var(--accent)'}}>{item.citation}</span>
                      </div>
                      <div style={s.confBox}>
                        <span style={s.metaLabel}>Confidence</span>
                        <ConfBar value={item.confidence || 0} />
                      </div>
                    </div>
                  )}

                  {/* Evidence snippets */}
                  {item.snippets?.length > 0 && (
                    <div>
                      <button className="btn-ghost" style={{fontSize:'0.78rem',padding:'0.3rem 0.6rem',marginTop:'0.5rem'}}
                        onClick={() => toggleExpand(i)}>
                        {isExpanded ? '▲ Hide' : '▼ Show'} evidence snippets
                      </button>
                      {isExpanded && (
                        <div style={s.snippets}>
                          {item.snippets.map((sn, si) => (
                            <div key={si} style={s.snippet}>
                              <span style={s.snippetSrc}>{sn.source}</span>
                              <p style={s.snippetText}>"{sn.text}…"</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

const s = {
  root: { minHeight:'100vh', position:'relative' },
  glowBg: {
    position:'fixed', top:'30%', left:'5%', width:500, height:500,
    background:'radial-gradient(circle, rgba(124,106,247,0.07) 0%, transparent 70%)',
    pointerEvents:'none',
  },
  header: {
    display:'flex', alignItems:'center', gap:'1.25rem',
    padding:'1.25rem 2rem',
    borderBottom:'1px solid var(--border)',
    background:'rgba(10,10,15,0.85)',
    backdropFilter:'blur(12px)',
    position:'sticky', top:0, zIndex:10,
  },
  body: { maxWidth:900, margin:'0 auto', padding:'2.5rem 2rem' },

  coverageCard: {
    background:'linear-gradient(135deg, rgba(124,106,247,0.08) 0%, rgba(74,240,196,0.04) 100%)',
    border:'1px solid rgba(124,106,247,0.2)',
    borderRadius:'var(--radius-lg)',
    padding:'1.75rem',
  },
  coverageGrid: { display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'1rem', marginBottom:'1.25rem' },
  statBox: { display:'flex', flexDirection:'column', alignItems:'center', gap:'0.25rem' },
  statNum: { fontFamily:'var(--font-display)', fontSize:'2rem', fontWeight:800, lineHeight:1 },
  statLabel: { fontSize:'0.75rem', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.05em' },
  bigBar: { height:6, background:'var(--bg3)', borderRadius:3, overflow:'hidden' },
  bigBarFill: { height:'100%', background:'linear-gradient(90deg, var(--accent), var(--accent2))', borderRadius:3, transition:'width 0.8s ease' },

  resultsList: { display:'flex', flexDirection:'column', gap:'1rem' },
  resultCard: {
    background:'var(--bg2)', border:'1px solid var(--border)',
    borderRadius:'var(--radius-lg)', padding:'1.25rem',
    transition:'border-color 0.2s',
  },
  qRow: { display:'flex', alignItems:'flex-start', gap:'0.75rem', marginBottom:'0.75rem' },
  qNum: {
    fontFamily:'var(--font-display)', fontWeight:700, fontSize:'0.75rem',
    color:'var(--accent)', background:'var(--accent-glow)',
    border:'1px solid rgba(124,106,247,0.25)',
    borderRadius:6, padding:'0.2rem 0.55rem', whiteSpace:'nowrap',
  },
  qText: { flex:1, fontWeight:600, fontSize:'0.92rem', lineHeight:1.5 },
  answerBox: { background:'var(--bg3)', borderRadius:8, padding:'0.9rem 1rem', marginBottom:'0.75rem' },
  metaRow: { display:'flex', alignItems:'center', gap:'1.5rem', flexWrap:'wrap' },
  citationBox: { display:'flex', alignItems:'center', gap:'0.4rem' },
  confBox: { display:'flex', alignItems:'center', gap:'0.6rem', flex:1, minWidth:160 },
  metaLabel: { fontSize:'0.78rem', color:'var(--text-muted)', whiteSpace:'nowrap' },
  snippets: { display:'flex', flexDirection:'column', gap:'0.5rem', marginTop:'0.6rem' },
  snippet: { background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:8, padding:'0.75rem 1rem' },
  snippetSrc: { fontSize:'0.72rem', fontWeight:700, color:'var(--accent2)', textTransform:'uppercase', letterSpacing:'0.05em', display:'block', marginBottom:'0.3rem' },
  snippetText: { fontSize:'0.82rem', color:'var(--text-muted)', lineHeight:1.5, fontStyle:'italic' },
}
