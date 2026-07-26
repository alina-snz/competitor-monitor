import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'

function Nav() {
    const navigate = useNavigate()

    return (
        <nav className="
            fixed top-0 left-0 right-0 z-50
            border-b border-white/5
            bg-[#050B1F]/80 backdrop-blur-md
        ">
            <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
                
                {/* Logo */}
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

                {/* Кнопки справа */}
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => navigate('/login')}
                        className="text-white/60 hover:text-white text-sm transition-colors"
                    >
                        Sign in
                    </button>
                    <Button
                        onClick={() => navigate('/login')}
                        className="bg-gradient-to-r from-blue-500 to-violet-500 hover:from-blue-600 hover:to-violet-600 text-white border-0"
                    >
                        Get started free
                    </Button>
                </div>
            </div>
        </nav>
    )
}

// Small pill used for the floating stat badges over the screenshot —
// same visual language as the in-app stat tiles, just compact enough
// to sit on top of an image.
function FloatingStat({ icon, label, value, valueClass = "text-white" }) {
    return (
        <div className="
            bg-[#0B1530]/90 backdrop-blur-xl
            border border-white/10
            rounded-2xl px-5 py-4
            shadow-2xl shadow-black/40
            flex items-center gap-3
        ">
            <div className="
                w-9 h-9 rounded-xl
                bg-gradient-to-br from-blue-500/20 to-violet-500/20
                border border-white/10
                flex items-center justify-center text-base
                flex-shrink-0
            ">
                {icon}
            </div>
            <div>
                <div className="text-white/40 text-[11px] leading-none mb-1">{label}</div>
                <div className={`font-bold text-lg leading-none ${valueClass}`}>{value}</div>
            </div>
        </div>
    )
}

function Hero() {
    const navigate = useNavigate()

    return (
        <section className="pt-32 pb-20 px-6 text-center relative overflow-hidden">
            
            {/* Фоновое свечение — декоративный элемент */}
            <div className="
                absolute top-20 left-1/2 -translate-x-1/2
                w-[600px] h-[300px]
                bg-gradient-to-r from-blue-500/20 to-violet-500/20
                blur-3xl rounded-full pointer-events-none
            " />

            <div className="max-w-4xl mx-auto relative">
                
                {/* Бейдж вверху */}
                <div className="
                    inline-flex items-center gap-2
                    bg-blue-500/10 border border-blue-500/20
                    text-blue-400 text-sm px-4 py-1.5
                    rounded-full mb-8
                ">
                    <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                    AI-powered competitor tracking
                </div>

                {/* Главный заголовок с градиентом */}
                <h1 className="
                    text-5xl md:text-7xl font-bold
                    leading-tight tracking-tight mb-6
                ">
                    Know when competitors
                    <br />
                    <span className="
                        bg-gradient-to-r from-blue-400 via-violet-400 to-blue-300
                        bg-clip-text text-transparent
                    ">
                        change their prices
                    </span>
                </h1>

                {/* Подзаголовок */}
                <p className="text-xl text-white/50 mb-10 max-w-2xl mx-auto leading-relaxed">
                    Add competitor websites. Our AI monitors them daily and sends 
                    you a Telegram alert the moment something changes.
                </p>

                {/* CTA кнопки */}
                <div className="flex gap-4 justify-center flex-wrap">
                    <Button
                        onClick={() => navigate('/login')}
                        size="lg"
                        className="
                            bg-gradient-to-r from-blue-500 to-violet-500
                            hover:from-blue-600 hover:to-violet-600
                            text-white border-0 px-8 h-12 text-base
                        "
                    >
                        Start monitoring free →
                    </Button>
                    <Button
                        variant="outline"
                        size="lg"
                        className="border-white/10 text-white hover:bg-white/5 h-12 px-8 text-base"
                    >
                        See how it works
                    </Button>
                </div>

                {/* Скриншот дашборда — стеклянная рамка + плавающие метрики */}
                <div className="mt-24 md:mt-28 relative">

                    {/* Мягкое свечение под скриншотом, по цвету бренда */}
                    <div className="
                        absolute -inset-6 md:-inset-10
                        bg-gradient-to-r from-blue-500/20 via-violet-500/10 to-blue-500/20
                        blur-3xl rounded-[2rem] pointer-events-none
                    " />

                    {/* Градиентная рамка (padding-border trick) */}
                    <div className="
                        relative rounded-2xl p-px
                        bg-gradient-to-b from-white/20 via-white/5 to-transparent
                        shadow-2xl shadow-blue-500/10
                    ">
                        <div className="bg-[#0D1B3E] rounded-2xl overflow-hidden">

                            {/* Браузерная шапка — закрепляет, что это реальный продукт, а не абстрактная картинка */}
                            <div className="
                                flex items-center gap-2
                                px-4 py-3
                                border-b border-white/5
                                bg-white/[0.02]
                            ">
                                <span className="w-2.5 h-2.5 rounded-full bg-red-400/60" />
                                <span className="w-2.5 h-2.5 rounded-full bg-amber-400/60" />
                                <span className="w-2.5 h-2.5 rounded-full bg-green-400/60" />
                                <div className="
                                    ml-3 text-white/30 text-xs
                                    bg-white/[0.03] border border-white/5
                                    rounded-md px-3 py-1
                                ">
                                    app.competitormonitor.io/history
                                </div>
                            </div>

                            {/* Сам скриншот — файл нужно положить в /public/dashboard-preview.png */}
                            <img
                                src="/dashboard-preview.png"
                                alt="Competitor Monitor analytics dashboard"
                                className="w-full block"
                            />

                            {/* Лёгкое затемнение снизу, чтобы скриншот плавно уходил в фон страницы */}
                            <div className="
                                absolute bottom-0 left-0 right-0 h-24
                                bg-gradient-to-t from-[#050B1F] to-transparent
                                pointer-events-none
                            " />
                        </div>
                    </div>

                    {/* Плавающие метрики поверх скриншота — то, что реально считает продукт */}
                    <div className="hidden md:block absolute -left-8 top-1/4 -translate-y-1/2 z-20">
                        <FloatingStat icon="📉" label="Price drops tracked" value="29" valueClass="text-emerald-400" />
                    </div>
                    <div className="hidden md:block absolute -right-8 bottom-10 z-20">
                        <FloatingStat icon="%" label="Avg. price change" value="-36.1%" valueClass="text-emerald-400" />
                    </div>
                </div>
            </div>
        </section>
    )
}

function Features() {
    const features = [
        {
            icon: "🤖",
            title: "AI-powered analysis",
            desc: "Not just text matching — our AI understands what actually changed and why it matters for your business."
        },
        {
            icon: "⚡",
            title: "Instant Telegram alerts",
            desc: "Get notified the moment a competitor drops prices or launches a new product. Never miss a move."
        },
        {
            icon: "🔍",
            title: "Smart product detection",
            desc: "AI finds product cards and prices automatically — works on any website without manual setup."
        },
        {
            icon: "📈",
            title: "Change history",
            desc: "Full timeline of every change detected. See how competitor prices moved over weeks and months."
        },
        {
            icon: "🎯",
            title: "Multi-site monitoring",
            desc: "Track up to 5 competitors simultaneously. Compare their strategies side by side."
        },
        {
            icon: "🔒",
            title: "Secure & private",
            desc: "Your data stays yours. Each account is fully isolated with enterprise-grade Firebase security."
        }
    ]

    return (
        <section className="py-24 px-6">
            <div className="max-w-6xl mx-auto">
                
                <div className="text-center mb-16">
                    <div className="text-blue-400 text-sm font-medium mb-3 uppercase tracking-wider">
                        Features
                    </div>
                    <h2 className="text-4xl font-bold mb-4">
                        Everything you need to stay ahead
                    </h2>
                    <p className="text-white/40 text-lg max-w-xl mx-auto">
                        Built for marketers and business owners who need real intelligence, not just notifications.
                    </p>
                </div>

                <div className="grid md:grid-cols-3 gap-6">
                    {features.map(item => (
                        <div
                            key={item.title}
                            className="
                                bg-white/[0.03] border border-white/5
                                rounded-2xl p-6
                                hover:bg-white/[0.06] hover:border-white/10
                                transition-all duration-300
                                group
                            "
                        >
                            <div className="
                                w-12 h-12 rounded-xl
                                bg-gradient-to-br from-blue-500/20 to-violet-500/20
                                border border-blue-500/10
                                flex items-center justify-center
                                text-2xl mb-4
                                group-hover:scale-110 transition-transform
                            ">
                                {item.icon}
                            </div>
                            <h3 className="font-semibold text-white mb-2">
                                {item.title}
                            </h3>
                            <p className="text-white/40 text-sm leading-relaxed">
                                {item.desc}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    )
}


function HowItWorks() {
    const steps = [
        {
            num: "01",
            title: "Add competitor URLs",
            desc: "Paste the URLs of sites you want to monitor. Any website works — product pages, pricing pages, homepages."
        },
        {
            num: "02",
            title: "AI scans daily",
            desc: "Our AI opens each site, finds product cards and prices automatically, and compares with yesterday's snapshot."
        },
        {
            num: "03",
            title: "Get instant alerts",
            desc: "The moment something changes — price drop, new product, promotion — you get a Telegram message with a full summary."
        }
    ]

    return (
        <section className="py-24 px-6">
            <div className="max-w-6xl mx-auto">

                <div className="text-center mb-16">
                    <div className="text-violet-400 text-sm font-medium mb-3 uppercase tracking-wider">
                        How it works
                    </div>
                    <h2 className="text-4xl font-bold mb-4">
                        Up and running in 3 steps
                    </h2>
                </div>

                <div className="grid md:grid-cols-3 gap-8">
                    {steps.map((step, i) => (
                        <div key={step.num} className="relative">
                            
                            {/* Линия между шагами */}
                            {i < steps.length - 1 && (
                                <div className="
                                    hidden md:block
                                    absolute top-6 left-[60%] right-0
                                    h-px bg-gradient-to-r from-white/10 to-transparent
                                " />
                            )}

                            <div className="
                                text-4xl font-bold
                                bg-gradient-to-r from-blue-400 to-violet-400
                                bg-clip-text text-transparent
                                mb-4
                            ">
                                {step.num}
                            </div>
                            <h3 className="text-xl font-semibold mb-3">
                                {step.title}
                            </h3>
                            <p className="text-white/40 leading-relaxed">
                                {step.desc}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    )
}


function Pricing() {
    const navigate = useNavigate()

    return (
        <section className="py-24 px-6">
            <div className="max-w-4xl mx-auto">

                <div className="text-center mb-16">
                    <div className="text-blue-400 text-sm font-medium mb-3 uppercase tracking-wider">
                        Pricing
                    </div>
                    <h2 className="text-4xl font-bold mb-4">
                        Simple, transparent pricing
                    </h2>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                    
                    {/* Free план */}
                    <div className="
                        bg-white/[0.03] border border-white/5
                        rounded-2xl p-8
                    ">
                        <div className="text-white/60 text-sm font-medium mb-2">Free</div>
                        <div className="text-5xl font-bold mb-1">$0</div>
                        <div className="text-white/40 text-sm mb-8">Forever free</div>
                        
                        <ul className="space-y-3 mb-8">
                            {[
                                "5 competitor sites",
                                "Daily monitoring",
                                "Telegram alerts",
                                "Change history",
                                "AI analysis"
                            ].map(item => (
                                <li key={item} className="flex items-center gap-3 text-sm text-white/60">
                                    <span className="text-green-400">✓</span>
                                    {item}
                                </li>
                            ))}
                        </ul>

                        <button
                            onClick={() => navigate('/login')}
                            className="
                                w-full py-3 rounded-xl
                                border border-white/10
                                text-white/60 hover:text-white hover:border-white/20
                                transition-colors text-sm font-medium
                            "
                        >
                            Get started free
                        </button>
                    </div>

                    {/* Pro план */}
                    <div className="
                        bg-gradient-to-b from-blue-500/10 to-violet-500/10
                        border border-blue-500/20
                        rounded-2xl p-8 relative overflow-hidden
                    ">
                        <div className="
                            absolute top-4 right-4
                            bg-gradient-to-r from-blue-500 to-violet-500
                            text-white text-xs font-medium
                            px-3 py-1 rounded-full
                        ">
                            Coming soon
                        </div>

                        <div className="text-blue-400 text-sm font-medium mb-2">Pro</div>
                        <div className="text-5xl font-bold mb-1">$19</div>
                        <div className="text-white/40 text-sm mb-8">per month</div>

                        <ul className="space-y-3 mb-8">
                            {[
                                "20 competitor sites",
                                "Hourly monitoring",
                                "Telegram + Email alerts",
                                "Price history charts",
                                "Multi-site comparison",
                                "Priority support"
                            ].map(item => (
                                <li key={item} className="flex items-center gap-3 text-sm text-white/60">
                                    <span className="text-blue-400">✓</span>
                                    {item}
                                </li>
                            ))}
                        </ul>

                        <button
                            className="
                                w-full py-3 rounded-xl
                                bg-gradient-to-r from-blue-500 to-violet-500
                                text-white text-sm font-medium
                                hover:from-blue-600 hover:to-violet-600
                                transition-colors opacity-50 cursor-not-allowed
                            "
                            disabled
                        >
                            Coming soon
                        </button>
                    </div>
                </div>
            </div>
        </section>
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

function Landing() {
    return (
        <div className="min-h-screen bg-[#050B1F] text-white">
            <Nav />
            <Hero />
            <Features />
            <HowItWorks />
            <Pricing />
            <Footer />
        </div>
    )
}

export default Landing
