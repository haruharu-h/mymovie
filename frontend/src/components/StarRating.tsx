type Props = {
  score: number
  showValue?: boolean
  size?: 'sm' | 'md' | 'lg'
}

const SIZE = {
  sm: 'text-sm',
  md: 'text-xl',
  lg: 'text-3xl',
}

export function StarRating({ score, showValue = true, size = 'md' }: Props) {
  const percentage = (score / 5) * 100

  return (
    <div className="flex items-center gap-1.5">
      <div className={`relative inline-block leading-none ${SIZE[size]}`}>
        <span className="text-gray-200">★★★★★</span>
        <span
          className="absolute inset-0 overflow-hidden text-yellow-400 whitespace-nowrap"
          style={{ width: `${percentage}%` }}
        >
          ★★★★★
        </span>
      </div>
      {showValue && (
        <span className={`font-bold tabular-nums ${size === 'lg' ? 'text-2xl' : 'text-sm'}`}>
          {score.toFixed(1)}
        </span>
      )}
    </div>
  )
}
