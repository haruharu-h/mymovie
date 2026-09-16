const { createDefaultEsmPreset } = require('ts-jest')

/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  ...createDefaultEsmPreset(), // ESM前提のtransform設定（ts-jestにuseESM: trueを渡す）
  testEnvironment: 'node', // ブラウザではなく Node 環境で実行（バックエンドなので）
  roots: ['<rootDir>/src'], // テストを探す起点。src配下だけ見る
  testMatch: ['**/*.test.ts'], // "*.test.ts" というファイル名をテストと見なす
  testPathIgnorePatterns: ['<rootDir>/node_modules/', '\\.integration\\.test\\.ts$'], // Docker(Testcontainers)前提のテストは通常実行から除外
  moduleNameMapper: {
    // ESM前提: import側の ".js" 拡張子をそのまま実ファイル(.ts)にマッピングし直す
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
}
