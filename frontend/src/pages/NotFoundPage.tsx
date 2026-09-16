import { Link } from 'react-router'

export default function NotFoundPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 text-center">
      <p className="text-4xl" aria-hidden="true">🔍</p>
      <h1 className="text-xl font-bold">ページが見つかりません</h1>
      <p className="text-sm text-gray-500">
        お探しのページは移動または削除された可能性があります。
      </p>
      <Link to="/" className="rounded bg-black px-4 py-2 text-sm text-white">
        トップへ戻る
      </Link>
    </div>
  )
}
