import http from 'k6/http'
import { check, sleep } from 'k6'

// span属性・ビジネスイベントログ（movie.registration_result/review.creation_result）が
// New Relicに実際に届くかを確認する軽い検証スクリプト。低VUに抑え、argon2は
// setup()の1回のみ呼ぶ（libuvスレッドプール占有を避けるため。詳細: docs/decisions.md
// 「フェーズ7-5」トラックB）。トレースはNew Relic側でサンプリングされるため、
// ある程度の件数を回して間引かれず残る件数を確保する
const BASE_URL = __ENV.BASE_URL || 'http://backend:3000'
const PASSWORD = 'k6-password-123'
const RUN_ID = Math.floor(Math.random() * 1e9)
// 複数用意し、1周目はnewly_registered/created、2周目以降は
// already_registered/duplicateが自然に出るようにする
const MOVIE_IDS = ['603', '238', '424', '155', '680', '13', '550', '27205']

export const options = {
  scenarios: {
    verify: {
      executor: 'per-vu-iterations',
      vus: 2,
      iterations: 10,
      maxDuration: '3m',
    },
  },
  thresholds: {
    // 409(重複)を正常系として扱うためエラー率では判定しない。落ちていないかの目視確認用
    http_req_failed: ['rate<1.0'],
  },
}

export function setup() {
  const email = `k6-span-check-${RUN_ID}@test.local`
  const res = http.post(
    `${BASE_URL}/auth/register`,
    JSON.stringify({ email, password: PASSWORD }),
    { headers: { 'Content-Type': 'application/json' } },
  )
  return { accessToken: res.json('accessToken') }
}

export default function (data) {
  const headers = { Authorization: `Bearer ${data.accessToken}`, 'Content-Type': 'application/json' }
  const movieId = MOVIE_IDS[__ITER % MOVIE_IDS.length]

  // 1回目=newly_registered、同じIDへの2回目以降=already_registered
  const movieRes = http.post(
    `${BASE_URL}/movies`,
    JSON.stringify({ tmdbId: movieId }),
    { headers, responseCallback: http.expectedStatuses(201) },
  )
  check(movieRes, { 'movie: 201': (r) => r.status === 201 })

  // 1回目=created、同じ(userId, movieId)への2回目以降=duplicate(409)
  const scoreValue = Number((Math.floor(Math.random() * 51) / 10).toFixed(1))
  const reviewRes = http.post(
    `${BASE_URL}/reviews`,
    JSON.stringify({ movieId, score: scoreValue }),
    { headers, responseCallback: http.expectedStatuses(201, 409) },
  )
  check(reviewRes, { 'review: 201 or 409(dup)': (r) => r.status === 201 || r.status === 409 })

  sleep(0.5)
}
