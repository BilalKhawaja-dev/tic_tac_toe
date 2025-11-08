-- Leaderboard Service Database Schema
-- This schema extends the existing user_stats table with leaderboard-specific views and functions

-- ============================================================================
-- MATERIALIZED VIEWS FOR LEADERBOARD RANKINGS
-- ============================================================================

-- Global Leaderboard View
-- Calculates rankings based on win rate, total wins, and games played
-- Requires minimum 5 games to appear on leaderboard
CREATE MATERIALIZED VIEW IF NOT EXISTS global_leaderboard AS
SELECT 
    u.user_id,
    u.username,
    u.display_name,
    u.avatar_url,
    us.games_played,
    us.games_won,
    us.games_lost,
    us.games_drawn,
    us.current_streak,
    us.best_streak,
    CASE 
        WHEN us.games_played > 0 
        THEN ROUND((us.games_won::DECIMAL / us.games_played) * 100, 2)
        ELSE 0 
    END as win_percentage,
    -- Calculate ELO-style rating (simplified)
    CASE
        WHEN us.games_played >= 100 THEN 1500 + (us.games_won - us.games_lost) * 10
        WHEN us.games_played >= 50 THEN 1400 + (us.games_won - us.games_lost) * 8
        WHEN us.games_played >= 20 THEN 1300 + (us.games_won - us.games_lost) * 6
        ELSE 1200 + (us.games_won - us.games_lost) * 5
    END as rating,
    ROW_NUMBER() OVER (
        ORDER BY 
            (us.games_won::DECIMAL / GREATEST(us.games_played, 1)) DESC,
            us.games_won DESC,
            us.games_played ASC,
            us.best_streak DESC
    ) as global_rank,
    PERCENT_RANK() OVER (
        ORDER BY 
            (us.games_won::DECIMAL / GREATEST(us.games_played, 1)) DESC,
            us.games_won DESC
    ) as percentile,
    us.updated_at as last_game_at
FROM users u
INNER JOIN user_stats us ON u.user_id = us.user_id
WHERE u.is_active = TRUE 
  AND us.games_played >= 5
ORDER BY global_rank;

-- Create index on materialized view for faster queries
CREATE UNIQUE INDEX IF NOT EXISTS idx_global_leaderboard_rank 
ON global_leaderboard (global_rank);

CREATE INDEX IF NOT EXISTS idx_global_leaderboard_user 
ON global_leaderboard (user_id);

CREATE INDEX IF NOT EXISTS idx_global_leaderboard_rating 
ON global_leaderboard (rating DESC);

-- Regional Leaderboard View
-- Assumes users table has a region column (to be added if not exists)
CREATE MATERIALIZED VIEW IF NOT EXISTS regional_leaderboard AS
SELECT 
    u.user_id,
    u.username,
    u.display_name,
    u.avatar_url,
    COALESCE(u.region, 'UNKNOWN') as region,
    us.games_played,
    us.games_won,
    us.games_lost,
    us.games_drawn,
    us.current_streak,
    us.best_streak,
    CASE 
        WHEN us.games_played > 0 
        THEN ROUND((us.games_won::DECIMAL / us.games_played) * 100, 2)
        ELSE 0 
    END as win_percentage,
    CASE
        WHEN us.games_played >= 100 THEN 1500 + (us.games_won - us.games_lost) * 10
        WHEN us.games_played >= 50 THEN 1400 + (us.games_won - us.games_lost) * 8
        WHEN us.games_played >= 20 THEN 1300 + (us.games_won - us.games_lost) * 6
        ELSE 1200 + (us.games_won - us.games_lost) * 5
    END as rating,
    ROW_NUMBER() OVER (
        PARTITION BY COALESCE(u.region, 'UNKNOWN')
        ORDER BY 
            (us.games_won::DECIMAL / GREATEST(us.games_played, 1)) DESC,
            us.games_won DESC,
            us.games_played ASC,
            us.best_streak DESC
    ) as regional_rank,
    PERCENT_RANK() OVER (
        PARTITION BY COALESCE(u.region, 'UNKNOWN')
        ORDER BY 
            (us.games_won::DECIMAL / GREATEST(us.games_played, 1)) DESC,
            us.games_won DESC
    ) as regional_percentile,
    us.updated_at as last_game_at
FROM users u
INNER JOIN user_stats us ON u.user_id = us.user_id
WHERE u.is_active = TRUE 
  AND us.games_played >= 5
ORDER BY region, regional_rank;

-- Create indexes on regional leaderboard
CREATE INDEX IF NOT EXISTS idx_regional_leaderboard_region_rank 
ON regional_leaderboard (region, regional_rank);

CREATE INDEX IF NOT EXISTS idx_regional_leaderboard_user 
ON regional_leaderboard (user_id);

-- ============================================================================
-- LEADERBOARD HISTORY TABLE
-- ============================================================================

