import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { login, signup } from './api'

export default function Login() {
  const navigate = useNavigate()
  const [mode, setMode]       = useState('login')  // 'login' | 'signup'
  const [email, setEmail]     = useState('')
  const [password, setPass]   = useState('')
  const [name, setName]       = useState('')
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      let res
      if (mode === 'signup') {
        res = await signup(email, password, name)
      } else {
        res = await login(email, password)
      }
      localStorage.setItem('token', res.data.access_token)
      localStorage.setItem('user', JSON.stringify({ name: res.data.name, email: res.data.email }))
      navigate('/')
    } catch (err) {
      setError(err?.response?.data?.detail || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={styles.root}>
      {/* Background glow */}
      <div style={styles.glow1} />
      <div style={styles.glow2} />

      <div style={styles.card} className="fade-up">
        {/* Logo */}
        <div style={styles.logo}>
          <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
            <rect width="36" height="36" rx="10" fill="#7c6af7" fillOpacity="0.15"/>
            <path d="M8 18 L18 8 L28 18 L18 28 Z" stroke="#7c6af7" strokeWidth="1.5" fill="none"/>
            <circle cx="18" cy="18" r="4" fill="#7c6af7"/>
            <circle cx="18" cy="8" r="2" fill="#4af0c4"/>
          </svg>
          <span style={styles.logoText}>QueryFlow AI</span>
        </div>

        <h2 style={styles.title}>
          {mode === 'login' ? 'Welcome back' : 'Create account'}
        </h2>
        <p style={styles.subtitle}>
          {mode === 'login'
            ? 'Sign in to your workspace'
            : 'Start answering questionnaires with AI'}
        </p>

        <form onSubmit={handleSubmit} style={styles.form}>
          {mode === 'signup' && (
            <div style={styles.field}>
              <label style={styles.label}>Full Name</label>
              <input
                type="text"
                placeholder="Jane Smith"
                value={name}
                onChange={e => setName(e.target.value)}
                required
              />
            </div>
          )}
          <div style={styles.field}>
            <label style={styles.label}>Email</label>
            <input
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Password</label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPass(e.target.value)}
              required
            />
          </div>

          {error && <p style={styles.error}>{error}</p>}

          <button type="submit" className="btn-primary" style={{ width: '100%', marginTop: '0.5rem' }} disabled={loading}>
            {loading ? <span className="spinner" /> : (mode === 'login' ? 'Sign In' : 'Create Account')}
          </button>
        </form>

        <p style={styles.toggle}>
          {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
          <button
            className="btn-ghost"
            style={{ padding: '0.2rem 0.5rem', fontSize: '0.9rem' }}
            onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError('') }}
          >
            {mode === 'login' ? 'Sign Up' : 'Sign In'}
          </button>
        </p>
      </div>
    </div>
  )
}

const styles = {
  root: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
    padding: '2rem',
  },
  glow1: {
    position: 'fixed', top: '10%', left: '15%',
    width: 400, height: 400,
    background: 'radial-gradient(circle, rgba(124,106,247,0.12) 0%, transparent 70%)',
    pointerEvents: 'none',
  },
  glow2: {
    position: 'fixed', bottom: '10%', right: '10%',
    width: 350, height: 350,
    background: 'radial-gradient(circle, rgba(74,240,196,0.08) 0%, transparent 70%)',
    pointerEvents: 'none',
  },
  card: {
    background: 'var(--bg2)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    padding: '2.5rem',
    width: '100%',
    maxWidth: 440,
    position: 'relative',
    zIndex: 1,
    boxShadow: 'var(--shadow-lg)',
  },
  logo: {
    display: 'flex', alignItems: 'center', gap: '0.75rem',
    marginBottom: '2rem',
  },
  logoText: {
    fontFamily: 'var(--font-display)',
    fontWeight: 800,
    fontSize: '1.1rem',
    letterSpacing: '-0.02em',
  },
  title: {
    fontSize: '1.6rem',
    marginBottom: '0.4rem',
  },
  subtitle: {
    color: 'var(--text-muted)',
    fontSize: '0.9rem',
    marginBottom: '2rem',
  },
  form: { display: 'flex', flexDirection: 'column', gap: '1.1rem' },
  field: { display: 'flex', flexDirection: 'column', gap: '0.4rem' },
  label: { fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 500 },
  error: {
    background: 'rgba(247,74,106,0.1)',
    border: '1px solid rgba(247,74,106,0.3)',
    borderRadius: 8,
    color: 'var(--danger)',
    fontSize: '0.85rem',
    padding: '0.6rem 0.9rem',
  },
  toggle: {
    marginTop: '1.5rem',
    textAlign: 'center',
    color: 'var(--text-muted)',
    fontSize: '0.9rem',
  },
}
