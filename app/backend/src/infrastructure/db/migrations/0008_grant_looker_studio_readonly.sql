-- Custom SQL migration file, put your code below! --

-- looker_studio_readonlyロール（app/infra/neon.tfのneon_roleリソースで作成、Looker Studioが
-- リードレプリカ経由で接続する読み取り専用ロール）に、ビジネス観点のダッシュボードに必要な
-- 最小限のテーブル・列だけSELECTを許可する。
--
-- 意図的にアクセスさせないもの:
--   - identities（password_hash等、認証の根幹）
--   - sessions（refresh_token_hash）
--   - audit_logs（IPアドレス等、今回の用途に不要）
--   - users の email/birthdate/sns_url（PII。id/created_atだけで十分）
--
-- 将来のマイグレーションで新しいテーブルが増えても、このロールには自動では権限が
-- 付かない（ALTER DEFAULT PRIVILEGESを設定しない）。新しくダッシュボードに使いたい
-- テーブルが出てきたら、そのときに個別のGRANTを追記する（意図しない範囲拡大を防ぐ）。
--
-- mymovie_appロールと同じ理由で、ローカル/テスト環境にはこのロールが存在しないため
-- DO $$ IF EXISTS ... $$ でGRANT自体をスキップし、安全に何もしないようにする
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'looker_studio_readonly') THEN
    GRANT USAGE ON SCHEMA public TO looker_studio_readonly;
    GRANT SELECT ON movies, reviews, follows TO looker_studio_readonly;
    GRANT SELECT (id, created_at) ON users TO looker_studio_readonly;
  END IF;
END $$;