import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  listQuestionnaires, listDocuments, uploadQuestionnaire,
  generateAnswers, listRuns
} from './api'

export default function Dashboard() {
  const navigate = useNavigate()
  const user = JSON.parse(localStorage.getItem('user') || '{}')

  const [questionnaires, setQuestionnaires] = useState([])
  const [documents, setDocuments]           = useState([])
  const [runs, setRuns]                     = useState([])
  const [qFile, setQFile]                   = useState(null)
  const [uploading, setUploading]           = useState(false)
  const [generating, setGenerating]         = useState(null)
  const [toast, setToast]                   = useState(null)
  const [loading, setLoading]               = useState(true)

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    try {
      const [qs, docs, rs] = await Promise.all([
        listQuestionnaires(), listDocuments(), listRuns()
      ])
      setQuestionnaires(qs.data)
      setDocuments(docs.data)
      setRuns(rs.data)
    } catch {}
    setLoading(false)
  }

  function showToast(msg, type = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  async function handleUploadQ() {
    if (!qFile) return
    setUploading(true)
    try {
      await uploadQuestionnaire(qFile)
      showToast('Questionnaire uploaded!')
      setQFile(null)
      fetchAll()
    } catch (err) {
      showToast(err?.response?.data?.detail || 'Upload failed', 'error')
    }
    setUploading(false)
  }

  async function handleGenerate(qId) {
    if (documents.length === 0) {
      showToast('Upload reference documents first', 'error'); return
    }
    setGenerating(qId)
    try {
      const res = await generateAnswers(qId)
      showToast('Answers generated!')
      navigate(`/review/${res.data.run_id}`)
    } catch (err) {
      showToast(err?.response?.data?.detail || 'Generation failed', 'error')
    }
    setGenerating(null)
  }

  function logout() {
    localStorage.clear()
    navigate('/login')
  }

  return (
    <div style={s.root}>
      {/* Background */}
      <div style={s.glowTop} />

      {/* Navbar */}
      <nav style={s.nav}>
        <div style={s.navLogo}>
          <svg width="28" height="28" viewBox="0 0 36 36" fill="none">
            <rect width="36" height="36" rx="10" fill="#7c6af7" fillOpacity="0.15"/>
            <path d="M8 18 L18 8 L28 18 L18 28 Z" stroke="#7c6af7" strokeWidth="1.5" fill="none"/>
            <circle cx="18" cy="18" r="4" fill="#7c6af7"/>
            <circle cx="18" cy="8" r="2" fill="#4af0c4"/>
          </svg>
          <span style={s.navBrand}>QueryFlow AI</span>
        </div>
        <div style={s.navRight}>
          <span style={s.navUser}>{user.name || user.email}</span>
          <button className="btn-secondary" onClick={logout} style={{padding:'0.5rem 1rem',fontSize:'0.85rem'}}>Logout</button>
        </div>
      </nav>

      <div style={s.body}>
        {/* Hero */}
        <div style={s.hero} className="fade-up">
          <span className="badge badge-accent" style={{marginBottom:'1rem'}}>AI-Powered</span>
          <h1 style={s.heroTitle}>Questionnaire<br/>Answering Tool</h1>
          <p style={s.heroSub}>Upload questionnaires, add reference docs, and let AI answer everything — grounded with citations.</p>
        </div>

        <div style={s.grid}>
          {/* Left column */}
          <div style={s.col}>

            {/* Upload questionnaire */}
            <div className="card fade-up" style={{animationDelay:'0.05s'}}>
              <div style={s.cardHeader}>
                <span style={s.cardIcon}>📋</span>
                <h3>Upload Questionnaire</h3>
              </div>
              <p style={s.cardDesc}>PDF, Excel, or plain text. The system will parse individual questions automatically.</p>
              <div style={s.uploadArea}
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); setQFile(e.dataTransfer.files[0]) }}
              >
                {qFile
                  ? <><span style={{fontSize:'1.5rem'}}>📄</span><span style={{color:'var(--text)',fontSize:'0.9rem'}}>{qFile.name}</span></>
                  : <><span style={{fontSize:'1.5rem'}}>⬆️</span><span style={{color:'var(--text-muted)',fontSize:'0.9rem'}}>Drop file here or click to select</span></>
                }
                <input type="file" accept=".pdf,.xlsx,.xls,.txt,.csv"
                  style={s.fileInput}
                  onChange={e => setQFile(e.target.files[0])}
                />
              </div>
              <button className="btn-primary" style={{width:'100%',marginTop:'0.75rem'}}
                onClick={handleUploadQ} disabled={!qFile || uploading}
              >
                {uploading ? <><span className="spinner" style={{width:16,height:16}}/> Uploading…</> : 'Upload Questionnaire'}
              </button>
            </div>

            {/* Reference docs card */}
            <div className="card fade-up" style={{animationDelay:'0.1s'}}>
              <div style={s.cardHeader}>
                <span style={s.cardIcon}>📚</span>
                <h3>Reference Documents</h3>
                <span className="badge badge-success" style={{marginLeft:'auto'}}>{documents.length} docs</span>
              </div>
              <p style={s.cardDesc}>These are your source-of-truth documents. Answers will be grounded to these.</p>
              {documents.length > 0
                ? <ul style={s.docList}>
                    {documents.slice(0,5).map(d => (
                      <li key={d._id} style={s.docItem}>
                        <span style={{fontSize:'0.85rem'}}>📄</span>
                        <span style={{fontSize:'0.85rem',color:'var(--text-muted)',flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{d.filename}</span>
                      </li>
                    ))}
                    {documents.length > 5 && <li style={{fontSize:'0.8rem',color:'var(--text-dim)',paddingTop:'0.25rem'}}>+{documents.length - 5} more</li>}
                  </ul>
                : <p style={{fontSize:'0.85rem',color:'var(--text-dim)',margin:'0.5rem 0'}}>No documents yet.</p>
              }
              <button className="btn-secondary" style={{width:'100%',marginTop:'0.75rem'}} onClick={() => navigate('/upload')}>
                Manage Documents →
              </button>
            </div>
          </div>

          {/* Right column */}
          <div style={s.col}>
            {/* Questionnaires list */}
            <div className="card fade-up" style={{animationDelay:'0.15s'}}>
              <div style={s.cardHeader}>
                <span style={s.cardIcon}>🗂</span>
                <h3>My Questionnaires</h3>
                <span className="badge badge-accent" style={{marginLeft:'auto'}}>{questionnaires.length}</span>
              </div>
              {loading
                ? <div style={{display:'flex',justifyContent:'center',padding:'2rem'}}><span className="spinner"/></div>
                : questionnaires.length === 0
                  ? <p style={{color:'var(--text-dim)',fontSize:'0.9rem',padding:'1rem 0'}}>No questionnaires uploaded yet.</p>
                  : <div style={s.qList}>
                      {questionnaires.map(q => (
                        <div key={q._id} style={s.qItem}>
                          <div style={{flex:1,minWidth:0}}>
                            <p style={{fontWeight:600,fontSize:'0.92rem',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{q.filename}</p>
                            <p style={{fontSize:'0.8rem',color:'var(--text-muted)'}}>{q.question_count} questions</p>
                          </div>
                          <button className="btn-primary"
                            style={{padding:'0.5rem 1rem',fontSize:'0.82rem',whiteSpace:'nowrap'}}
                            onClick={() => handleGenerate(q._id)}
                            disabled={generating === q._id}
                          >
                            {generating === q._id
                              ? <><span className="spinner" style={{width:14,height:14}}/> Generating…</>
                              : '⚡ Generate'}
                          </button>
                          {q.latest_run_id &&
                            <button className="btn-secondary"
                              style={{padding:'0.5rem 0.9rem',fontSize:'0.82rem'}}
                              onClick={() => navigate(`/review/${q.latest_run_id}`)}
                            >View</button>
                          }
                        </div>
                      ))}
                    </div>
              }
            </div>

            {/* Recent runs */}
            <div className="card fade-up" style={{animationDelay:'0.2s'}}>
              <div style={s.cardHeader}>
                <span style={s.cardIcon}>🕓</span>
                <h3>Recent Runs</h3>
              </div>
              {runs.length === 0
                ? <p style={{color:'var(--text-dim)',fontSize:'0.9rem',padding:'1rem 0'}}>No runs yet.</p>
                : <div style={s.qList}>
                    {runs.slice(0,5).map(r => (
                      <div key={r._id} style={s.qItem}>
                        <div style={{flex:1,minWidth:0}}>
                          <p style={{fontWeight:600,fontSize:'0.9rem',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                            {r.questionnaire_name || 'Unnamed'}
                          </p>
                          <div style={{display:'flex',gap:'0.5rem',marginTop:'0.2rem'}}>
                            <span className="badge badge-success" style={{fontSize:'0.7rem'}}>{r.coverage?.answered}/{r.coverage?.total} answered</span>
                            {r.coverage?.not_found > 0 && <span className="badge badge-warn" style={{fontSize:'0.7rem'}}>{r.coverage.not_found} not found</span>}
                          </div>
                        </div>
                        <button className="btn-ghost" style={{fontSize:'0.82rem'}}
                          onClick={() => navigate(`/review/${r._id}`)}>
                          Review →
                        </button>
                      </div>
                    ))}
                  </div>
              }
            </div>
          </div>
        </div>
      </div>

      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  )
}

const s = {
  root: { minHeight:'100vh', position:'relative', overflow:'hidden' },
  glowTop: {
    position:'fixed', top:'-100px', left:'50%', transform:'translateX(-50%)',
    width:800, height:400,
    background:'radial-gradient(ellipse, rgba(124,106,247,0.1) 0%, transparent 70%)',
    pointerEvents:'none',
  },
  nav: {
    display:'flex', alignItems:'center', justifyContent:'space-between',
    padding:'1.25rem 2rem',
    borderBottom:'1px solid var(--border)',
    background:'rgba(10,10,15,0.8)',
    backdropFilter:'blur(12px)',
    position:'sticky', top:0, zIndex:10,
  },
  navLogo: { display:'flex', alignItems:'center', gap:'0.75rem' },
  navBrand: { fontFamily:'var(--font-display)', fontWeight:800, fontSize:'1.05rem', letterSpacing:'-0.02em' },
  navRight: { display:'flex', alignItems:'center', gap:'1rem' },
  navUser: { fontSize:'0.85rem', color:'var(--text-muted)' },
  body: { maxWidth:1100, margin:'0 auto', padding:'2.5rem 2rem' },
  hero: { textAlign:'center', marginBottom:'3rem' },
  heroTitle: { fontSize:'clamp(2rem,5vw,3rem)', lineHeight:1.15, marginBottom:'1rem' },
  heroSub: { color:'var(--text-muted)', maxWidth:520, margin:'0 auto', fontSize:'1rem' },
  grid: { display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(340px,1fr))', gap:'1.5rem' },
  col: { display:'flex', flexDirection:'column', gap:'1.5rem' },
  cardHeader: { display:'flex', alignItems:'center', gap:'0.6rem', marginBottom:'0.6rem' },
  cardIcon: { fontSize:'1.1rem' },
  cardDesc: { color:'var(--text-muted)', fontSize:'0.875rem', marginBottom:'1rem', lineHeight:1.5 },
  uploadArea: {
    position:'relative',
    border:'1.5px dashed var(--border)',
    borderRadius:'var(--radius)',
    padding:'1.25rem',
    display:'flex', flexDirection:'column', alignItems:'center', gap:'0.5rem',
    cursor:'pointer',
    transition:'border-color 0.2s',
  },
  fileInput: { position:'absolute', inset:0, opacity:0, cursor:'pointer', width:'100%', height:'100%' },
  docList: { listStyle:'none', display:'flex', flexDirection:'column', gap:'0.5rem', margin:'0.5rem 0' },
  docItem: { display:'flex', alignItems:'center', gap:'0.6rem', padding:'0.4rem 0.5rem', background:'var(--bg3)', borderRadius:8 },
  qList: { display:'flex', flexDirection:'column', gap:'0.75rem', marginTop:'0.75rem' },
  qItem: { display:'flex', alignItems:'center', gap:'0.75rem', padding:'0.75rem', background:'var(--bg3)', borderRadius:10 },
}
