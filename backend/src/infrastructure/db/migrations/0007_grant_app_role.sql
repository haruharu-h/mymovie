-- Custom SQL migration file, put your code below! --

-- mymovie_appロール（インフラのTerraform構成（非公開）で作成、実行時Cloud Runが使う
-- 最小権限ロール）に、既存テーブルへのCRUD権限のみを付与する。DDL（CREATE/ALTER/DROP等）は
-- 意図的に許可しない。マイグレーション自体は引き続きowner（neondb_owner）で実行される。
-- このスキーマは全テーブルがuuid().defaultRandom()でsequenceを使わないため、
-- sequenceへのGRANTは不要。
--
-- このマイグレーションはローカル/E2E/統合テストの使い捨てPostgres（Testcontainers等）でも
-- 実行されるが、mymovie_appロールはNeon側のみ（本番限定、決定: docs/decisions.md
-- 「Neon接続ロールの最小権限化」）に存在する。ロールが無い環境ではGRANT自体をスキップし、
-- 安全に何もしないようにする
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'mymovie_app') THEN
    GRANT USAGE ON SCHEMA public TO mymovie_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO mymovie_app;

    -- 今後のマイグレーションで追加される新しいテーブルにも、手動でGRANTを追記しなくても
    -- 自動的に同じ権限が適用されるようにする
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO mymovie_app;
  END IF;
END $$;