import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { listDocuments, uploadDocuments, deleteDocument } from './api'

export default function UploadDocs() {
  const navigate = useNavigate()
  const [docs, setDocs]         = useState([])
  const [files, setFiles]       = useState([])
  const [uploading, setUploading] = useState(false)
  const [toast, setToast]       = useState(null)
  const [loading, setLoading]   = useState(true)

  useEffect(() => { fetchDocs() }, [])

  async function fetchDocs() {
    setLoading(true)
    try { const r = await listDocuments(); setDocs(r.data) } catch {}
    setLoading(false)
  }

  function showToast(msg, type = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  async function handleUpload() {
    if (!files.length) return
    setUploading(true)
    try {
      const res = await uploadDocuments(Array.from(files))
      showToast(`Uploaded ${res.data.uploaded.length} document(s)`)
      setFiles([])
      fetchDocs()
    } catch (err) {
      showToast(err?.response?.data?.detail || 'Upload failed', 'error')
    }
    setUploading(false)
  }

  async function handleDelete(id, name) {
    if (!confirm(`Delete "${name}"?`)) return
    try {
      await deleteDocument(id)
      showToast('Document deleted')
      setDocs(d => d.filter(x => x._id !== id))
    } catch { showToast('Delete failed', 'error') }
  }

  return (
    <div style={s.root}>
      <div style={s.glowBg} />

      {/* Header */}
      <div style={s.header}>
        <button className="btn-ghost" onClick={() => navigate('/')} style={{padding:'0.4rem 0.8rem',fontSize:'0.85rem'}}>← Back</button>
        <div>
          <h2 style={{fontFamily:'var(--font-display)'}}>Reference Documents</h2>
          <p style={{color:'var(--text-muted)',fontSize:'0.875rem'}}>Upload PDFs, Excel files, or text docs as your source of truth.</p>
        </div>
      </div>

      <div style={s.body}>
        {/* Upload zone */}
        <div className="card fade-up" style={{marginBottom:'2rem'}}>
          <h3 style={{marginBottom:'0.5rem'}}>📤 Upload New Documents</h3>
          <p style={{color:'var(--text-muted)',fontSize:'0.875rem',marginBottom:'1.25rem'}}>
            Supports PDF, Excel (.xlsx), and plain text. Multiple files allowed.
          </p>

          <div style={s.dropZone}
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); setFiles(e.dataTransfer.files) }}
          >
            <span style={{fontSize:'2.5rem'}}>📂</span>
            <p style={{color:'var(--text-muted)',margin:'0.5rem 0 0.25rem'}}>Drag & drop files here</p>
            <p style={{color:'var(--text-dim)',fontSize:'0.8rem'}}>or click to select</p>
            {files.length > 0 && (
              <div style={s.filePreview}>
                {Array.from(files).map((f,i) => (
                  <span key={i} className="badge badge-accent">{f.name}</span>
                ))}
              </div>
            )}
            <input type="file" multiple accept=".pdf,.xlsx,.xls,.txt,.csv"
              style={s.fileInput}
              onChange={e => setFiles(e.target.files)}
            />
          </div>

          <div style={{display:'flex',gap:'0.75rem',marginTop:'1rem'}}>
            <button className="btn-primary" onClick={handleUpload}
              disabled={!files.length || uploading}
            >
              {uploading
                ? <><span className="spinner" style={{width:16,height:16}}/> Uploading…</>
                : `Upload ${files.length > 0 ? `(${files.length})` : ''}`}
            </button>
            {files.length > 0 &&
              <button className="btn-secondary" onClick={() => setFiles([])}>Clear</button>
            }
          </div>
        </div>

        {/* Existing docs */}
        <div className="card fade-up" style={{animationDelay:'0.1s'}}>
          <div style={{display:'flex',alignItems:'center',gap:'0.75rem',marginBottom:'1.25rem'}}>
            <h3>📚 Uploaded Documents</h3>
            <span className="badge badge-success">{docs.length}</span>
          </div>

          {loading
            ? <div style={{display:'flex',justifyContent:'center',padding:'2rem'}}><span className="spinner"/></div>
            : docs.length === 0
              ? (
                <div style={s.empty}>
                  <span style={{fontSize:'2rem'}}>📭</span>
                  <p style={{color:'var(--text-muted)'}}>No documents uploaded yet.</p>
                  <p style={{color:'var(--text-dim)',fontSize:'0.85rem'}}>Upload reference docs above to get started.</p>
                </div>
              )
              : (
                <div style={s.docGrid}>
                  {docs.map(doc => (
                    <div key={doc._id} style={s.docCard}>
                      <div style={s.docIcon}>
                        {doc.filename.endsWith('.pdf') ? '📕' : doc.filename.match(/\.xlsx?/) ? '📊' : '📄'}
                      </div>
                      <div style={{flex:1,minWidth:0}}>
                        <p style={{fontWeight:600,fontSize:'0.9rem',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{doc.filename}</p>
                        <p style={{fontSize:'0.75rem',color:'var(--text-dim)',marginTop:'0.2rem'}}>
                          {new Date(doc.uploaded_at).toLocaleDateString()}
                        </p>
                      </div>
                      <button className="btn-danger" style={{padding:'0.35rem 0.7rem',fontSize:'0.8rem'}}
                        onClick={() => handleDelete(doc._id, doc.filename)}
                      >✕</button>
                    </div>
                  ))}
                </div>
              )
          }
        </div>
      </div>

      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  )
}

const s = {
  root: { minHeight:'100vh', position:'relative' },
  glowBg: {
    position:'fixed', top:'20%', right:'10%', width:400, height:400,
    background:'radial-gradient(circle, rgba(74,240,196,0.07) 0%, transparent 70%)',
    pointerEvents:'none',
  },
  header: {
    display:'flex', alignItems:'center', gap:'1.25rem',
    padding:'1.5rem 2rem',
    borderBottom:'1px solid var(--border)',
    background:'rgba(10,10,15,0.8)',
    backdropFilter:'blur(12px)',
    position:'sticky', top:0, zIndex:10,
  },
  body: { maxWidth:820, margin:'0 auto', padding:'2.5rem 2rem' },
  dropZone: {
    position:'relative',
    border:'1.5px dashed var(--border)',
    borderRadius:'var(--radius)',
    padding:'2rem',
    display:'flex', flexDirection:'column', alignItems:'center', gap:'0.4rem',
    cursor:'pointer', textAlign:'center',
    transition:'border-color 0.2s',
    minHeight:160,
  },
  filePreview: { display:'flex', flexWrap:'wrap', gap:'0.5rem', marginTop:'0.75rem', justifyContent:'center' },
  fileInput: { position:'absolute', inset:0, opacity:0, cursor:'pointer', width:'100%', height:'100%' },
  docGrid: { display:'flex', flexDirection:'column', gap:'0.6rem' },
  docCard: {
    display:'flex', alignItems:'center', gap:'0.75rem',
    padding:'0.75rem 1rem',
    background:'var(--bg3)', borderRadius:10,
    border:'1px solid var(--border)',
    transition:'border-color 0.2s',
  },
  docIcon: { fontSize:'1.4rem' },
  empty: { textAlign:'center', padding:'2.5rem', display:'flex', flexDirection:'column', alignItems:'center', gap:'0.5rem' },
}
