import { useState, useEffect } from 'react'
import { collection, query, where, getDocs, addDoc,
         updateDoc, doc, serverTimestamp } from 'firebase/firestore'
import { onAuthStateChanged } from 'firebase/auth'
import { auth, db } from '../firebase'
import { useNavigate } from 'react-router-dom'
import { Globe, Bell, Clock, ExternalLink, Trash2, AlertCircle,
         TrendingUp, Plus } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

const MAX_SITES = 3

function isValidUrl(string) {
    try {
        const url = new URL(string)
        return url.protocol === 'http:' || url.protocol === 'https:'
    } catch {
        return false
    }
}

function cleanUrl(rawUrl) {
    try {
        const parsed = new URL(rawUrl)
        return `${parsed.protocol}//${parsed.hostname}${parsed.pathname}`
    } catch {
        return rawUrl
    }
}

function buildChartData(changes) {
    const days = []
    for (let i = 6; i >= 0; i--) {
        const date = new Date()
        date.setDate(date.getDate() - i)
        const label = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        const dateStr = date.toISOString().split('T')[0]
        const count = changes.filter(c => {
            const d = c.detected_at?.toDate()
            return d && d.toISOString().split('T')[0] === dateStr
        }).length
        days.push({ date: label, changes: count })
    }
    return days
}

function buildSiteChartData(changes, sites) {
    return sites.map(site => {
        let hostname = site.url
        try { hostname = new URL(site.url).hostname } catch {}
        const count = changes.filter(c => c.url === site.url).length
        return { site: hostname, changes: count }
    })
}

function CustomTooltip({ active, payload, label }) {
    if (active && payload && payload.length) {
        return (
            <div className="bg-[#0D1B3E] border border-white/10 rounded-xl px-3 py-2 text-sm">
                <p className="text-white/60 mb-1">{label}</p>
                <p className="text-blue-400 font-medium">{payload[0].value} changes</p>
            </div>
        )
    }
    return null
}

function StatCard({ icon: Icon, label, value, sub, subColor = 'text-white/30', miniChart }) {
    return (
        <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-6 flex items-start justify-between">
            <div>
                <div className="flex items-center gap-2 mb-3">
                    <Icon size={18} className="text-blue-400" />
                    <span className="text-white/40 text-sm">{label}</span>
                </div>
                <p className="text-4xl font-bold text-white mb-1">{value}</p>
                {sub && <p className={`text-xs ${subColor}`}>{sub}</p>}
            </div>
            {miniChart && (
                <div className="w-24 h-12 opacity-60">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={miniChart} barSize={4}>
                            <Bar dataKey="changes" fill="#6366f1" radius={2} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            )}
        </div>
    )
}

function ChangeCard({ change }) {
    const date = change.detected_at?.toDate().toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    })
    let hostname = change.url
    try { hostname = new URL(change.url).hostname } catch {}
    const initial = hostname[0]?.toUpperCase()

    return (
        <div className="py-4 border-b border-white/5 last:border-0">
            <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-center gap-2 min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center flex-shrink-0 text-xs font-bold text-white">
                        {initial}
                    </div>
                    <div className="min-w-0">
                        <p className="text-sm font-medium text-white truncate">{hostname}</p>
                        <p className="text-xs text-white/30">{date}</p>
                    </div>
                </div>
                <span className="flex-shrink-0 bg-amber-500/10 text-amber-400 text-xs font-medium px-2 py-0.5 rounded-full border border-amber-500/20">
                    Changed
                </span>
            </div>
            {change.summary && (
                <p className="text-xs text-white/50 mb-2 leading-relaxed">{change.summary}</p>
            )}
            {change.red_flags?.slice(0, 2).map((flag, i) => (
                <div key={i} className="flex items-start gap-1.5 mb-1">
                    <span className="text-white/20 text-xs mt-0.5">•</span>
                    <span className="text-xs text-white/30 leading-relaxed">{flag}</span>
                </div>
            ))}
            {change.red_flags?.length > 2 && (
                <p className="text-xs text-white/20 mt-1">+{change.red_flags.length - 2} more</p>
            )}
        </div>
    )
}

