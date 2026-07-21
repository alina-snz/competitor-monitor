import { useState } from 'react'
import { signInWithPopup } from 'firebase/auth'
import { auth, provider } from '../firebase'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import ThemeToggle from '@/components/ThemeToggle'

function Nav() {
    const navigate = useNavigate()

    return (
        <nav className="
            fixed top-0 left-0 right-0 z-50
            border-b border-white/5
            bg-[#050B1F]/80 backdrop-blur-md
        ">
            <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <img
                        src="/logo.png"
                        alt="Competitor Monitor"
                        className="w-8 h-8 rounded-lg"
                    />
                    <span className="font-bold text-white">
                        Competitor Monitor
                    </span>
                </div>
                <ThemeToggle />
            </div>
        </nav>
    )
}

function Footer() {
    return (
        <footer className="border-t border-white/5 py-12 px-6">
            <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-2">
                    <img
                        src="/logo.png"
                        alt="Competitor Monitor"
                        className="w-8 h-8 rounded-lg"
                    />
                    <span className="font-semibold text-white/60">Competitor Monitor</span>
                </div>
                <p className="text-white/20 text-sm">
                    © 2026 Competitor Monitor.
                </p>
            </div>
        </footer>
    )
}

function Login() {
    const navigate = useNavigate()
    const [error, setError] = useState(null)
    const [loading, setLoading] = useState(false)

    async function handleLogin() {
        setLoading(true)
        try {
            await signInWithPopup(auth, provider)
            navigate('/dashboard')
        } catch (err) {
            setError('Login failed. Please try again.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-[#050B1F] text-white flex flex-col">
            <Nav />
            <div className="flex-1 flex items-center justify-center px-6">

                <div className="
                    bg-white/[0.03] border border-white/5
                    rounded-2xl p-8
                    hover:bg-white/[0.06] hover:border-white/10
                    transition-colors
                    w-full max-w-md text-center
                ">
                    <img
                        src="/logo.png"
                        alt="logo"
                        className="w-12 h-12 rounded-xl mx-auto mb-6"
                    />

                    <h1 className="text-2xl font-bold text-white mb-2">
                        Welcome back
                    </h1>

                    <p className="text-white/40 mb-8">
                        Sign in to monitor your competitors
                    </p>

                    <button
                        onClick={handleLogin}
                        disabled={loading}
                        className="
                            w-full
                            bg-gradient-to-r from-blue-500 to-violet-500
                            hover:from-blue-600 hover:to-violet-600
                            text-white font-medium py-3 px-6 rounded-xl
                            transition-colors disabled:opacity-50
                        "
                    >
                        {loading ? 'Signing in...' : 'Sign in with Google'}
                    </button>

                    {error && (
                        <p className="text-red-400 text-sm mt-4">{error}</p>
                    )}
                </div>
            </div>
            <Footer />
        </div>
    )
}

export default Login