-- Leaderboard Service SQL Queries
-- Optimized queries for leaderboard data retrieval and management

-- ============================================================================
-- GLOBAL LEADERBOARD QUERIES
-- ============================================================================

-- Get top N players from global leaderboard
-- Parameters: limit (default 100), offset (default 0)
-- Example: Get top 100 players
SELECT 
    user_id,
    username,
    display_name,
    avatar_url,
    games_played,
    games_won,
    games_lost,
    games_drawn,
    win_percentage,
    rating,
    current_streak,
    best_streak,
    global_rank,
    ROUND((1 - percentile) * 100, 2) as top_percentage,
    last_game_at
FROM global_leaderboard
ORDER BY global_rank
LIMIT 100 OFFSET 0;

-- Get global leaderboard with pagination
-- Parameters: limit, offset
SELECT 
    user_id,
    username,
    display_name,
    avatar_url,
    games_played,
    games_won,
    win_percentage,
    rating,
    current_streak,
    global_rank,
    ROUND((1 - percentile) * 100, 2) as top_percentage
FROM global_leaderboard
ORDER BY global_rank
LIMIT $1 OFFSET $2;

-- Get user's position in global leaderboard
-- Parameters: user_id
SELECT 
    gl.*,
    (SELECT COUNT(*) FROM global_leaderboard) as total_players,
    ROUND((1 - gl.percentile) * 100, 2) as top_percentage
FROM global_leaderboard gl
WHERE user_id = $1;

-- Get players around a specific rank
-- Parameters: rank, range (e.g., rank=50, range=10 returns ranks 40-60)
SELECT 
    user_id,
    username,
    display_name,
    avatar_url,
    games_played,
    games_won,
    win_percentage,
    rating,
    current_streak,
    global_rank
FROM global_leaderboard
WHERE global_rank BETWEEN $1 - $2 AND $1 + $2
ORDER BY global_rank;

-- ============================================================================
-- REGIONAL LEADERBOARD QUERIES
-- ============================================================================

-- Get top N players from specific region
-- Parameters: region, limit, offset
SELECT 
    user_id,
    username,
    display_name,
    avatar_url,
    region,
    games_played,
    games_won,
    games_lost,
    win_percentage,
    rating,
    current_streak,
    best_streak,
    regional_rank,
    ROUND((1 - regional_percentile) * 100, 2) as regional_top_percentage,
    last_game_at
FROM regional_leaderboard
WHERE region = $1
ORDER BY regional_rank
LIMIT $2 OFFSET $3;

-- Get all regions with player counts
SELECT 
    region,
    COUNT(*) as player_count,
    AVG(win_percentage) as avg_win_rate,
    MAX(rating) as top_rating
FROM regional_leaderboard
GROUP BY region
ORDER BY player_count DESC;

-- Get user's regional position
-- Parameters: user_id
SELECT 
    rl.*,
    (SELECT COUNT(*) FROM regional_leaderboard WHERE region = rl.region) as regional_players,
    ROUND((1 - rl.regional_percentile) * 100, 2) as regional_top_percentage
FROM regional_leaderboard rl
WHERE user_id = $1;

-- ============================================================================
-- LEADERBOARD STATISTICS QUERIES
-- ============================================================================

-- Get overall leaderboard statistics
SELECT 
    COUNT(*) as total_players,
    SUM(games_played) as total_games,
    AVG(win_percentage) as avg_win_rate,
    MAX(rating) as highest_rating,
    MIN(rating) as lowest_rating,
    AVG(rating) as avg_rating,
    MAX(current_streak) as longest_current_streak,
    MAX(best_streak) as longest_ever_streak
FROM global_leaderboard;

-- Get top performers by different metrics
-- Top by win rate (minimum 20 games)
SELECT 
    user_id,
    username,
    display_name,
    games_played,
    games_won,
    win_percentage,
    global_rank
