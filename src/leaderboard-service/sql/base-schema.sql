-- Base Schema for Gaming Platform
-- Creates the foundational tables needed by the leaderboard service

-- ============================================================================
-- USERS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS users (
    user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    display_name VARCHAR(100),
    avatar_url VARCHAR(500),
    region VARCHAR(50) DEFAULT 'UNKNOWN',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_region ON users(region);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active);

-- ============================================================================
-- USER STATS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_stats (
    user_id UUID PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
    games_played INTEGER DEFAULT 0,
    games_won INTEGER DEFAULT 0,
    games_lost INTEGER DEFAULT 0,
    games_drawn INTEGER DEFAULT 0,
    current_streak INTEGER DEFAULT 0,
    best_streak INTEGER DEFAULT 0,
    total_playtime_seconds INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_stats_games_played ON user_stats(games_played);
CREATE INDEX IF NOT EXISTS idx_user_stats_games_won ON user_stats(games_won);
CREATE INDEX IF NOT EXISTS idx_user_stats_updated ON user_stats(updated_at);

-- ============================================================================
-- TRIGGER TO AUTO-UPDATE updated_at
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_stats_updated_at ON user_stats;
CREATE TRIGGER update_user_stats_updated_at
    BEFORE UPDATE ON user_stats
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- SEED DATA FOR TESTING
-- ============================================================================

-- Insert some test users if table is empty
INSERT INTO users (username, email, display_name, region)
SELECT 
    'player' || i,
    'player' || i || '@example.com',
    'Player ' || i,
    CASE (i % 5)
        WHEN 0 THEN 'NA'
        WHEN 1 THEN 'EU'
        WHEN 2 THEN 'ASIA'
        WHEN 3 THEN 'SA'
        ELSE 'OCE'
    END
FROM generate_series(1, 20) AS i
WHERE NOT EXISTS (SELECT 1 FROM users LIMIT 1);

-- Insert corresponding stats
INSERT INTO user_stats (user_id, games_played, games_won, games_lost, games_drawn, current_streak, best_streak)
SELECT 
    u.user_id,
    (random() * 100)::INTEGER + 5,
    (random() * 50)::INTEGER,
    (random() * 40)::INTEGER,
    (random() * 10)::INTEGER,
    (random() * 5)::INTEGER,
    (random() * 10)::INTEGER
FROM users u
WHERE NOT EXISTS (SELECT 1 FROM user_stats WHERE user_stats.user_id = u.user_id);

-- Update games_won to be realistic (not more than games_played)
UPDATE user_stats
SET games_won = LEAST(games_won, games_played - games_lost - games_drawn);

