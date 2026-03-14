import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Login from './Login'
import Dashboard from './Dashboard'
import UploadDocs from './UploadDocs'
import Results from './Results'
import Review from './Review'

function RequireAuth({ children }) {
  const token = localStorage.getItem('token')
  return token ? children : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<RequireAuth><Dashboard /></RequireAuth>} />
        <Route path="/upload" element={<RequireAuth><UploadDocs /></RequireAuth>} />
        <Route path="/results/:runId" element={<RequireAuth><Results /></RequireAuth>} />
        <Route path="/review/:runId" element={<RequireAuth><Review /></RequireAuth>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
