import http from 'k6/http'
import { check } from 'k6'

// フェーズ7-5・目的①（キャパシティ限界）のトラックB: ログイン→レビュー投稿だけをランプアップする。
// 毎イテレーションで新規ユーザーを作るため(userId, movieId)は必ず未使用の組み合わせになり、
// 409ではなく毎回本物のINSERTが発生する。TMDBはsetup()での映画登録（冪等）以外は一切呼ばない。
// 詳細: docs/decisions.md「フェーズ7-5: k6負荷試験（本番）の実施方針」
const BASE_URL = __ENV.BASE_URL || 'http://backend:3000'
const PASSWORD = 'k6-password-123'
const MOVIE_ID = '603' // The Matrix。authenticated-flow.jsと共通
// __VU/__ITERは実行ごとにリセットされるため、これだけだと再実行時に前回と同じメールアドレスに
// なり409で衝突する。モジュール読み込み時（実行ごとに1回）に決まるランダム値を混ぜて回避する
const RUN_ID = Math.floor(Math.random() * 1e9)

export const options = {
  scenarios: {
    writing: {
      executor: 'ramping-vus',
      stages: [
        { duration: '30s', target: 10 },
        { duration: '30s', target: 30 },
        { duration: '30s', target: 60 },
        { duration: '30s', target: 100 },
        { duration: '30s', target: 150 },
        { duration: '30s', target: 200 },
        { duration: '30s', target: 300 },
        { duration: '30s', target: 500 },
        { duration: '30s', target: 800 },
        { duration: '30s', target: 1200 },
      ],
    },
  },
  thresholds: {
    'http_req_failed{scenario:writing}': [{ threshold: 'rate<0.05', abortOnFail: true }],
    'http_req_duration{scenario:writing}': ['p(95)<2000'],
  },
}

// The Matrixが本番にまだ登録されていない可能性があるため、setup()で一度だけ確認・登録する
// （既に登録済みならRegisterMovieが早期returnし、TMDBは呼ばれない）
export function setup() {
  const email = 'k6-write-setup@test.local'
  let res = http.post(
    `${BASE_URL}/auth/register`,
    JSON.stringify({ email, password: PASSWORD }),
    { headers: { 'Content-Type': 'application/json' }, responseCallback: http.expectedStatuses(200, 409) },
  )
  if (res.status === 409) {
    res = http.post(
      `${BASE_URL}/auth/login`,
      JSON.stringify({ email, password: PASSWORD }),
      { headers: { 'Content-Type': 'application/json' } },
    )
  }
  const accessToken = res.json('accessToken')

  http.post(
    `${BASE_URL}/movies`,
    JSON.stringify({ tmdbId: MOVIE_ID }),
    { headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' } },
  )
}

export default function () {
  // __VU・__ITERで毎回一意になるメールアドレス。ハイフンはメールアドレスとして無害
  const email = `k6-write-${RUN_ID}-${__VU}-${__ITER}@test.local`

  const registerRes = http.post(
    `${BASE_URL}/auth/register`,
    JSON.stringify({ email, password: PASSWORD }),
    { headers: { 'Content-Type': 'application/json' }, tags: { step: 'register' } },
  )
  check(registerRes, { 'register: status 200': (r) => r.status === 200 })

  const loginRes = http.post(
    `${BASE_URL}/auth/login`,
    JSON.stringify({ email, password: PASSWORD }),
    { headers: { 'Content-Type': 'application/json' }, tags: { step: 'login' } },
  )
  check(loginRes, { 'login: status 200': (r) => r.status === 200 })
  const accessToken = loginRes.json('accessToken')

  const scoreValue = Number((Math.floor(Math.random() * 51) / 10).toFixed(1)) // 0.0〜5.0を0.1刻み
  const reviewRes = http.post(
    `${BASE_URL}/reviews`,
    JSON.stringify({ movieId: MOVIE_ID, score: scoreValue }),
    {
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      tags: { step: 'review' },
    },
  )
  check(reviewRes, { 'review: status 201': (r) => r.status === 201 })
}
