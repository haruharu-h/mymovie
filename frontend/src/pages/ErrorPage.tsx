import { Link } from 'react-router'

export default function ErrorPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 text-center">
      <p className="text-4xl">⚠️</p>
      <h1 className="text-xl font-bold">エラーが発生しました</h1>
      <p className="text-sm text-gray-500">
        しばらく時間をおいてから再度お試しください。
      </p>
      <Link to="/" className="rounded bg-black px-4 py-2 text-sm text-white">
        トップへ戻る
      </Link>
    </div>
  )
}
