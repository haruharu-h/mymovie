import http from 'k6/http'
import { check } from 'k6'

const BASE_URL = __ENV.BASE_URL || 'http://backend:3000'
const VU_COUNT = 20 // DBクライアント(postgres)のデフォルト接続上限10を意図的に超える

// 再実行時は同じユーザー・同じ映画の組み合わせが既にレビュー済みになり409が返る（正しい業務ルール）。
// このテストの目的は「新規INSERTが必ず成功するか」ではなく「同時アクセスでエラー落ちしないか」なので、
// 201・409のどちらもk6の成功判定に含める
const reviewExpectedStatuses = http.expectedStatuses(201, 409)

export const options = {
  scenarios: {
    burst: {
      executor: 'per-vu-iterations', // 全VUがほぼ同時に開始し、各1回だけ実行する「瞬間的な集中」を作る
      vus: VU_COUNT,
      iterations: 1,
      maxDuration: '30s',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'], // プール待ちで遅くなるのは許容するが、エラーになるのは許容しない
  },
}

// setup()で映画を1本・VUの数だけ別ユーザーを事前登録しておく。
// 同じ映画に対して全員が別ユーザーとしてレビューを投げるので、ユニーク制約(userId, movieId)に
// 引っかからず全件が新規INSERTになり、DB書き込みの純粋な同時実行だけを観察できる
export function setup() {
  const movieId = '603' // The Matrix

  const users = []
  for (let i = 0; i < VU_COUNT; i++) {
    const email = `k6-pool-stress-${i}@test.local`
    const password = 'k6-password-123'

    let res = http.post(
      `${BASE_URL}/auth/register`,
      JSON.stringify({ email, password }),
      { headers: { 'Content-Type': 'application/json' } },
    )
    if (res.status === 409) {
      res = http.post(
        `${BASE_URL}/auth/login`,
        JSON.stringify({ email, password }),
        { headers: { 'Content-Type': 'application/json' } },
      )
    }
    users.push(res.json('accessToken'))
  }

  // 映画登録はTMDBを叩く可能性があるが、既に登録済みならローカルDBチェックのみで済む(RegisterMovie.ts)
  http.post(
    `${BASE_URL}/movies`,
    JSON.stringify({ tmdbId: movieId }),
    { headers: { Authorization: `Bearer ${users[0]}`, 'Content-Type': 'application/json' } },
  )

  return { movieId, users }
}

export default function (data) {
  // __VUは1始まりのVU番号。各VUに自分専用のユーザーを割り当てる
  const accessToken = data.users[(__VU - 1) % data.users.length]

  const res = http.post(
    `${BASE_URL}/reviews`,
    JSON.stringify({ movieId: data.movieId, score: 4.0 }),
    {
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      responseCallback: reviewExpectedStatuses,
    },
  )
  check(res, { 'review: status 201 or 409': (r) => r.status === 201 || r.status === 409 })
}
