import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'

function ThemeToggle() {
    const { theme, setTheme } = useTheme()
    const [mounted, setMounted] = useState(false)

    // Нужно дождаться пока компонент загрузится
    // иначе будет ошибка гидрации
    useEffect(() => setMounted(true), [])
    if (!mounted) return null

    return (
        <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="
                w-9 h-9 rounded-lg border border-white/10
                flex items-center justify-center
                text-sm hover:bg-white/5 transition-colors
            "
        >
            {theme === 'dark' ? '☀️' : '🌙'}
        </button>
    )
}

export default ThemeToggle