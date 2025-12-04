-- Users
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    role VARCHAR(50) DEFAULT 'user', -- 'admin', 'user'
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'approved', 'suspended'
    approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    approved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);

-- Face Profiles
CREATE TABLE IF NOT EXISTS face_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255),
    status VARCHAR(50) DEFAULT 'active', -- active, archived
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Face Profile Images (Reference images)
CREATE TABLE IF NOT EXISTS face_profile_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    face_profile_id UUID REFERENCES face_profiles(id) ON DELETE CASCADE,
    storage_key VARCHAR(512) NOT NULL, -- Path in bucket
    quality_status VARCHAR(50), -- good, low_light, blurry
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Thumbnail Jobs
CREATE TABLE IF NOT EXISTS thumbnail_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    video_url TEXT,
    video_title TEXT,
    niche VARCHAR(100),
    style_preset VARCHAR(100),
    brief_json JSONB, -- Stores the chat brief, emotions, layout preferences
    status VARCHAR(50) DEFAULT 'queued', -- queued, processing, completed, failed
    nano_job_id VARCHAR(255), -- External ID from Nano Banana
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Thumbnail Variants (Outputs)
CREATE TABLE IF NOT EXISTS thumbnail_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    thumbnail_job_id UUID REFERENCES thumbnail_jobs(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    storage_key VARCHAR(512) NOT NULL,
    variant_label VARCHAR(50), -- v1, v2, v3
    is_favorite BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
