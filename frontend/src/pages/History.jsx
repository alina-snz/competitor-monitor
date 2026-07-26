import { useState, useEffect, useMemo } from 'react'
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore'
import { auth, db } from '../firebase'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { onAuthStateChanged } from 'firebase/auth'
import {
    ArrowLeft, Clock, AlertTriangle, TrendingUp, TrendingDown,
    Globe, BarChart2, PlusCircle, MinusCircle, ExternalLink,
    Search, Percent
} from 'lucide-react'
import {
    BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
    XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from 'recharts'

// ─── SHARED HELPERS ──────────────────────────────────────────────────────────

function dateKey(d) {
    return d.toISOString().split('T')[0]
}

function buildChartData(changes, days = 30) {
    const result = []
    for (let i = days - 1; i >= 0; i--) {
        const date = new Date()
        date.setDate(date.getDate() - i)
        const label = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        const dStr = dateKey(date)
        const count = changes.filter(c => {
            const d = c.detected_at?.toDate()
            return d && dateKey(d) === dStr
        }).length
        result.push({ date: label, changes: count })
    }
    return result
}

// Classifies a single red_flag sentence into a change type, based on the
// fixed phrasing the analyzer's system prompts always ask the AI to use
// ("Price drop for...", "...increased from...", "New product added...",
// "...removed"). Falls back to "other" (also covers availability changes,
// since we don't have a separate structured field for that).
function classifyFlag(flag) {
    const text = (flag || '').toLowerCase()
    if (text.includes('new product added') || text.includes('now listed')) {
        return { type: 'new', label: 'New Product', color: '#3b82f6', icon: PlusCircle }
    }
    if (text.includes('removed') || text.includes('no longer listed')) {
        return { type: 'removed', label: 'Removed', color: '#f59e0b', icon: MinusCircle }
    }
    if (text.includes('drop') || text.includes('decreased')) {
        return { type: 'price_down', label: 'Price Drop', color: '#10b981', icon: TrendingDown }
    }
    if (text.includes('increased') || text.includes('increase')) {
        return { type: 'price_up', label: 'Price Increase', color: '#f43f5e', icon: TrendingUp }
    }
    return { type: 'other', label: 'Availability/Other', color: '#a78bfa', icon: AlertTriangle }
}

// Best-effort extraction of "from X to Y" price pairs out of the free-text
// flag — the analyzer's prompts consistently ask for this phrasing, but
// since it's still AI-written prose (not a structured field), this can
// occasionally miss unusual phrasing or currency formats.
function parsePriceChange(flag) {
    const match = (flag || '').match(/from\s*[^\d]*([\d][\d.,]*)\D+to\s*[^\d]*([\d][\d.,]*)/i)
    if (!match) return null
    const clean = (s) => parseFloat(s.replace(/[^\d.]/g, ''))
    const oldPrice = clean(match[1])
    const newPrice = clean(match[2])
    if (!oldPrice || !newPrice || Number.isNaN(oldPrice) || Number.isNaN(newPrice)) return null
    return { oldPrice, newPrice, pct: ((newPrice - oldPrice) / oldPrice) * 100 }
}

function summarizeFlags(changes) {
    const counts = { price_down: 0, price_up: 0, new: 0, removed: 0, other: 0 }
    changes.forEach(c => {
        (c.red_flags || []).forEach(flag => {
            counts[classifyFlag(flag).type]++
        })
    })
    return counts
}

const TYPE_ORDER = ['price_down', 'price_up', 'new', 'removed', 'other']

function CustomTooltip({ active, payload, label }) {
    if (active && payload?.length) {
        return (
            <div className="bg-[#0D1B3E] border border-white/10 rounded-xl px-3 py-2 text-sm">
                <p className="text-white/60 mb-1">{label}</p>
                {payload.map((p, i) => (
                    <p key={i} className="font-medium" style={{ color: p.color || p.fill }}>
                        {p.name}: {p.value}
                    </p>
                ))}
            </div>
        )
    }
    return null
}

// Stat-tile row used for the price/change-type breakdown on the all-sites page.
function FlagBreakdown({ changes }) {
    const counts = summarizeFlags(changes)
    const tiles = [
        { key: 'price_down', label: 'Price Drops', color: 'text-emerald-400', bg: 'bg-emerald-500/10', icon: TrendingDown },
        { key: 'price_up', label: 'Price Increases', color: 'text-rose-400', bg: 'bg-rose-500/10', icon: TrendingUp },
        { key: 'new', label: 'New Products', color: 'text-blue-400', bg: 'bg-blue-500/10', icon: PlusCircle },
        { key: 'removed', label: 'Removed', color: 'text-white/60', bg: 'bg-white/5', icon: MinusCircle },
    ]
    return (
        <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-6 mb-6">
            <div className="mb-5">
                <h2 className="font-semibold text-white">Price & Change Breakdown</h2>
                <p className="text-white/30 text-xs mt-0.5">What kind of changes were detected</p>
            </div>
            <div className="grid grid-cols-4 gap-4">
                {tiles.map(({ key, label, color, bg, icon: Icon }) => (
                    <div key={key} className={`rounded-xl p-4 ${bg}`}>
                        <Icon size={16} className={`${color} mb-2`} />
                        <p className="text-2xl font-bold text-white">{counts[key]}</p>
                        <p className="text-white/40 text-xs mt-1">{label}</p>
                    </div>
                ))}
            </div>
        </div>
    )
}

function StatTile({ icon: Icon, color, label, value, hint }) {
    return (
        <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
                <Icon size={14} className={color} />
                <span className="text-white/40 text-xs">{label}</span>
            </div>
            <p className="text-2xl font-bold text-white">{value}</p>
            {hint && <p className="text-white/20 text-[10px] mt-1">{hint}</p>}
        </div>
    )
}

function ChangeCard({ change, onClick }) {
    const [expanded, setExpanded] = useState(false)
    const date = change.detected_at?.toDate().toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
    })
    let hostname = change.url || ''
    try { hostname = new URL(change.url).hostname } catch {}

    const flags = change.red_flags || []
    const visibleFlags = expanded ? flags : flags.slice(0, 3)
    const Wrapper = onClick ? 'button' : 'div'

    return (
        <Wrapper
            onClick={onClick}
            className={`
                bg-white/[0.03] border border-white/5 rounded-2xl p-5
                hover:bg-white/[0.05] hover:border-white/10
                transition-all duration-200 text-left w-full
                ${onClick ? 'cursor-pointer' : ''}
            `}
        >
            <div className="flex items-start justify-between gap-4 mb-3">
                <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2 text-white/50 text-xs">
                        <Globe size={11} />
                        <span>{hostname}</span>
                    </div>
                    <div className="flex items-center gap-2 text-white/30 text-xs">
                        <Clock size={11} />
                        <span>{date}</span>
                    </div>
                </div>
                <span className="flex-shrink-0 bg-amber-500/10 text-amber-400 text-xs font-medium px-2.5 py-1 rounded-full border border-amber-500/20">
                    Changed
                </span>
            </div>

            {change.summary && (
                <p className="text-white text-sm font-medium mb-3 leading-relaxed">{change.summary}</p>
            )}

            {flags.length > 0 && (
                <div className="flex flex-col gap-2 mt-3 pt-3 border-t border-white/5">
                    {visibleFlags.map((flag, i) => {
                        const { color, icon: Icon } = classifyFlag(flag)
                        return (
                            <div key={i} className="flex items-start gap-2">
                                <Icon size={12} style={{ color }} className="flex-shrink-0 mt-0.5" />
                                <span className="text-xs text-white/50 leading-relaxed">{flag}</span>
                            </div>
                        )
                    })}
                    {flags.length > 3 && (
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setExpanded(v => !v) }}
                            className="text-xs text-white/40 hover:text-white/70 underline underline-offset-2 mt-1 text-left"
                        >
                            {expanded ? 'Show less' : `+${flags.length - 3} more`}
                        </button>
                    )}
                </div>
            )}
        </Wrapper>
    )
}

