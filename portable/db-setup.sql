-- Tạo role cho server nếu chưa có. start.bat chạy file này MỖI lần khởi động,
-- nên phải idempotent. Database tạo riêng bằng createdb (CREATE DATABASE không
-- chạy được trong khối DO).
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'whiteboard') THEN
    CREATE ROLE whiteboard LOGIN PASSWORD 'whiteboard';
  END IF;
END
$$;
