import { NavLink } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { LayoutDashboard, History, Settings, LogOut } from 'lucide-react'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { auth } from '../firebase'
import { useNavigate } from 'react-router-dom'

const navItems = [
    { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/history',   icon: History,         label: 'History'   },
    { path: '/settings',  icon: Settings,        label: 'Settings'  },
]

function Layout({ children }) {
    const [collapsed, setCollapsed] = useState(false)
    const [user, setUser] = useState(null)
    const navigate = useNavigate()

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, setUser)
        return unsubscribe
    }, [])

    async function handleLogout() {
        await signOut(auth)
        navigate('/login')
    }

    return (
        <div className="flex min-h-screen bg-[#050B1F] text-white">

            {/* SIDEBAR */}
            <aside className={`
                border-r border-white/5 flex flex-col p-4
                transition-all duration-300
                ${collapsed ? 'w-20' : 'w-64'}
            `}>

                {/* Лого + кнопка коллапса */}
                <div className={`flex items-center mb-8 ${collapsed ? 'justify-center' : 'justify-between'}`}>
                    {!collapsed && (
                        <div className="flex items-center gap-2">
                            <img src="/logo.png" alt="logo" className="w-7 h-7 rounded-lg" />
                            <span className="font-bold text-sm whitespace-nowrap">
                                Competitor Monitor
                            </span>
                        </div>
                    )}
                    {collapsed && (
                        <img src="/logo.png" alt="logo" className="w-7 h-7 rounded-lg" />
                    )}
                    {!collapsed && (
                        <button
                            onClick={() => setCollapsed(!collapsed)}
                            className="text-white/30 hover:text-white transition-colors p-1"
                        >
                            ←
                        </button>
                    )}
                    {collapsed && (
                        <button
                            onClick={() => setCollapsed(!collapsed)}
                            className="text-white/30 hover:text-white transition-colors mt-2"
                    >
                        →
                    </button>
                )}
            </div>

                {/* Навигация */}
                <nav className="space-y-1 flex-1">
                    {navItems.map(({ path, icon: Icon, label }) => (
                        <NavLink
                            key={path}
                            to={path}
                            className={({ isActive }) => `
                                group flex items-center gap-3
                                px-3 py-2.5 rounded-xl text-sm
                                transition-all duration-200
                                hover:translate-x-0.5
                                ${isActive
                                    ? 'bg-white/10 text-white'
                                    : 'text-white/40 hover:text-white hover:bg-white/5'
                                }
                            `}
                        >
                            <Icon
                                size={18}
                                className="flex-shrink-0 transition-transform group-hover:scale-110"
                            />
                            {!collapsed && (
                                <span className="whitespace-nowrap">{label}</span>
                            )}
                        </NavLink>
                    ))}
                </nav>

                {/* Пользователь внизу */}
                <div className="border-t border-white/5 pt-4 mt-4">
                    {user && (
                        <div className="flex items-center gap-3 mb-3">
                            {user.photoURL && (
                                <img
                                    src={user.photoURL}
                                    alt="avatar"
                                    referrerPolicy="no-referrer" 
                                    className="w-8 h-8 rounded-full flex-shrink-0"
                                />
                            )}
                            {!collapsed && (
                                <div className="overflow-hidden">
                                    <p className="text-xs font-medium text-white truncate">
                                        {user.displayName}
                                    </p>
                                    <p className="text-xs text-white/30 truncate">
                                        {user.email}
                                    </p>
                                </div>
                            )}
                        </div>
                    )}

                    <button
                        onClick={handleLogout}
                        className="
                            w-full flex items-center gap-3
                            px-3 py-2.5 rounded-xl text-sm
                            text-white/30 hover:text-red-400 hover:bg-red-500/5
                            transition-colors
                        "
                    >
                        <LogOut size={18} className="flex-shrink-0" />
                        {!collapsed && <span>Sign out</span>}
                    </button>
                </div>
            </aside>

            {/* ОСНОВНОЙ КОНТЕНТ */}
            <main className="flex-1 overflow-auto">
                {children}
            </main>

        </div>
    )
}

export default Layout