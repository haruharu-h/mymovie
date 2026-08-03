import http from 'k6/http'
import { check, sleep } from 'k6'

// 201(初回成功)・409(レビュー済み。業務ルール上の正常系)の両方をk6の「成功」判定に含める。
// checkとは別に、k6組み込みのhttp_req_failedメトリクス自体はデフォルトで200-399しか
// 成功扱いしないため、これを明示しないとthresholds判定がズレる
const reviewExpectedStatuses = http.expectedStatuses(201, 409)

// 観点3: 向き先を変えるだけでフェーズ7（クラウド）でも使い回せるようにする
const BASE_URL = __ENV.BASE_URL || 'http://backend:3000'

export const options = {
  vus: 5,
  duration: '20s',
  thresholds: {
    // ローカルでは絶対的な性能目標ではなく「大崩れしていないか」のサニティチェック
    http_req_failed: ['rate<0.05'],
    http_req_duration: ['p(95)<3000'],
  },
}

// setup()は負荷開始前に1回だけ実行される。テストユーザー・映画をここで1組だけ用意し、
// 検索以外でTMDBへの問い合わせが繰り返し発生しないようにする
export function setup() {
  const email = 'k6-loadtest@test.local'
  const password = 'k6-password-123'

  let res = http.post(
    `${BASE_URL}/auth/register`,
    JSON.stringify({ email, password }),
    { headers: { 'Content-Type': 'application/json' } },
  )

  // 前回の実行で既に登録済みならログインにフォールバック
  if (res.status === 409) {
    res = http.post(
      `${BASE_URL}/auth/login`,
      JSON.stringify({ email, password }),
      { headers: { 'Content-Type': 'application/json' } },
    )
  }
  check(res, { 'setup: accessTokenが取れる': (r) => r.json('accessToken') !== undefined })
  const accessToken = res.json('accessToken')

  const movieId = '603' // The Matrix。RegisterMovieは登録済みならローカルDBチェックのみでTMDBを叩かない
  http.post(
    `${BASE_URL}/movies`,
    JSON.stringify({ tmdbId: movieId }),
    { headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' } },
  )

  return { email, password, movieId }
}

export default function (data) {
  // 本物のユーザーのようにセッションのたびにログインし直す
  const loginRes = http.post(
    `${BASE_URL}/auth/login`,
    JSON.stringify({ email: data.email, password: data.password }),
    { headers: { 'Content-Type': 'application/json' }, tags: { step: 'login' } },
  )
  check(loginRes, { 'login: status 200': (r) => r.status === 200 })
  const accessToken = loginRes.json('accessToken')

  sleep(1) // think time

  const searchRes = http.get(
    `${BASE_URL}/movies/search?q=matrix`,
    { headers: { Authorization: `Bearer ${accessToken}` }, tags: { step: 'search' } },
  )
  check(searchRes, { 'search: status 200': (r) => r.status === 200 })

  sleep(1)

  const scoreValue = Number((Math.floor(Math.random() * 51) / 10).toFixed(1)) // 0.0〜5.0を0.1刻み
  const reviewRes = http.post(
    `${BASE_URL}/reviews`,
    JSON.stringify({ movieId: data.movieId, score: scoreValue }),
    {
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      tags: { step: 'review' },
      responseCallback: reviewExpectedStatuses,
    },
  )
  // 同じユーザー・同じ映画のため、初回以降は409（レビュー済み）になるのが正しい挙動
  check(reviewRes, { 'review: status 201 or 409': (r) => r.status === 201 || r.status === 409 })

  sleep(1)
}
