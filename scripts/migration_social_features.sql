-- Multi-Group Leaderboard & Social Features Database Migration
-- Run this in Hasura SQL Console

-- ==================== USER FOLLOWS TABLE ====================
-- Table for FOLLOWING/FOLLOWER relationships

CREATE TABLE IF NOT EXISTS user_follows (
    id SERIAL PRIMARY KEY,
    follower_public_key TEXT NOT NULL REFERENCES users(ed25519_public_key) ON DELETE CASCADE,
    followee_public_key TEXT NOT NULL REFERENCES users(ed25519_public_key) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_follow UNIQUE(follower_public_key, followee_public_key),
    CONSTRAINT no_self_follow CHECK (follower_public_key != followee_public_key)
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_user_follows_follower ON user_follows(follower_public_key);
CREATE INDEX IF NOT EXISTS idx_user_follows_followee ON user_follows(followee_public_key);

-- ==================== NICKNAME COLUMN ====================
-- Add nickname column to users table

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'nickname'
    ) THEN
        ALTER TABLE users ADD COLUMN nickname TEXT UNIQUE;
    END IF;
END $$;

-- Index for nickname search
CREATE INDEX IF NOT EXISTS idx_users_nickname ON users(nickname);

-- ==================== TRACK HASURA ====================
-- After running this SQL, go to Hasura Console and:
-- 1. Track the user_follows table (Data > Add Table > user_follows > Track)
-- 2. Set up relationships:
--    - user_follows.follower -> users (follower relationship)
--    - user_follows.followee -> users (followee relationship)
--    - users.followers -> user_follows (array relationship where followee_public_key = ed25519_public_key)
--    - users.following -> user_follows (array relationship where follower_public_key = ed25519_public_key)
-- 3. Set permissions for anonymous role to allow select/insert/delete on user_follows