function SiteRow({ site, onHistory, onDelete }) {
    const isScanning = site.status === 'scanning'
    let hostname = site.url
    try { hostname = new URL(site.url).hostname } catch {}
    const initial = hostname[0]?.toUpperCase()

    return (
        <tr className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
            <td className="py-3 px-4">
                <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500/20 to-violet-500/20 flex items-center justify-center text-xs font-bold text-blue-400 flex-shrink-0">
                        {initial}
                    </div>
                    <span className="text-sm text-white/80 truncate max-w-[200px]">{site.url}</span>
                </div>
            </td>
            <td className="py-3 px-4">
                {isScanning ? (
                    <span className="flex items-center gap-1.5 text-xs text-amber-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                        Scanning
                    </span>
                ) : (
                    <span className="flex items-center gap-1.5 text-xs text-green-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                        Monitoring
                    </span>
                )}
            </td>
            <td className="py-3 px-4 text-xs text-white/30">Daily at 08:00</td>
            <td className="py-3 px-4">
                <div className="flex items-center gap-2">
                    <button
                        onClick={onHistory}
                        className="flex items-center gap-1 text-white/30 hover:text-blue-400 text-xs transition-colors px-2 py-1 rounded-lg hover:bg-blue-500/10"
                    >
                        <ExternalLink size={12} />
                        History
                    </button>
                    <button
                        onClick={onDelete}
                        className="text-white/20 hover:text-red-400 transition-colors p-1 rounded-lg hover:bg-red-500/10"
                    >
                        <Trash2 size={12} />
                    </button>
                </div>
            </td>
        </tr>
    )
}