FROM global_leaderboard
WHERE games_played >= 20
ORDER BY win_percentage DESC, games_won DESC
LIMIT 10;

-- Top by current streak
SELECT 
    user_id,
    username,
    display_name,
    current_streak,
    games_played,
    win_percentage,
    global_rank
FROM global_leaderboard
WHERE current_streak > 0
ORDER BY current_streak DESC
LIMIT 10;

-- Top by total wins
SELECT 
    user_id,
    username,
    display_name,
    games_won,
    games_played,
    win_percentage,
    global_rank
FROM global_leaderboard
ORDER BY games_won DESC
LIMIT 10;

-- Most active players (by games played)
SELECT 
    user_id,
    username,
    display_name,
    games_played,
    games_won,
    win_percentage,
    global_rank
FROM global_leaderboard
ORDER BY games_played DESC
LIMIT 10;

-- ============================================================================
-- LEADERBOARD HISTORY QUERIES
-- ============================================================================

-- Get user's rank history over time
-- Parameters: user_id, days (default 30)
SELECT 
    snapshot_date,
    global_rank,
    regional_rank,
    games_played,
    games_won,
    win_percentage,
    rating,
    current_streak
FROM leaderboard_history
WHERE user_id = $1
  AND snapshot_date >= CURRENT_DATE - INTERVAL '$2 days'
ORDER BY snapshot_date DESC;

-- Get rank changes for a user
-- Parameters: user_id
WITH ranked_history AS (
    SELECT 
        snapshot_date,
        global_rank,
        LAG(global_rank) OVER (ORDER BY snapshot_date) as prev_rank
    FROM leaderboard_history
    WHERE user_id = $1
    ORDER BY snapshot_date DESC
    LIMIT 30
)
SELECT 
    snapshot_date,
    global_rank,
    prev_rank,
    CASE 
        WHEN prev_rank IS NULL THEN 0
        ELSE prev_rank - global_rank
    END as rank_change
FROM ranked_history
ORDER BY snapshot_date DESC;

-- Get top climbers (biggest rank improvements in last 7 days)
WITH recent_ranks AS (
    SELECT 
        user_id,
        global_rank,
        snapshot_date,
        ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY snapshot_date DESC) as rn
    FROM leaderboard_history
    WHERE snapshot_date >= CURRENT_DATE - INTERVAL '7 days'
)
SELECT 
    u.username,
    u.display_name,
    current.global_rank as current_rank,
    previous.global_rank as previous_rank,
    previous.global_rank - current.global_rank as rank_improvement
FROM recent_ranks current
JOIN recent_ranks previous ON current.user_id = previous.user_id
JOIN users u ON current.user_id = u.user_id
WHERE current.rn = 1 AND previous.rn = (
    SELECT MAX(rn) FROM recent_ranks WHERE user_id = current.user_id
)
AND previous.global_rank - current.global_rank > 0
ORDER BY rank_improvement DESC
LIMIT 10;

-- ============================================================================
-- SEARCH AND FILTER QUERIES
-- ============================================================================

-- Search players by username
-- Parameters: search_term (partial match)
SELECT 
    user_id,
    username,
    display_name,
    avatar_url,
    games_played,
    games_won,
    win_percentage,
    rating,
    global_rank
FROM global_leaderboard
WHERE username ILIKE '%' || $1 || '%'
   OR display_name ILIKE '%' || $1 || '%'
ORDER BY global_rank
LIMIT 50;

-- Get players by rating range
-- Parameters: min_rating, max_rating
SELECT 
    user_id,
    username,
    display_name,
    rating,
    games_played,
    win_percentage,
    global_rank
FROM global_leaderboard
WHERE rating BETWEEN $1 AND $2
ORDER BY rating DESC;

-- Get players by win percentage range
-- Parameters: min_percentage, max_percentage
SELECT 
    user_id,
    username,
    display_name,
    win_percentage,
    games_played,
    rating,
    global_rank