// ─── SITE HISTORY (redesigned per famo.ua-style reference) ─────────────────
//
// Note on scope: the reference design includes SKU / category / brand /
// product photos / a live "Scan now" action / a next-scan countdown. None
// of that exists in the current data model (`changes` docs only have
// url, userId, detected_at, summary, red_flags) or has a backend endpoint
// to call, so those pieces are intentionally left out rather than faked.
// Everything below is computed from real Firestore data; price % figures
// are best-effort, parsed out of the AI-written red_flag sentences.

const PERIODS = [
    { key: 7, label: '7 Days' },
    { key: 30, label: '30 Days' },
    { key: 90, label: '90 Days' },
    { key: 0, label: 'All Time' },
]

const TYPE_FILTERS = [
    { key: 'all', label: 'All Types' },
    { key: 'price_down', label: 'Price Drop' },
    { key: 'price_up', label: 'Price Increase' },
    { key: 'new', label: 'New Products' },
    { key: 'removed', label: 'Removed' },
    { key: 'other', label: 'Availability/Other' },
]

function SiteHistory({ siteUrl, onBack }) {
    const [changes, setChanges] = useState([])
    const [loading, setLoading] = useState(true)
    const [period, setPeriod] = useState(30)
    const [typeFilter, setTypeFilter] = useState('all')
    const [search, setSearch] = useState('')

    let hostname = siteUrl
    try { hostname = new URL(siteUrl).hostname } catch {}

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, currentUser => {
            if (currentUser) loadHistory(currentUser.uid)
        })
        return unsub
    }, [siteUrl])

    async function loadHistory(userId) {
        try {
            setLoading(true)
            const snapshot = await getDocs(query(
                collection(db, 'changes'),
                where('url', '==', siteUrl),
                where('userId', '==', userId),
                orderBy('detected_at', 'desc')
            ))
            setChanges(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })))
        } catch (err) {
            console.error('Failed to load site history:', err)
        } finally {
            setLoading(false)
        }
    }

    const scopedChanges = useMemo(() => {
        if (period === 0) return changes
        const cutoff = new Date()
        cutoff.setDate(cutoff.getDate() - period)
        return changes.filter(c => {
            const d = c.detected_at?.toDate()
            return d && d >= cutoff
        })
    }, [changes, period])

    const allFlagRows = useMemo(() => {
        const rows = []
        scopedChanges.forEach(c => {
            const d = c.detected_at?.toDate()
            const flags = c.red_flags?.length ? c.red_flags : (c.summary ? [c.summary] : [])
            flags.forEach((flag, i) => {
                rows.push({ id: `${c.id}-${i}`, flag, date: d, changeId: c.id, summary: c.summary })
            })
        })
        return rows.sort((a, b) => (b.date?.getTime() || 0) - (a.date?.getTime() || 0))
    }, [scopedChanges])

    const filteredFlagRows = useMemo(() => {
        return allFlagRows.filter(row => {
            const cls = classifyFlag(row.flag)
            if (typeFilter !== 'all' && cls.type !== typeFilter) return false
            if (search.trim() && !row.flag.toLowerCase().includes(search.trim().toLowerCase())) return false
            return true
        })
    }, [allFlagRows, typeFilter, search])

    const stats = useMemo(() => {
        const counts = { price_down: 0, price_up: 0, new: 0, removed: 0, other: 0 }
        const pcts = []
        allFlagRows.forEach(({ flag }) => {
            counts[classifyFlag(flag).type]++
            const parsed = parsePriceChange(flag)
            if (parsed) pcts.push(parsed.pct)
        })
        const today = new Date()
        const todayCount = allFlagRows.filter(r => r.date && dateKey(r.date) === dateKey(today)).length
        const avgPct = pcts.length ? pcts.reduce((a, b) => a + b, 0) / pcts.length : null
        return { counts, todayCount, avgPct, total: allFlagRows.length }
    }, [allFlagRows])

    const stackedChartData = useMemo(() => {
        const days = period === 0 ? 30 : Math.min(period, 90)
        const result = []
        for (let i = days - 1; i >= 0; i--) {
            const d = new Date()
            d.setDate(d.getDate() - i)
            const label = d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' })
            const key = dateKey(d)
            const counts = { price_down: 0, price_up: 0, new: 0, removed: 0, other: 0 }
            allFlagRows.forEach(row => {
                if (row.date && dateKey(row.date) === key) counts[classifyFlag(row.flag).type]++
            })
            result.push({ date: label, ...counts })
        }
        return result
    }, [allFlagRows, period])

    const trendData = useMemo(() => {
        const days = period === 0 ? 30 : Math.min(period, 90)
        const result = []
        for (let i = days - 1; i >= 0; i--) {
            const d = new Date()
            d.setDate(d.getDate() - i)
            const label = d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' })
            const key = dateKey(d)
            const pcts = []
            allFlagRows.forEach(row => {
                if (row.date && dateKey(row.date) === key) {
                    const parsed = parsePriceChange(row.flag)
                    if (parsed) pcts.push(parsed.pct)
                }
            })
            result.push({ date: label, avgPct: pcts.length ? +(pcts.reduce((a, b) => a + b, 0) / pcts.length).toFixed(1) : null })
        }
        return result
    }, [allFlagRows, period])

    const donutData = TYPE_ORDER
        .map(type => {
            const meta = { price_down: 'Price Drop', price_up: 'Price Increase', new: 'New Products', removed: 'Removed', other: 'Availability/Other' }
            const colors = { price_down: '#10b981', price_up: '#f43f5e', new: '#3b82f6', removed: '#f59e0b', other: '#a78bfa' }
            return { name: meta[type], value: stats.counts[type], color: colors[type] }
        })
        .filter(d => d.value > 0)

    if (loading) return (
        <div className="flex items-center justify-center h-64">
            <p className="text-white/40">Loading history...</p>
        </div>
    )

    return (
        <div className="p-8">
            {/* Header */}
            <div className="flex items-center gap-4 mb-6">
                <button
                    onClick={onBack}
                    className="w-9 h-9 rounded-xl border border-white/5 flex items-center justify-center text-white/40 hover:text-white hover:bg-white/5 transition-colors flex-shrink-0"
                >
                    <ArrowLeft size={16} />
                </button>
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                        <Globe size={14} className="text-white/30 flex-shrink-0" />
                        <a
                            href={siteUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-white font-semibold truncate hover:text-blue-400 transition-colors inline-flex items-center gap-1.5"
                        >
                            {hostname}
                            <ExternalLink size={12} className="text-white/30" />
                        </a>
                    </div>
                    <p className="text-white/30 text-xs mt-0.5 truncate">{siteUrl}</p>
                </div>
                <div className="flex items-center gap-1 bg-white/[0.03] border border-white/5 rounded-xl p-1 flex-shrink-0">
                    {PERIODS.map(p => (
                        <button
                            key={p.key}
                            onClick={() => setPeriod(p.key)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                period === p.key ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/70'
                            }`}
                        >
                            {p.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Stat cards */}
            <div className="grid grid-cols-6 gap-3 mb-6">
                <StatTile icon={TrendingUp} color="text-violet-400" label="Total Changes" value={stats.total} />
                <StatTile icon={Clock} color="text-blue-400" label="Changes Today" value={stats.todayCount} />
                <StatTile icon={TrendingDown} color="text-emerald-400" label="Price Drops" value={stats.counts.price_down} />
                <StatTile icon={TrendingUp} color="text-rose-400" label="Price Increases" value={stats.counts.price_up} />
                <StatTile icon={PlusCircle} color="text-blue-400" label="New Products" value={stats.counts.new} />
                <StatTile
                    icon={Percent}
                    color="text-white/60"
                    label="Avg Price Change"
                    value={stats.avgPct === null ? '—' : `${stats.avgPct > 0 ? '+' : ''}${stats.avgPct.toFixed(1)}%`}
                    hint={stats.avgPct === null ? 'no numeric data' : 'best-effort, parsed from text'}
                />
            </div>

            {/* Filters */}
            <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-4 mb-6 flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-1 flex-wrap">
                    {TYPE_FILTERS.map(f => (
                        <button
                            key={f.key}
                            onClick={() => setTypeFilter(f.key)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                                typeFilter === f.key
                                    ? 'bg-white/10 text-white border-white/10'
                                    : 'text-white/40 border-transparent hover:text-white/70 hover:border-white/5'
                            }`}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>
                <div className="ml-auto relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
                    <input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search change text..."
                        className="bg-white/[0.03] border border-white/5 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-white/20 w-64"
                    />
                </div>
            </div>

            {/* Charts row */}
            <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-6">
                    <h2 className="font-semibold text-white mb-1">Change Activity</h2>
                    <p className="text-white/30 text-xs mb-4">By day, broken down by type</p>
                    {stackedChartData.every(d => TYPE_ORDER.every(t => d[t] === 0)) ? (
                        <div className="h-40 flex items-center justify-center text-white/20 text-sm">No data yet</div>
                    ) : (
                        <ResponsiveContainer width="100%" height={200}>
                            <BarChart data={stackedChartData} barSize={6}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                                <XAxis dataKey="date" tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} axisLine={false} tickLine={false} interval={Math.ceil(stackedChartData.length / 8)} />
                                <YAxis tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                                <Bar dataKey="price_down" name="Price Drop" stackId="a" fill="#10b981" />
                                <Bar dataKey="price_up" name="Price Increase" stackId="a" fill="#f43f5e" />
                                <Bar dataKey="new" name="New Products" stackId="a" fill="#3b82f6" />
                                <Bar dataKey="removed" name="Removed" stackId="a" fill="#f59e0b" />
                                <Bar dataKey="other" name="Availability/Other" stackId="a" fill="#a78bfa" radius={[3, 3, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </div>

                <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-6">
                    <h2 className="font-semibold text-white mb-1">Price Trend (Average %)</h2>
                    <p className="text-white/30 text-xs mb-4">Best-effort — parsed from change text</p>
                    {trendData.every(d => d.avgPct === null) ? (
                        <div className="h-40 flex items-center justify-center text-white/20 text-sm">No parseable price data</div>
                    ) : (
                        <ResponsiveContainer width="100%" height={200}>
                            <LineChart data={trendData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                                <XAxis dataKey="date" tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} axisLine={false} tickLine={false} interval={Math.ceil(trendData.length / 8)} />
                                <YAxis tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} axisLine={false} tickLine={false} unit="%" />
                                <Tooltip content={<CustomTooltip />} />
                                <Line type="monotone" dataKey="avgPct" name="Avg Price Change" stroke="#8b5cf6" strokeWidth={2} dot={false} connectNulls />
                            </LineChart>
                        </ResponsiveContainer>
                    )}
                </div>
            </div>

            {/* Donut + summary */}
            <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-6">
                    <h2 className="font-semibold text-white mb-4">Change Breakdown</h2>
                    {donutData.length === 0 ? (
                        <div className="h-48 flex items-center justify-center text-white/20 text-sm">No data yet</div>
                    ) : (
                        <div className="flex items-center gap-6">
                            <ResponsiveContainer width={160} height={160}>
                                <PieChart>
                                    <Pie data={donutData} dataKey="value" innerRadius={50} outerRadius={75} paddingAngle={2}>
                                        {donutData.map((d, i) => <Cell key={i} fill={d.color} stroke="none" />)}
                                    </Pie>
                                    <Tooltip content={<CustomTooltip />} />
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="flex flex-col gap-2">
                                {donutData.map((d, i) => (
                                    <div key={i} className="flex items-center gap-2 text-sm">
                                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />
                                        <span className="text-white/60">{d.name}</span>
                                        <span className="text-white/30 ml-auto">{d.value}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-6">
                    <h2 className="font-semibold text-white mb-4">Summary</h2>
                    {stats.total === 0 ? (
                        <p className="text-white/30 text-sm">No changes for the selected period yet.</p>
                    ) : (
                        <ul className="text-sm text-white/60 space-y-2">
                            <li>{stats.total} change{stats.total === 1 ? '' : 's'} in the selected period.</li>
                            {stats.counts.new > 0 && <li>{stats.counts.new} new product{stats.counts.new === 1 ? '' : 's'} added.</li>}
                            {stats.counts.removed > 0 && <li>{stats.counts.removed} product{stats.counts.removed === 1 ? '' : 's'} removed.</li>}
                            {stats.avgPct !== null && (
                                <li>Prices changed by an average of {stats.avgPct > 0 ? '+' : ''}{stats.avgPct.toFixed(1)}%.</li>
                            )}
                            {stats.counts.price_down + stats.counts.price_up > 0 && (
                                <li>Price changes: {stats.counts.price_down} drops, {stats.counts.price_up} increases.</li>
                            )}
                        </ul>
                    )}
                    <p className="text-white/20 text-xs mt-4">Computed directly from saved changes, without a separate AI call.</p>
                </div>
            </div>

            {/* Feed */}
            <div>
                <div className="flex items-center justify-between mb-4">
                    <h2 className="font-semibold text-white">Change Feed</h2>
                    <span className="text-white/30 text-xs">{filteredFlagRows.length} of {allFlagRows.length}</span>
                </div>
                {filteredFlagRows.length === 0 ? (
                    <div className="bg-white/[0.02] border border-white/5 border-dashed rounded-2xl py-16 text-center">
                        <TrendingUp size={28} className="text-white/20 mx-auto mb-3" />
                        <p className="text-white/40 font-medium">Nothing found</p>
                        <p className="text-white/20 text-sm mt-1">Try a different period or filter</p>
                    </div>
                ) : (
                    <div className="flex flex-col divide-y divide-white/5 border border-white/5 rounded-2xl overflow-hidden">
                        {filteredFlagRows.map(row => {
                            const cls = classifyFlag(row.flag)
                            const Icon = cls.icon
                            const priceInfo = parsePriceChange(row.flag)
                            return (
                                <div key={row.id} className="flex items-center gap-4 px-5 py-4 bg-white/[0.02] hover:bg-white/[0.04] transition-colors">
                                    <div className="flex flex-col items-center flex-shrink-0 w-14">
                                        <span className="text-white/30 text-[10px]">
                                            {row.date?.toLocaleDateString('en-US', { day: '2-digit', month: 'short' })}
                                        </span>
                                        <span className="text-white/20 text-[10px]">
                                            {row.date?.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                    <Icon size={16} style={{ color: cls.color }} className="flex-shrink-0" />
                                    <span
                                        className="text-xs font-medium px-2.5 py-1 rounded-full flex-shrink-0"
                                        style={{ backgroundColor: `${cls.color}1A`, color: cls.color }}
                                    >
                                        {cls.label}
                                    </span>
                                    <p className="text-white/70 text-sm flex-1 min-w-0 truncate">{row.flag}</p>
                                    {priceInfo && (
                                        <span className="text-xs font-medium flex-shrink-0" style={{ color: cls.color }}>
                                            {priceInfo.pct > 0 ? '+' : ''}{priceInfo.pct.toFixed(1)}%
                                        </span>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
        </div>
    )
}

// ─── ALL SITES HISTORY ───────────────────────────────────────────────────────

function AllHistory({ onSelectSite }) {
    const [allChanges, setAllChanges] = useState([])
    const [chartData, setChartData] = useState([])
    const [loading, setLoading] = useState(true)
    const [user, setUser] = useState(null)

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, currentUser => {
            if (currentUser) {
                setUser(currentUser)
                loadAllChanges(currentUser.uid)
            }
        })
        return unsub
    }, [])

    async function loadAllChanges(userId) {
        try {
            const snapshot = await getDocs(query(
                collection(db, 'changes'),
                where('userId', '==', userId)
            ))
            const data = snapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() }))
                .sort((a, b) => b.detected_at?.seconds - a.detected_at?.seconds)
            setAllChanges(data)
            setChartData(buildChartData(data, 30))
        } catch (err) {
            console.error('Failed to load all changes:', err)
        } finally {
            setLoading(false)
        }
    }

    const bySite = allChanges.reduce((acc, change) => {
        const key = change.url
        if (!acc[key]) acc[key] = []
        acc[key].push(change)
        return acc
    }, {})

    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    const recentCount = allChanges.filter(c => {
        const d = c.detected_at?.toDate()
        return d && d > sevenDaysAgo
    }).length

    if (loading) return (
        <div className="flex items-center justify-center h-64">
            <p className="text-white/40">Loading history...</p>
        </div>
    )

    return (
        <div className="p-8">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-white">History</h1>
                <p className="text-white/40 mt-1 text-sm">All detected changes across your monitored sites</p>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-5">
                    <div className="flex items-center gap-2 mb-3">
                        <TrendingUp size={16} className="text-violet-400" />
                        <span className="text-white/40 text-sm">Total Changes</span>
                    </div>
                    <p className="text-3xl font-bold text-white">{allChanges.length}</p>
                    <p className="text-white/30 text-xs mt-1">across all sites</p>
                </div>
                <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-5">
                    <div className="flex items-center gap-2 mb-3">
                        <Clock size={16} className="text-blue-400" />
                        <span className="text-white/40 text-sm">Last 7 Days</span>
                    </div>
                    <p className="text-3xl font-bold text-white">{recentCount}</p>
                    <p className="text-white/30 text-xs mt-1">recent changes</p>
                </div>
                <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-5">
                    <div className="flex items-center gap-2 mb-3">
                        <Globe size={16} className="text-green-400" />
                        <span className="text-white/40 text-sm">Sites with Changes</span>
                    </div>
                    <p className="text-3xl font-bold text-white">{Object.keys(bySite).length}</p>
                    <p className="text-white/30 text-xs mt-1">out of monitored sites</p>
                </div>
            </div>

            <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-6 mb-6">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h2 className="font-semibold text-white">Overall Activity</h2>
                        <p className="text-white/30 text-xs mt-0.5">Total changes across all sites per day</p>
                    </div>
                    <span className="text-white/30 text-xs bg-white/5 px-3 py-1.5 rounded-lg">Last 30 days</span>
                </div>
                {allChanges.length === 0 ? (
                    <div className="h-40 flex items-center justify-center text-white/20">
                        <p className="text-sm">No changes detected yet</p>
                    </div>
                ) : (
                    <ResponsiveContainer width="100%" height={160}>
                        <BarChart data={chartData} barSize={8}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                            <XAxis dataKey="date" tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} axisLine={false} tickLine={false} interval={4} />
                            <YAxis tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                            <Bar dataKey="changes" fill="url(#allGrad)" radius={[3, 3, 0, 0]} />
                            <defs>
                                <linearGradient id="allGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#6366f1" />
                                    <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.5} />
                                </linearGradient>
                            </defs>
                        </BarChart>
                    </ResponsiveContainer>
                )}
            </div>

            {allChanges.length > 0 && <FlagBreakdown changes={allChanges} />}

            {Object.keys(bySite).length > 0 && (
                <div className="mb-6">
                    <h2 className="font-semibold text-white mb-4">Changes by Site</h2>
                    <div className="flex flex-col gap-3">
                        {Object.entries(bySite).map(([url, siteChanges]) => {
                            let hostname = url
                            try { hostname = new URL(url).hostname } catch {}
                            const initial = hostname[0]?.toUpperCase()
                            const lastChange = siteChanges[0]?.detected_at?.toDate()
                            return (
                                <button
                                    key={url}
                                    onClick={() => onSelectSite(url)}
                                    className="bg-white/[0.03] border border-white/5 rounded-2xl p-5 flex items-center justify-between gap-4 hover:bg-white/[0.06] hover:border-white/10 transition-all duration-200 text-left w-full"
                                >
                                    <div className="flex items-center gap-4 min-w-0">
                                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500/20 to-violet-500/20 flex items-center justify-center text-sm font-bold text-blue-400 flex-shrink-0">
                                            {initial}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-white font-medium truncate">{hostname}</p>
                                            <p className="text-white/30 text-xs mt-0.5">
                                                Last change: {lastChange?.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 shrink-0">
                                        <div className="text-right">
                                            <p className="text-white font-semibold">{siteChanges.length}</p>
                                            <p className="text-white/30 text-xs">changes</p>
                                        </div>
                                        <span className="text-white/20 text-sm">→</span>
                                    </div>
                                </button>
                            )
                        })}
                    </div>
                </div>
            )}

            <div>
                <h2 className="font-semibold text-white mb-4">Recent Changes</h2>
                {allChanges.length === 0 ? (
                    <div className="bg-white/[0.02] border border-white/5 border-dashed rounded-2xl py-20 text-center">
                        <TrendingUp size={32} className="text-white/20 mx-auto mb-3" />
                        <p className="text-white/40 font-medium">No changes detected yet</p>
                        <p className="text-white/20 text-sm mt-1">Add competitor sites on Dashboard to start monitoring</p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-3">
                        {allChanges.slice(0, 10).map(change => (
                            <ChangeCard key={change.id} change={change} onClick={() => onSelectSite(change.url)} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────

function History() {
    const [searchParams, setSearchParams] = useSearchParams()
    const siteUrl = searchParams.get('url')

    function handleSelectSite(url) {
        setSearchParams({ url })
    }

    function handleBack() {
        setSearchParams({})
    }

    if (siteUrl) {
        return <SiteHistory siteUrl={siteUrl} onBack={handleBack} />
    }

    return <AllHistory onSelectSite={handleSelectSite} />
}

export default History
