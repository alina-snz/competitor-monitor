import { useState, useEffect } from 'react'
import { doc, getDoc, setDoc, onSnapshot, serverTimestamp } from 'firebase/firestore'
import { onAuthStateChanged } from 'firebase/auth'
import { auth, db } from '../firebase'
import { useNavigate } from 'react-router-dom'
import { Bell, Mail, MessageCircle, LogOut, User, Shield } from 'lucide-react'

function Settings() {
    const [user, setUser] = useState(null)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [saved, setSaved] = useState(false)

    const [notificationChannel, setNotificationChannel] = useState('telegram')
    const [telegramConnected, setTelegramConnected] = useState(false)
    const [connectionToken, setConnectionToken] = useState(null)
    const [waitingForTelegram, setWaitingForTelegram] = useState(false)

    const navigate = useNavigate()

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            if (!currentUser) { navigate('/login'); return }
            setUser(currentUser)

            try {
                const docSnap = await getDoc(doc(db, 'users', currentUser.uid))
                if (docSnap.exists()) {
                    const data = docSnap.data()
                    setNotificationChannel(data.notificationChannel || 'telegram')
                    setTelegramConnected(!!data.telegramChatId)
                }
            } catch (err) {
                console.error('Failed to load settings:', err)
            } finally {
                setLoading(false)
            }
        })
        return unsubscribe
    }, [])

    // Слушаем Firebase когда бот подключается
    useEffect(() => {
        if (!connectionToken || !user) return

        const unsub = onSnapshot(
            doc(db, 'telegram_connections', connectionToken),
            async (snap) => {
                if (snap.exists()) {
                    const chatId = snap.data().chat_id
                    await setDoc(doc(db, 'users', user.uid), {
                        telegramChatId: chatId,
                        email: user.email,
                        updated_at: serverTimestamp()
                    }, { merge: true })
                    setTelegramConnected(true)
                    setWaitingForTelegram(false)
                }
            }
        )
        return unsub
    }, [connectionToken, user])

    function handleConnectTelegram() {
        const token = btoa(user.uid + Date.now()).replace(/[^a-zA-Z0-9]/g, '')
        setConnectionToken(token)
        setWaitingForTelegram(true)
        const botUsername = import.meta.env.VITE_TELEGRAM_BOT_USERNAME
        window.open(`https://t.me/${botUsername}?start=${token}`, '_blank')
    }

    async function handleDisconnectTelegram() {
        await setDoc(doc(db, 'users', user.uid), {
            telegramChatId: null
        }, { merge: true })
        setTelegramConnected(false)
    }

    async function handleSave() {
        if (!user) return
        setSaving(true)
        setSaved(false)

        try {
            await setDoc(doc(db, 'users', user.uid), {
                notificationChannel,
                email: user.email,
                updated_at: serverTimestamp()
            }, { merge: true })

            setSaved(true)
            setTimeout(() => setSaved(false), 3000)
        } catch (err) {
            console.error('Failed to save settings:', err)
        } finally {
            setSaving(false)
        }
    }

    if (loading) return (
        <div className="flex items-center justify-center h-64">
            <p className="text-white/40">Loading settings...</p>
        </div>
    )

    return (
        <div className="p-8 max-w-2xl mx-auto">

            {/* Заголовок */}
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-white">Settings</h1>
                <p className="text-white/40 mt-1 text-sm">
                    Manage your account and notification preferences
                </p>
            </div>

            {/* Аккаунт */}
            <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-6 mb-4">
                <div className="flex items-center gap-2 mb-5">
                    <User size={16} className="text-white/40" />
                    <h2 className="font-semibold text-white">Account</h2>
                </div>

                <div className="flex items-center gap-4">
                    {user?.photoURL ? (
                        <img
                            src={user.photoURL}
                            alt="avatar"
                            referrerPolicy="no-referrer"
                            className="w-12 h-12 rounded-full"
                        />
                    ) : (
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center text-white font-bold">
                            {user?.email?.[0]?.toUpperCase()}
                        </div>
                    )}
                    <div>
                        <p className="font-medium text-white">{user?.displayName || 'User'}</p>
                        <p className="text-sm text-white/40">{user?.email}</p>
                    </div>
                </div>
            </div>

            {/* Уведомления */}
            <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-6 mb-4">
                <div className="flex items-center gap-2 mb-2">
                    <Bell size={16} className="text-white/40" />
                    <h2 className="font-semibold text-white">Notifications</h2>
                </div>
                <p className="text-white/30 text-sm mb-6">
                    Choose how you want to receive alerts when competitors change their prices.
                </p>

                {/* Выбор канала */}
                <div className="grid grid-cols-2 gap-3 mb-6">

                    {/* Telegram */}
                    <button
                        onClick={() => setNotificationChannel('telegram')}
                        className={`
                            flex items-center gap-3 p-4 rounded-xl border text-left
                            transition-all duration-200
                            ${notificationChannel === 'telegram'
                                ? 'border-blue-500/40 bg-blue-500/10'
                                : 'border-white/5 bg-white/[0.02] hover:bg-white/[0.04]'
                            }
                        `}
                    >
                        <div className={`
                            w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0
                            ${notificationChannel === 'telegram' ? 'bg-blue-500/20' : 'bg-white/5'}
                        `}>
                            <MessageCircle size={18} className={notificationChannel === 'telegram' ? 'text-blue-400' : 'text-white/30'} />
                        </div>
                        <div>
                            <p className={`text-sm font-medium ${notificationChannel === 'telegram' ? 'text-white' : 'text-white/50'}`}>
                                Telegram
                            </p>
                            <p className="text-xs text-white/30 mt-0.5">Instant alerts</p>
                        </div>
                        {notificationChannel === 'telegram' && (
                            <div className="ml-auto w-2 h-2 rounded-full bg-blue-400" />
                        )}
                    </button>

                    {/* Email */}
                    <button
                        onClick={() => setNotificationChannel('email')}
                        className={`
                            flex items-center gap-3 p-4 rounded-xl border text-left
                            transition-all duration-200
                            ${notificationChannel === 'email'
                                ? 'border-violet-500/40 bg-violet-500/10'
                                : 'border-white/5 bg-white/[0.02] hover:bg-white/[0.04]'
                            }
                        `}
                    >
                        <div className={`
                            w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0
                            ${notificationChannel === 'email' ? 'bg-violet-500/20' : 'bg-white/5'}
                        `}>
                            <Mail size={18} className={notificationChannel === 'email' ? 'text-violet-400' : 'text-white/30'} />
                        </div>
                        <div>
                            <p className={`text-sm font-medium ${notificationChannel === 'email' ? 'text-white' : 'text-white/50'}`}>
                                Email
                            </p>
                            <p className="text-xs text-white/30 mt-0.5">
                                {user?.email ? user.email : 'Your email'}
                            </p>
                        </div>
                        {notificationChannel === 'email' && (
                            <div className="ml-auto w-2 h-2 rounded-full bg-violet-400" />
                        )}
                    </button>
                </div>

                {/* Telegram подключение — показываем только если выбран Telegram */}
                {notificationChannel === 'telegram' && (
                    <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
                        <p className="text-sm text-white/50 mb-3">
                            Connect your Telegram account to receive instant alerts.
                        </p>

                        {telegramConnected ? (
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-green-400" />
                                    <span className="text-sm text-green-400 font-medium">
                                        Telegram connected
                                    </span>
                                </div>
                                <button
                                    onClick={handleDisconnectTelegram}
                                    className="text-white/30 hover:text-red-400 text-xs transition-colors"
                                >
                                    Disconnect
                                </button>
                            </div>
                        ) : waitingForTelegram ? (
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                                <span className="text-sm text-amber-400">
                                    Waiting for connection... Open bot and press Start
                                </span>
                            </div>
                        ) : (
                            <button
                                onClick={handleConnectTelegram}
                                className="flex items-center gap-2 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 text-blue-400 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
                            >
                                <MessageCircle size={16} />
                                Connect Telegram
                            </button>
                        )}
                    </div>
                )}

                {/* Email — показываем если выбран Email */}
                {notificationChannel === 'email' && (
                    <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-green-400" />
                            <span className="text-sm text-white/60">
                                Alerts will be sent to <span className="text-white">{user?.email}</span>
                            </span>
                        </div>
                    </div>
                )}

                {/* Кнопка сохранения */}
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="mt-5 bg-gradient-to-r from-blue-500 to-violet-500 hover:from-blue-600 hover:to-violet-600 disabled:opacity-40 text-white px-6 py-2.5 rounded-xl text-sm font-medium transition-all"
                >
                    {saving ? 'Saving...' : saved ? '✅ Saved!' : 'Save Settings'}
                </button>
            </div>

            {/* Безопасность */}
            <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-6 mb-4">
                <div className="flex items-center gap-2 mb-5">
                    <Shield size={16} className="text-white/40" />
                    <h2 className="font-semibold text-white">Security</h2>
                </div>
                <p className="text-white/30 text-sm mb-4">
                    Your data is stored securely in Firebase with end-to-end isolation per account.
                </p>
                <div className="flex items-center gap-2 text-xs text-white/20">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
                    All monitoring data is private to your account
                </div>
            </div>

            {/* Danger zone */}
            <div className="bg-white/[0.02] border border-red-500/10 rounded-2xl p-6">
                <h2 className="font-semibold text-red-400 mb-1">Danger Zone</h2>
                <p className="text-white/30 text-sm mb-4">
                    Sign out from your account on this device.
                </p>
                <button
                    onClick={() => { auth.signOut(); navigate('/login') }}
                    className="flex items-center gap-2 border border-red-500/20 text-red-400 hover:bg-red-500/10 px-5 py-2.5 rounded-xl text-sm font-medium transition-colors"
                >
                    <LogOut size={15} />
                    Sign Out
                </button>
            </div>
        </div>
    )
}

export default Settings