FROM global_leaderboard
WHERE win_percentage BETWEEN $1 AND $2
  AND games_played >= 10
ORDER BY win_percentage DESC, games_played DESC;

-- ============================================================================
-- COMPARISON QUERIES
-- ============================================================================

-- Compare two players
-- Parameters: user_id_1, user_id_2
SELECT 
    user_id,
    username,
    display_name,
    global_rank,
    games_played,
    games_won,
    games_lost,
    games_drawn,
    win_percentage,
    rating,
    current_streak,
    best_streak
FROM global_leaderboard
WHERE user_id IN ($1, $2)
ORDER BY global_rank;

-- Get head-to-head statistics (requires game_sessions table)
-- Parameters: user_id_1, user_id_2
-- Note: This assumes a game_sessions table exists with player information
/*
SELECT 
    COUNT(*) as total_games,
    SUM(CASE WHEN winner_id = $1 THEN 1 ELSE 0 END) as player1_wins,
    SUM(CASE WHEN winner_id = $2 THEN 1 ELSE 0 END) as player2_wins,
    SUM(CASE WHEN winner_id IS NULL THEN 1 ELSE 0 END) as draws
FROM game_sessions
WHERE (player1_id = $1 AND player2_id = $2)
   OR (player1_id = $2 AND player2_id = $1);
*/

-- ============================================================================
-- CACHE MANAGEMENT QUERIES
-- ============================================================================

-- Get cached leaderboard data
-- Parameters: cache_key
SELECT 
    cache_data,
    expires_at,
    updated_at
FROM leaderboard_cache
WHERE cache_key = $1
  AND expires_at > NOW();

-- Set cache data
-- Parameters: cache_key, cache_data (JSONB), ttl_seconds
INSERT INTO leaderboard_cache (cache_key, cache_data, expires_at)
VALUES ($1, $2, NOW() + INTERVAL '$3 seconds')
ON CONFLICT (cache_key) 
DO UPDATE SET
    cache_data = EXCLUDED.cache_data,
    expires_at = EXCLUDED.expires_at,
    updated_at = NOW();

-- Delete specific cache entry
-- Parameters: cache_key
DELETE FROM leaderboard_cache
WHERE cache_key = $1;

-- Delete all cache entries
DELETE FROM leaderboard_cache;

-- ============================================================================
-- MAINTENANCE QUERIES
-- ============================================================================

-- Get materialized view refresh status
SELECT 
    schemaname,
    matviewname,
    matviewowner,
    tablespace,
    hasindexes,
    ispopulated,
    definition
FROM pg_matviews
WHERE matviewname IN ('global_leaderboard', 'regional_leaderboard');

-- Get table sizes
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE tablename IN ('leaderboard_history', 'leaderboard_cache')
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Get index usage statistics
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan as index_scans,
    idx_tup_read as tuples_read,
    idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes
WHERE tablename IN ('global_leaderboard', 'regional_leaderboard', 'leaderboard_history')
ORDER BY idx_scan DESC;

-- Vacuum and analyze leaderboard tables
VACUUM ANALYZE leaderboard_history;
VACUUM ANALYZE leaderboard_cache;

-- ============================================================================
-- PERFORMANCE MONITORING QUERIES
-- ============================================================================

-- Get slow queries related to leaderboard
SELECT 
    query,
    calls,
    total_time,
    mean_time,
    max_time,
    stddev_time
FROM pg_stat_statements
WHERE query LIKE '%leaderboard%'
ORDER BY mean_time DESC
LIMIT 10;

-- Get cache hit ratio
SELECT 
    'cache_hit_ratio' as metric,
    ROUND(
        (SUM(CASE WHEN expires_at > NOW() THEN 1 ELSE 0 END)::DECIMAL / 
         NULLIF(COUNT(*), 0)) * 100, 
        2
    ) as percentage
FROM leaderboard_cache;
