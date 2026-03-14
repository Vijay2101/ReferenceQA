import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL || '/api'

const api = axios.create({ baseURL: BASE_URL })

// Attach JWT automatically
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// ── Auth ──────────────────────────────────────────────────────────────────────
export const signup = (email, password, name) =>
  api.post('/signup', { email, password, name })

export const login = (email, password) => {
  const form = new URLSearchParams()
  form.append('username', email)
  form.append('password', password)
  return api.post('/login', form, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } })
}

export const getMe = () => api.get('/me')

// ── Documents ─────────────────────────────────────────────────────────────────
export const uploadDocuments = (files) => {
  const fd = new FormData()
  files.forEach((f) => fd.append('files', f))
  return api.post('/upload-documents', fd)
}

export const listDocuments = () => api.get('/documents')
export const deleteDocument = (id) => api.delete(`/documents/${id}`)

// ── Questionnaires ────────────────────────────────────────────────────────────
export const uploadQuestionnaire = (file) => {
  const fd = new FormData()
  fd.append('file', file)
  return api.post('/upload-questionnaire', fd)
}

export const listQuestionnaires = () => api.get('/questionnaires')

// ── Generate ──────────────────────────────────────────────────────────────────
export const generateAnswers = (questionnaireId) =>
  api.post(`/generate-answers/${questionnaireId}`)

// ── Runs ──────────────────────────────────────────────────────────────────────
export const getRun = (runId) => api.get(`/run/${runId}`)
export const listRuns = () => api.get('/runs')

export const editAnswer = (runId, questionIndex, answer) =>
  api.patch(`/run/${runId}/edit`, { question_index: questionIndex, answer })

export const regenerateAnswer = (runId, questionIndex) =>
  api.post(`/run/${runId}/regenerate`, { question_index: questionIndex })

export const exportRun = (runId) =>
  api.get(`/export/${runId}`, { responseType: 'blob' })
