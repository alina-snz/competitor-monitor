import { useState, useEffect } from 'react'
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore'
import { db } from '../firebase'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Clock, AlertTriangle, TrendingUp, Globe, BarChart2 } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

// Builds chart data — changes count per day for last 30 days
function buildHistoryChart(changes) {
    const days = []
    for (let i = 29; i >= 0; i--) {
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

function ChangeCard({ change }) {
    const date = change.detected_at?.toDate().toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric',
        hour: '2-digit', minute: '2-digit'
    })

    return (
        <div className="
            bg-white/[0.03] border border-white/5
            rounded-2xl p-5
            hover:bg-white/[0.05] hover:border-white/10
            transition-all duration-200
        ">
            {/* Header */}
            <div className="flex items-start justify-between gap-4 mb-3">
                <div className="flex items-center gap-2 text-white/30 text-xs">
                    <Clock size={12} />
                    <span>{date}</span>
                </div>
                <span className="
                    flex-shrink-0
                    bg-amber-500/10 text-amber-400
                    text-xs font-medium px-2.5 py-1
                    rounded-full border border-amber-500/20
                ">
                    Changed
                </span>
            </div>

            {/* Summary */}
            {change.summary && (
                <p className="text-white text-sm font-medium mb-3 leading-relaxed">
                    {change.summary}
                </p>
            )}

            {/* Red flags */}
            {change.red_flags?.length > 0 && (
                <div className="flex flex-col gap-2 mt-3 pt-3 border-t border-white/5">
                    {change.red_flags.map((flag, i) => (
                        <div key={i} className="flex items-start gap-2">
                            <AlertTriangle size={12} className="text-amber-400 flex-shrink-0 mt-0.5" />
                            <span className="text-xs text-white/50 leading-relaxed">{flag}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

function History() {
    const [changes, setChanges] = useState([])
    const [chartData, setChartData] = useState([])
    const [loading, setLoading] = useState(true)
    const [searchParams] = useSearchParams()
    const siteUrl = searchParams.get('url')
    const navigate = useNavigate()

    useEffect(() => {
        if (siteUrl) loadHistory()
    }, [siteUrl])

    async function loadHistory() {
        try {
            const snapshot = await getDocs(query(
                collection(db, 'changes'),
                where('url', '==', siteUrl),
                orderBy('detected_at', 'desc')
            ))
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
            setChanges(data)
            setChartData(buildHistoryChart(data))
        } catch (err) {
            console.error('Failed to load history:', err)
        } finally {
            setLoading(false)
        }
    }

    // Extract hostname for display
    let hostname = siteUrl || ''
    try { hostname = new URL(siteUrl).hostname } catch {}

    if (loading) return (
        <div className="flex items-center justify-center h-64">
            <p className="text-white/40">Loading history...</p>
        </div>
    )

    return (
        <div className="p-8">

            {/* Header */}
            <div className="flex items-center gap-4 mb-8">
                <button
                    onClick={() => navigate('/dashboard')}
                    className="
                        w-9 h-9 rounded-xl border border-white/5
                        flex items-center justify-center
                        text-white/40 hover:text-white hover:bg-white/5
                        transition-colors flex-shrink-0
                    "
                >
                    <ArrowLeft size={16} />
                </button>
                <div className="min-w-0">
                    <div className="flex items-center gap-2">
                        <Globe size={14} className="text-white/30 flex-shrink-0" />
                        <h1 className="text-white font-semibold truncate">{hostname}</h1>
                    </div>
                    <p className="text-white/30 text-xs mt-0.5 truncate">{siteUrl}</p>
                </div>
            </div>

            {/* Stat cards */}
            <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-5">
                    <div className="flex items-center gap-2 mb-3">
                        <TrendingUp size={16} className="text-violet-400" />
                        <span className="text-white/40 text-sm">Total Changes</span>
                    </div>
                    <p className="text-3xl font-bold text-white">{changes.length}</p>
                    <p className="text-white/30 text-xs mt-1">since monitoring started</p>
                </div>

                <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-5">
                    <div className="flex items-center gap-2 mb-3">
                        <Clock size={16} className="text-blue-400" />
                        <span className="text-white/40 text-sm">Last Change</span>
                    </div>
                    <p className="text-lg font-bold text-white">
                        {changes.length > 0
                            ? changes[0].detected_at?.toDate().toLocaleDateString('en-US', {
                                month: 'short', day: 'numeric'
                            })
                            : '—'
                        }
                    </p>
                    <p className="text-white/30 text-xs mt-1">most recent detection</p>
                </div>

                <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-5">
                    <div className="flex items-center gap-2 mb-3">
                        <BarChart2 size={16} className="text-green-400" />
                        <span className="text-white/40 text-sm">This Month</span>
                    </div>
                    <p className="text-3xl font-bold text-white">
                        {changes.filter(c => {
                            const d = c.detected_at?.toDate()
                            if (!d) return false
                            const now = new Date()
                            return d.getMonth() === now.getMonth() &&
                                   d.getFullYear() === now.getFullYear()
                        }).length}
                    </p>
                    <p className="text-white/30 text-xs mt-1">changes detected</p>
                </div>
            </div>

            {/* Activity chart */}
            <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-6 mb-6">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h2 className="font-semibold text-white">Change Activity</h2>
                        <p className="text-white/30 text-xs mt-0.5">
                            Number of changes detected per day
                        </p>
                    </div>
                    <span className="text-white/30 text-xs bg-white/5 px-3 py-1.5 rounded-lg">
                        Last 30 days
                    </span>
                </div>

                {changes.length === 0 ? (
                    <div className="h-40 flex items-center justify-center text-white/20">
                        <p className="text-sm">No data yet</p>
                    </div>
                ) : (
                    <ResponsiveContainer width="100%" height={160}>
                        <BarChart data={chartData} barSize={8}>
                            <CartesianGrid
                                strokeDasharray="3 3"
                                stroke="rgba(255,255,255,0.04)"
                                vertical={false}
                            />
                            <XAxis
                                dataKey="date"
                                tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }}
                                axisLine={false}
                                tickLine={false}
                                interval={4}
                            />
                            <YAxis
                                tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }}
                                axisLine={false}
                                tickLine={false}
                                allowDecimals={false}
                            />
                            <Tooltip
                                content={<CustomTooltip />}
                                cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                            />
                            <Bar
                                dataKey="changes"
                                fill="url(#historyGradient)"
                                radius={[3, 3, 0, 0]}
                            />
                            <defs>
                                <linearGradient id="historyGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#8b5cf6" />
                                    <stop offset="100%" stopColor="#6366f1" stopOpacity={0.5} />
                                </linearGradient>
                            </defs>
                        </BarChart>
                    </ResponsiveContainer>
                )}
            </div>

            {/* Changes timeline */}
            <div>
                <h2 className="font-semibold text-white mb-4">Change Timeline</h2>

                {changes.length === 0 ? (
                    <div className="
                        bg-white/[0.02] border border-white/5 border-dashed
                        rounded-2xl py-20 text-center
                    ">
                        <TrendingUp size={32} className="text-white/20 mx-auto mb-3" />
                        <p className="text-white/40 font-medium">No changes detected yet</p>
                        <p className="text-white/20 text-sm mt-1">
                            We'll notify you when something changes on this site
                        </p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-3">
                        {changes.map(change => (
                            <ChangeCard key={change.id} change={change} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}

export default History