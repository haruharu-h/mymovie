import http from 'k6/http'
import { check, sleep } from 'k6'

// フェーズ7-5・目的①（キャパシティ限界）のトラックC: 閲覧系エンドポイントだけをランプアップする。
// 対象は全部DBのみでTMDBを一切呼ばない（GetMovieDetail/GetCurrentUser/SearchUsers/GetFollowsは
// TmdbApiClientを持たない。詳細: docs/decisions.md「フェーズ7-5: k6負荷試験（本番）の実施方針」）
const BASE_URL = __ENV.BASE_URL || 'http://backend:3000'

// 200(新規登録成功)・409(前回実行分が既に登録済み。正常系)の両方を成功扱いにする。
// authenticated-flow.jsのreviewExpectedStatusesと同じ理由（k6のhttp_req_failedはデフォルト200-399のみ成功）
const registerExpectedStatuses = http.expectedStatuses(200, 409)

const USERS = [
  { email: 'k6-browse-1@test.local', queries: ['love', 'war'] },
  { email: 'k6-browse-2@test.local', queries: ['time', 'star'] },
  { email: 'k6-browse-3@test.local', queries: ['life', 'dark'] },
]
const PASSWORD = 'k6-password-123'
const MOVIES_PER_USER = 20

export const options = {
  scenarios: {
    browsing: {
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
    // scenario:browsingでタグ絞り込みし、setup()内のリクエスト（登録済みなら409が正常系）を
    // しきい値判定に含めない。エラー率5%を超えたら自動停止（無駄に攻め続けない）
    'http_req_failed{scenario:browsing}': [{ threshold: 'rate<0.05', abortOnFail: true }],
    // DBコネクションプール枯渇は「順番待ち」でレイテンシが伸びるだけでエラーにならないため、
    // エラー率だけでは検知できない。p95も別途見る（詳細: notes/learning/2026-08-07-percentile-p95.md）
    'http_req_duration{scenario:browsing}': ['p(95)<2000'],
  },
}

function registerOrLogin(email, password) {
  let res = http.post(
    `${BASE_URL}/auth/register`,
    JSON.stringify({ email, password }),
    { headers: { 'Content-Type': 'application/json' }, responseCallback: registerExpectedStatuses },
  )
  if (res.status === 409) {
    res = http.post(
      `${BASE_URL}/auth/login`,
      JSON.stringify({ email, password }),
      { headers: { 'Content-Type': 'application/json' } },
    )
  }
  check(res, { 'setup: accessTokenが取れる': (r) => r.json('accessToken') !== undefined })
  return res.json('accessToken')
}

// 検索結果から、他ユーザーとも重複しない movieId を集める（usedIds はユーザー間で共有）
function collectDistinctMovieIds(accessToken, queries, count, usedIds) {
  const ids = []
  for (const q of queries) {
    if (ids.length >= count) break
    const res = http.get(
      `${BASE_URL}/movies/search?q=${encodeURIComponent(q)}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    )
    const movies = res.json('movies') || []
    for (const m of movies) {
      if (ids.length >= count) break
      if (usedIds.has(m.id)) continue
      usedIds.add(m.id)
      ids.push(m.id)
    }
  }
  return ids
}

// setup()は負荷開始前に1回だけ実行される。3ユーザー×別々の20本（重複無し）を用意し、
// 各ユーザーが自分の20本にそれぞれ1件レビューを投稿する（合計60本・60件）。
// TMDB呼び出しは検索数回＋登録60回のみで、ここでしか発生しない
export function setup() {
  const usedMovieIds = new Set()
  const users = []

  for (const u of USERS) {
    const accessToken = registerOrLogin(u.email, PASSWORD)
    const movieIds = collectDistinctMovieIds(accessToken, u.queries, MOVIES_PER_USER, usedMovieIds)
    check(movieIds, { 'setup: 20本の映画が確保できた': (ids) => ids.length === MOVIES_PER_USER })

    const headers = { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }
    for (const movieId of movieIds) {
      http.post(`${BASE_URL}/movies`, JSON.stringify({ tmdbId: movieId }), { headers })
    }
    for (const movieId of movieIds) {
      const score = Number((Math.floor(Math.random() * 51) / 10).toFixed(1))
      http.post(`${BASE_URL}/reviews`, JSON.stringify({ movieId, score }), { headers })
    }

    users.push({ accessToken, movieIds })
  }

  return { users }
}

// アクセストークンの有効期限は15分（JwtService.ts）。このテストの全ステージ合計は3分なので、
// VUごとに1回取得したトークンを使い続けて問題ない（ログインし直さない。閲覧系の限界だけを見たいので、
// argon2idのハッシュ比較コストを毎回乗せて紛れさせたくない）
export default function (data) {
  const user = data.users[(__VU - 1) % data.users.length]
  const headers = { Authorization: `Bearer ${user.accessToken}` }

  const action = Math.floor(Math.random() * 5)
  if (action === 0) {
    const movieId = user.movieIds[Math.floor(Math.random() * user.movieIds.length)]
    const res = http.get(`${BASE_URL}/movies/${movieId}`, { headers, tags: { step: 'movie_detail' } })
    check(res, { 'movie detail: status 200': (r) => r.status === 200 })
  } else if (action === 1) {
    const res = http.get(`${BASE_URL}/reviews`, { headers, tags: { step: 'reviews_list' } })
    check(res, { 'reviews: status 200': (r) => r.status === 200 })
  } else if (action === 2) {
    const res = http.get(`${BASE_URL}/users/me`, { headers, tags: { step: 'users_me' } })
    check(res, { 'users/me: status 200': (r) => r.status === 200 })
  } else if (action === 3) {
    const res = http.get(`${BASE_URL}/users/search?q=k6`, { headers, tags: { step: 'users_search' } })
    check(res, { 'users/search: status 200': (r) => r.status === 200 })
  } else {
    const res = http.get(`${BASE_URL}/follows`, { headers, tags: { step: 'follows' } })
    check(res, { 'follows: status 200': (r) => r.status === 200 })
  }

  sleep(1)
}
