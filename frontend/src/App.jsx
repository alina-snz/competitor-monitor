import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from './firebase'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import History from './pages/History'
import Settings from './pages/Settings'
import Layout from './components/Layout'

function ProtectedRoute({ children }) {
    const [user, setUser] = useState(undefined)

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser)
        })
        return unsubscribe
    }, [])

    if (user === undefined) return (
        <div className="min-h-screen bg-gray-950 flex items-center justify-center">
            <p className="text-gray-400 text-sm">Loading...</p>
        </div>
    )

    if (!user) return <Navigate to="/login" replace />

    return children
}

function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<Landing />} />
                <Route path="/login" element={<Login />} />
                <Route path="/dashboard" element={
                    <ProtectedRoute><Layout><Dashboard /></Layout></ProtectedRoute>
                } />
                <Route path="/history" element={
                    <ProtectedRoute><Layout><History /></Layout></ProtectedRoute>
                } />
                <Route path="/settings" element={
                    <ProtectedRoute><Layout><Settings /></Layout></ProtectedRoute>
                } />
                <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
        </BrowserRouter>
    )
}

export default App
