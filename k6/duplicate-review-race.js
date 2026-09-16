import http from 'k6/http'
import { check } from 'k6'
import { Counter } from 'k6/metrics'

const BASE_URL = __ENV.BASE_URL || 'http://backend:3000'
const VU_COUNT = 10

// 同じ(userId, movieId)への同時投稿が、正しく「1件だけ成功・残りは409」になるかを数える
const created = new Counter('review_created_201')
const conflicted = new Counter('review_conflicted_409')

const reviewExpectedStatuses = http.expectedStatuses(201, 409)

export const options = {
  scenarios: {
    race: {
      executor: 'per-vu-iterations', // 全VUがほぼ同時に、同じユーザー・同じ映画へレビューを投げる
      vus: VU_COUNT,
      iterations: 1,
      maxDuration: '30s',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'], // 409は正常系。5xxやタイムアウトのみ失敗として検知したい
    review_created_201: ['count==1'], // 一意制約が効いていれば、成功は必ずちょうど1件のはず
  },
}

// 毎回まっさらな(userId, movieId)の組み合わせで競合させたいので、
// 実行のたびにユニークなメールアドレスで新規ユーザーを作る（映画は使い回し、TMDBは叩かない）
export function setup() {
  const email = `k6-race-${Date.now()}@test.local`
  const password = 'k6-password-123'

  const registerRes = http.post(
    `${BASE_URL}/auth/register`,
    JSON.stringify({ email, password }),
    { headers: { 'Content-Type': 'application/json' } },
  )
  check(registerRes, { 'setup: register成功': (r) => r.status === 200 })
  const accessToken = registerRes.json('accessToken')

  const movieId = '603' // The Matrix。既に登録済みのためTMDBは叩かれない
  http.post(
    `${BASE_URL}/movies`,
    JSON.stringify({ tmdbId: movieId }),
    { headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' } },
  )

  return { accessToken, movieId }
}

export default function (data) {
  // 全VUが同じユーザー・同じ映画に対して、ほぼ同時にレビューを投げる
  const res = http.post(
    `${BASE_URL}/reviews`,
    JSON.stringify({ movieId: data.movieId, score: 4.0 }),
    {
      headers: { Authorization: `Bearer ${data.accessToken}`, 'Content-Type': 'application/json' },
      responseCallback: reviewExpectedStatuses,
    },
  )

  check(res, { 'review: status 201 or 409': (r) => r.status === 201 || r.status === 409 })

  if (res.status === 201) created.add(1)
  if (res.status === 409) conflicted.add(1)
}