function Dashboard() {
    const [sites, setSites] = useState([])
    const [allChanges, setAllChanges] = useState([])
    const [recentChanges, setRecentChanges] = useState([])
    const [chartData, setChartData] = useState([])
    const [siteChartData, setSiteChartData] = useState([])
    const [newUrl, setNewUrl] = useState('')
    const [loading, setLoading] = useState(true)
    const [adding, setAdding] = useState(false)
    const [user, setUser] = useState(null)
    const [urlError, setUrlError] = useState(null)
    const [showAddForm, setShowAddForm] = useState(false)
    const navigate = useNavigate()

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            if (!currentUser) {
                navigate('/login')
            } else {
                setUser(currentUser)
                loadAll(currentUser.uid)
            }
        })
        return unsubscribe
    }, [])

    async function loadAll(userId) {
        try {
            const [sitesSnap, changesSnap] = await Promise.all([
                getDocs(query(
                    collection(db, 'sites'),
                    where('userId', '==', userId),
                    where('active', '==', true)
                )),
                getDocs(query(
                    collection(db, 'changes'),
                    where('userId', '==', userId)
                ))
            ])

            const sitesData = sitesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
            const changesData = changesSnap.docs
                .map(doc => ({ id: doc.id, ...doc.data() }))
                .sort((a, b) => b.detected_at?.seconds - a.detected_at?.seconds)

            setSites(sitesData)
            setAllChanges(changesData)
            setRecentChanges(changesData.slice(0, 5))
            setChartData(buildChartData(changesData))
            setSiteChartData(buildSiteChartData(changesData, sitesData))
        } catch (err) {
            console.error('Failed to load data:', err)
        } finally {
            setLoading(false)
        }
    }

    async function handleAddSite() {
        const cleaned = cleanUrl(newUrl.trim())
        setUrlError(null)

        if (!cleaned) { setUrlError('Please enter a URL.'); return }
        if (!isValidUrl(cleaned)) { setUrlError('Please enter a valid URL starting with https://'); return }
        if (sites.some(s => s.url === cleaned)) { setUrlError('This site is already being monitored.'); return }
        if (sites.length >= MAX_SITES) return

        setAdding(true)
        try {
            await addDoc(collection(db, 'sites'), {
                url: cleaned,
                userId: user.uid,
                active: true,
                status: 'scanning',
                created_at: serverTimestamp()
            })
            setNewUrl('')
            setShowAddForm(false)
            loadAll(user.uid)
        } catch (err) {
            console.error('Failed to add site:', err)
        } finally {
            setAdding(false)
        }
    }

    async function handleDeleteSite(siteId) {
        try {
            await updateDoc(doc(db, 'sites', siteId), { active: false })
            setSites(prev => prev.filter(s => s.id !== siteId))
        } catch (err) {
            console.error('Failed to delete site:', err)
        }
    }

    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    const recentCount = allChanges.filter(c => {
        const d = c.detected_at?.toDate()
        return d && d > sevenDaysAgo
    }).length

    if (loading) return (
        <div className="flex items-center justify-center h-64">
            <p className="text-white/40">Loading...</p>
        </div>
    )

    return (
        <div className="p-8">

            {/* Хедер */}
            <div className="flex items-start justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-white">Dashboard</h1>
                    <p className="text-white/40 mt-1 text-sm">
                        Monitor competitor websites and track changes with AI
                    </p>
                </div>
                <button
                    onClick={() => setShowAddForm(!showAddForm)}
                    className="flex items-center gap-2 bg-gradient-to-r from-blue-500 to-violet-500 hover:from-blue-600 hover:to-violet-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-all"
                >
                    <Plus size={16} />
                    Add Website
                </button>
            </div>

            {/* Форма добавления */}
            {showAddForm && (
                <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5 mb-6">
                    <h3 className="text-sm font-medium text-white mb-3">Add competitor website</h3>
                    <div className="flex gap-3">
                        <input
                            type="url"
                            placeholder="https://competitor-site.com"
                            value={newUrl}
                            onChange={e => { setNewUrl(e.target.value); setUrlError(null) }}
                            onKeyDown={e => e.key === 'Enter' && handleAddSite()}
                            autoFocus
                            className="flex-1 bg-white/[0.03] border border-white/5 rounded-xl px-4 py-2.5 text-white text-sm placeholder-white/20 focus:outline-none focus:border-blue-500/50 transition-colors"
                        />
                        <button
                            onClick={handleAddSite}
                            disabled={adding || sites.length >= MAX_SITES}
                            className="bg-gradient-to-r from-blue-500 to-violet-500 disabled:opacity-40 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-all"
                        >
                            {adding ? 'Adding...' : 'Add Site'}
                        </button>
                        <button
                            onClick={() => { setShowAddForm(false); setUrlError(null) }}
                            className="text-white/30 hover:text-white px-3 rounded-xl transition-colors"
                        >
                            Cancel
                        </button>
                    </div>
                    {urlError && (
                        <p className="text-red-400 text-xs mt-2 flex items-center gap-1">
                            <AlertCircle size={12} /> {urlError}
                        </p>
                    )}
                    {sites.length >= MAX_SITES && (
                        <p className="text-amber-400 text-xs mt-2">
                            Free plan limit reached ({MAX_SITES} sites).
                        </p>
                    )}
                </div>
            )}

            {/* Stat cards */}
            <div className="grid grid-cols-3 gap-4 mb-6">
                <StatCard
                    icon={Globe}
                    label="Sites Monitored"
                    value={sites.length}
                    sub={`${MAX_SITES - sites.length} slots available`}
                    subColor="text-white/30"
                    miniChart={chartData}
                />
                <StatCard
                    icon={Bell}
                    label="Changes Detected"
                    value={allChanges.length}
                    sub={recentCount > 0 ? `↑ ${recentCount} last 7 days` : 'No changes this week'}
                    subColor={recentCount > 0 ? 'text-green-400' : 'text-white/30'}
                    miniChart={chartData}
                />
                <StatCard
                    icon={Clock}
                    label="Next Scan"
                    value="08:00"
                    sub="Daily monitoring active"
                    subColor="text-blue-400"
                />
            </div>

            {/* Два графика + Recent Changes */}
            <div className="grid grid-cols-3 gap-6 mb-6">

                {/* График 1 — Changes Activity */}
                <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-6">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h2 className="font-semibold text-white">Changes Activity</h2>
                            <p className="text-white/30 text-xs mt-0.5">Changes detected per day</p>
                        </div>
                        <span className="text-white/30 text-xs bg-white/5 px-3 py-1.5 rounded-lg">
                            Last 7 days
                        </span>
                    </div>

                    {allChanges.length === 0 ? (
                        <div className="h-48 flex flex-col items-center justify-center text-white/20">
                            <TrendingUp size={32} className="mb-3" />
                            <p className="text-sm">No data yet</p>
                            <p className="text-xs mt-1">Changes will appear after first scan</p>
                        </div>
                    ) : (
                        <ResponsiveContainer width="100%" height={200}>
                            <BarChart data={chartData} barSize={20}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                                <XAxis dataKey="date" tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 11 }} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                                <Bar dataKey="changes" fill="url(#barGradient)" radius={[4, 4, 0, 0]} />
                                <defs>
                                    <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#6366f1" />
                                        <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.6} />
                                    </linearGradient>
                                </defs>
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </div>

                {/* График 2 — Changes per Site */}
                <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-6">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h2 className="font-semibold text-white">Changes per Site</h2>
                            <p className="text-white/30 text-xs mt-0.5">Total changes per competitor</p>
                        </div>
                        <span className="text-white/30 text-xs bg-white/5 px-3 py-1.5 rounded-lg">
                            All time
                        </span>
                    </div>

                    {siteChartData.length === 0 || siteChartData.every(d => d.changes === 0) ? (
                        <div className="h-48 flex flex-col items-center justify-center text-white/20">
                            <Globe size={32} className="mb-3" />
                            <p className="text-sm">No data yet</p>
                            <p className="text-xs mt-1">Add sites to start tracking</p>
                        </div>
                    ) : (
                        <ResponsiveContainer width="100%" height={200}>
                            <BarChart data={siteChartData} barSize={28} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false} />
                                <XAxis
                                    type="number"
                                    tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 11 }}
                                    axisLine={false}
                                    tickLine={false}
                                    allowDecimals={false}
                                />
                                <YAxis
                                    type="category"
                                    dataKey="site"
                                    tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 11 }}
                                    axisLine={false}
                                    tickLine={false}
                                    width={90}
                                />
                                <Tooltip
                                    content={({ active, payload, label }) => {
                                        if (active && payload?.length) {
                                            return (
                                                <div className="bg-[#0D1B3E] border border-white/10 rounded-xl px-3 py-2 text-sm">
                                                    <p className="text-white/60 mb-1">{label}</p>
                                                    <p className="text-violet-400 font-medium">{payload[0].value} changes</p>
                                                </div>
                                            )
                                        }
                                        return null
                                    }}
                                    cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                                />
                                <Bar dataKey="changes" fill="url(#barGradient2)" radius={[0, 4, 4, 0]} />
                                <defs>
                                    <linearGradient id="barGradient2" x1="0" y1="0" x2="1" y2="0">
                                        <stop offset="0%" stopColor="#8b5cf6" />
                                        <stop offset="100%" stopColor="#6366f1" stopOpacity={0.7} />
                                    </linearGradient>
                                </defs>
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </div>

                {/* Recent Changes */}
                <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-6">
                    <div className="flex items-center justify-between mb-2">
                        <h2 className="font-semibold text-white">Recent Changes</h2>
                        <button
                            onClick={() => navigate('/history')}
                            className="text-white/30 hover:text-white text-xs transition-colors"
                        >
                            View all →
                        </button>
                    </div>

                    {recentChanges.length === 0 ? (
                        <div className="h-48 flex flex-col items-center justify-center text-white/20">
                            <Bell size={28} className="mb-3" />
                            <p className="text-sm">No changes yet</p>
                            <p className="text-xs mt-1 text-center">
                                Changes will appear after the first scan
                            </p>
                        </div>
                    ) : (
                        <div className="overflow-y-auto max-h-64">
                            {recentChanges.map(change => (
                                <ChangeCard key={change.id} change={change} />
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Monitored Sites таблица */}
            <div className="bg-white/[0.03] border border-white/5 rounded-2xl overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
                    <div className="flex items-center gap-2">
                        <Globe size={16} className="text-white/40" />
                        <h2 className="font-semibold text-white">Monitored Sites</h2>
                        <span className="text-white/30 text-xs bg-white/5 px-2 py-0.5 rounded-full">
                            {sites.length}/{MAX_SITES} sites
                        </span>
                    </div>
                </div>

                {sites.length === 0 ? (
                    <div className="py-16 text-center">
                        <Globe size={28} className="text-white/20 mx-auto mb-3" />
                        <p className="text-white/40 text-sm">No sites monitored yet</p>
                        <p className="text-white/20 text-xs mt-1">
                            Click "Add Website" above to get started
                        </p>
                    </div>
                ) : (
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-white/5">
                                <th className="text-left text-xs text-white/30 font-medium px-4 py-3">Website</th>
                                <th className="text-left text-xs text-white/30 font-medium px-4 py-3">Status</th>
                                <th className="text-left text-xs text-white/30 font-medium px-4 py-3">Next Scan</th>
                                <th className="text-left text-xs text-white/30 font-medium px-4 py-3">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sites.map(site => (
                                <SiteRow
                                    key={site.id}
                                    site={site}
                                    onHistory={() => navigate(`/history?url=${encodeURIComponent(site.url)}`)}
                                    onDelete={() => handleDeleteSite(site.id)}
                                />
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    )
}

export default Dashboard