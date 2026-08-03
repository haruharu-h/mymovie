import http from 'k6/http'
import { sleep } from 'k6'

export const options = {
  vus: 10,        // 同時に動く仮想ユーザー数
  duration: '30s', // このスクリプトを実行し続ける時間
}

export default function () {
  http.get('http://backend:3000/health')
  sleep(1) // 1人の仮想ユーザーが次のリクエストを送るまでの間隔
}
