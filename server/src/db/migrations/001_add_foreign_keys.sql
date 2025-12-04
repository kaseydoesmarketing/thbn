-- Migration: Add foreign key constraints
-- Run this AFTER verifying there are no orphan records

-- Check for orphans first (run manually):
-- SELECT * FROM face_profiles fp WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = fp.user_id);
-- SELECT * FROM thumbnail_jobs tj WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = tj.user_id);
-- SELECT * FROM thumbnail_variants tv WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = tv.user_id);

-- Add FK to face_profiles (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'fk_face_profiles_user' AND table_name = 'face_profiles'
    ) THEN
        ALTER TABLE face_profiles
        ADD CONSTRAINT fk_face_profiles_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Add FK to thumbnail_jobs (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'fk_thumbnail_jobs_user' AND table_name = 'thumbnail_jobs'
    ) THEN
        ALTER TABLE thumbnail_jobs
        ADD CONSTRAINT fk_thumbnail_jobs_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Add FK to thumbnail_variants (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'fk_thumbnail_variants_user' AND table_name = 'thumbnail_variants'
    ) THEN
        ALTER TABLE thumbnail_variants
        ADD CONSTRAINT fk_thumbnail_variants_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Add FK to users.approved_by (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'fk_users_approved_by' AND table_name = 'users'
    ) THEN
        ALTER TABLE users
        ADD CONSTRAINT fk_users_approved_by
        FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Add useful indexes for foreign keys
CREATE INDEX IF NOT EXISTS idx_face_profiles_user_id ON face_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_thumbnail_jobs_user_id ON thumbnail_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_thumbnail_variants_user_id ON thumbnail_variants(user_id);