-- Track historical leaderboard positions for trend analysis
CREATE TABLE IF NOT EXISTS leaderboard_history (
    history_id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    snapshot_date DATE NOT NULL,
    global_rank INTEGER,
    regional_rank INTEGER,
    region VARCHAR(50),
    games_played INTEGER NOT NULL,
    games_won INTEGER NOT NULL,
    games_lost INTEGER NOT NULL,
    win_percentage DECIMAL(5,2),
    rating INTEGER,
    current_streak INTEGER,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_leaderboard_history_user_date 
ON leaderboard_history (user_id, snapshot_date DESC);

CREATE INDEX IF NOT EXISTS idx_leaderboard_history_date 
ON leaderboard_history (snapshot_date DESC);

-- ============================================================================
-- LEADERBOARD CACHE TABLE
-- ============================================================================

-- Cache frequently accessed leaderboard data
CREATE TABLE IF NOT EXISTS leaderboard_cache (
    cache_key VARCHAR(255) PRIMARY KEY,
    cache_data JSONB NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leaderboard_cache_expires 
ON leaderboard_cache (expires_at);

-- ============================================================================
-- FUNCTIONS FOR LEADERBOARD MANAGEMENT
-- ============================================================================

-- Function to refresh global leaderboard materialized view
CREATE OR REPLACE FUNCTION refresh_global_leaderboard()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY global_leaderboard;
END;
$$ LANGUAGE plpgsql;

-- Function to refresh regional leaderboard materialized view
CREATE OR REPLACE FUNCTION refresh_regional_leaderboard()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY regional_leaderboard;
END;
$$ LANGUAGE plpgsql;

-- Function to refresh all leaderboards
CREATE OR REPLACE FUNCTION refresh_all_leaderboards()
RETURNS void AS $$
BEGIN
    PERFORM refresh_global_leaderboard();
    PERFORM refresh_regional_leaderboard();
END;
$$ LANGUAGE plpgsql;

-- Function to get user's leaderboard position
CREATE OR REPLACE FUNCTION get_user_leaderboard_position(p_user_id UUID)
RETURNS TABLE (
    global_rank BIGINT,
    regional_rank BIGINT,
    region VARCHAR,
    total_players BIGINT,
    regional_players BIGINT,
    percentile DOUBLE PRECISION
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        gl.global_rank,
        rl.regional_rank,
        rl.region,
        (SELECT COUNT(*) FROM global_leaderboard) as total_players,
        (SELECT COUNT(*) FROM regional_leaderboard WHERE regional_leaderboard.region = rl.region) as regional_players,
        gl.percentile
    FROM global_leaderboard gl
    LEFT JOIN regional_leaderboard rl ON gl.user_id = rl.user_id
    WHERE gl.user_id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- Function to capture daily leaderboard snapshot
CREATE OR REPLACE FUNCTION capture_leaderboard_snapshot()
RETURNS INTEGER AS $$
DECLARE
    rows_inserted INTEGER;
BEGIN
    INSERT INTO leaderboard_history (
        user_id,
        snapshot_date,
        global_rank,
        regional_rank,
        region,
        games_played,
        games_won,
        games_lost,
        win_percentage,
        rating,
        current_streak
    )
    SELECT 
        gl.user_id,
        CURRENT_DATE,
        gl.global_rank,
        rl.regional_rank,
        rl.region,
        gl.games_played,
        gl.games_won,
        gl.games_lost,
        gl.win_percentage,
        gl.rating,
        gl.current_streak
    FROM global_leaderboard gl
    LEFT JOIN regional_leaderboard rl ON gl.user_id = rl.user_id
    ON CONFLICT (user_id, snapshot_date) 
    DO UPDATE SET
        global_rank = EXCLUDED.global_rank,
        regional_rank = EXCLUDED.regional_rank,
        games_played = EXCLUDED.games_played,
        games_won = EXCLUDED.games_won,
        games_lost = EXCLUDED.games_lost,
        win_percentage = EXCLUDED.win_percentage,
        rating = EXCLUDED.rating,
        current_streak = EXCLUDED.current_streak;
    
    GET DIAGNOSTICS rows_inserted = ROW_COUNT;
    RETURN rows_inserted;
END;
$$ LANGUAGE plpgsql;

-- Function to clean expired cache entries
CREATE OR REPLACE FUNCTION clean_expired_cache()
RETURNS INTEGER AS $$
DECLARE
    rows_deleted INTEGER;
BEGIN
    DELETE FROM leaderboard_cache
    WHERE expires_at < NOW();
    
    GET DIAGNOSTICS rows_deleted = ROW_COUNT;
    RETURN rows_deleted;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGERS FOR AUTOMATIC LEADERBOARD UPDATES
-- ============================================================================

-- Trigger function to invalidate cache when user stats change
CREATE OR REPLACE FUNCTION invalidate_leaderboard_cache()
RETURNS TRIGGER AS $$
BEGIN
    -- Delete all cache entries when user stats change
    DELETE FROM leaderboard_cache;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on user_stats table
DROP TRIGGER IF EXISTS trigger_invalidate_leaderboard_cache ON user_stats;
CREATE TRIGGER trigger_invalidate_leaderboard_cache
    AFTER INSERT OR UPDATE ON user_stats
    FOR EACH STATEMENT
    EXECUTE FUNCTION invalidate_leaderboard_cache();

-- ============================================================================
-- SCHEDULED JOBS (to be configured in application or cron)
-- ============================================================================

-- These should be scheduled externally:
-- 1. refresh_all_leaderboards() - Every 5 minutes
-- 2. capture_leaderboard_snapshot() - Daily at midnight
-- 3. clean_expired_cache() - Hourly

-- ============================================================================
-- INITIAL DATA AND SETUP
-- ============================================================================

-- Add region column to users table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = 'region'
    ) THEN
        ALTER TABLE users ADD COLUMN region VARCHAR(50) DEFAULT 'UNKNOWN';
        CREATE INDEX idx_users_region ON users(region);
    END IF;
END $$;

-- Initial refresh of materialized views
SELECT refresh_all_leaderboards();

-- Grant permissions (adjust as needed for your application user)
-- GRANT SELECT ON global_leaderboard TO app_user;
-- GRANT SELECT ON regional_leaderboard TO app_user;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON leaderboard_cache TO app_user;
-- GRANT SELECT, INSERT ON leaderboard_history TO app_user;
