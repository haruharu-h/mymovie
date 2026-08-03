import { Link, useLocation } from 'react-router'

const NAV_ITEMS = [
  { to: '/', label: 'マイレビュー' },
  { to: '/search', label: 'ユーザー検索' },
  { to: '/following', label: 'フォロー中' },
  { to: '/profile', label: 'プロフィール' },
]

export function Layout({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation()

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b bg-white sticky top-0 z-10">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 h-auto sm:h-12 py-2 sm:py-0 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0">
          <Link to="/" className="font-bold text-sm tracking-wide">mymovie</Link>
          <nav className="flex items-center gap-3 sm:gap-4 overflow-x-auto">
            {NAV_ITEMS.map(({ to, label }) => (
              <Link
                key={to}
                to={to}
                className={`shrink-0 whitespace-nowrap text-sm ${
                  pathname === to ? 'font-semibold text-black' : 'text-gray-500 hover:text-black'
                }`}
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  )
}
