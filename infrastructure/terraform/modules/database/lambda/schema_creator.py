import json
import boto3
import psycopg2
import os
import logging

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

def handler(event, context):
    """
    Lambda function to create database schema for the gaming platform
    """
    logger.info(f"Received event: {json.dumps(event)}")
    
    try:
        # Get database connection details from Secrets Manager
        secrets_client = boto3.client('secretsmanager')
        secret_response = secrets_client.get_secret_value(SecretId=os.environ['SECRET_ARN'])
        secret_data = json.loads(secret_response['SecretString'])
        
        # Database connection parameters
        db_params = {
            'host': os.environ['DB_HOST'],
            'database': os.environ['DB_NAME'],
            'user': secret_data['username'],
            'password': secret_data['password'],
            'port': secret_data.get('port', 5432)
        }
        
        logger.info(f"Connecting to database at {db_params['host']}")
        
        # Connect to database
        conn = psycopg2.connect(**db_params)
        conn.autocommit = True
        cursor = conn.cursor()
        
        # Create schema
        create_schema(cursor)
        
        # Close connection
        cursor.close()
        conn.close()
        
        logger.info("Schema creation completed successfully")
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'message': 'Schema created successfully',
                'database': os.environ['DB_NAME']
            })
        }
        
    except Exception as e:
        logger.error(f"Error creating schema: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps({
                'error': str(e),
                'message': 'Failed to create schema'
            })
        }

def create_schema(cursor):
    """
    Create database schema for the gaming platform
    """
    
    # Enable UUID extension
    cursor.execute("CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";")
    logger.info("Enabled uuid-ossp extension")
    
    # Create users table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            username VARCHAR(50) UNIQUE NOT NULL,
            email VARCHAR(255) UNIQUE NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            display_name VARCHAR(100),
            avatar_url VARCHAR(500),
            is_active BOOLEAN DEFAULT true,
            is_verified BOOLEAN DEFAULT false,
            oauth_provider VARCHAR(50),
            oauth_id VARCHAR(255),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            last_login_at TIMESTAMP WITH TIME ZONE,
            
            CONSTRAINT users_oauth_unique UNIQUE (oauth_provider, oauth_id)
        );
    """)
    logger.info("Created users table")
    
    # Create user_stats table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS user_stats (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            games_played INTEGER DEFAULT 0,
            games_won INTEGER DEFAULT 0,
            games_lost INTEGER DEFAULT 0,
            games_drawn INTEGER DEFAULT 0,
            total_score INTEGER DEFAULT 0,
            win_streak INTEGER DEFAULT 0,
            best_win_streak INTEGER DEFAULT 0,
            average_game_duration INTERVAL,
            total_play_time INTERVAL DEFAULT '0 seconds',
            rank_points INTEGER DEFAULT 1000,
            rank_tier VARCHAR(20) DEFAULT 'Bronze',
            achievements JSONB DEFAULT '[]',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            
            UNIQUE(user_id)
        );
    """)
    logger.info("Created user_stats table")
    
    # Create support_tickets table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS support_tickets (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            user_id UUID REFERENCES users(id) ON DELETE SET NULL,
            subject VARCHAR(255) NOT NULL,
            description TEXT NOT NULL,
            status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
            priority VARCHAR(10) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
            category VARCHAR(50) DEFAULT 'general',
            assigned_to VARCHAR(100),
            resolution TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            resolved_at TIMESTAMP WITH TIME ZONE
        );
    """)
    logger.info("Created support_tickets table")
    
    # Create game_sessions table (for tracking active games)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS game_sessions (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            game_id VARCHAR(50) UNIQUE NOT NULL,
            player1_id UUID NOT NULL REFERENCES users(id),
            player2_id UUID REFERENCES users(id),
            status VARCHAR(20) DEFAULT 'waiting' CHECK (status IN ('waiting', 'active', 'completed', 'abandoned')),
            winner_id UUID REFERENCES users(id),
            game_data JSONB,
            started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            completed_at TIMESTAMP WITH TIME ZONE,
            last_move_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
    """)
    logger.info("Created game_sessions table")
    
    # Create indexes for performance
    indexes = [
        "CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);",
        "CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);",
        "CREATE INDEX IF NOT EXISTS idx_users_oauth ON users(oauth_provider, oauth_id);",
        "CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active);",
        "CREATE INDEX IF NOT EXISTS idx_user_stats_user_id ON user_stats(user_id);",
        "CREATE INDEX IF NOT EXISTS idx_user_stats_rank_points ON user_stats(rank_points DESC);",
        "CREATE INDEX IF NOT EXISTS idx_support_tickets_user_id ON support_tickets(user_id);",
        "CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status);",
        "CREATE INDEX IF NOT EXISTS idx_support_tickets_created_at ON support_tickets(created_at DESC);",
        "CREATE INDEX IF NOT EXISTS idx_game_sessions_game_id ON game_sessions(game_id);",
        "CREATE INDEX IF NOT EXISTS idx_game_sessions_player1 ON game_sessions(player1_id);",
        "CREATE INDEX IF NOT EXISTS idx_game_sessions_player2 ON game_sessions(player2_id);",
        "CREATE INDEX IF NOT EXISTS idx_game_sessions_status ON game_sessions(status);",
        "CREATE INDEX IF NOT EXISTS idx_game_sessions_started_at ON game_sessions(started_at DESC);"
    ]
    
    for index_sql in indexes:
        cursor.execute(index_sql)
    
    logger.info("Created database indexes")
    
    # Create triggers for updated_at timestamps
    trigger_functions = [
        """
        CREATE OR REPLACE FUNCTION update_updated_at_column()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = CURRENT_TIMESTAMP;
            RETURN NEW;
        END;
        $$ language 'plpgsql';
        """,
        
        "DROP TRIGGER IF EXISTS update_users_updated_at ON users;",
        """
        CREATE TRIGGER update_users_updated_at 
        BEFORE UPDATE ON users 
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
        """,
        
        "DROP TRIGGER IF EXISTS update_user_stats_updated_at ON user_stats;",
        """
        CREATE TRIGGER update_user_stats_updated_at 
        BEFORE UPDATE ON user_stats 
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
        """,
        
        "DROP TRIGGER IF EXISTS update_support_tickets_updated_at ON support_tickets;",
        """
        CREATE TRIGGER update_support_tickets_updated_at 
        BEFORE UPDATE ON support_tickets 
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
        """
    ]
    
    for trigger_sql in trigger_functions:
        cursor.execute(trigger_sql)
    
    logger.info("Created database triggers")
    
    # Insert sample data for testing (only in non-production environments)
    if os.environ.get('ENVIRONMENT', 'development') != 'production':
        insert_sample_data(cursor)
    
    logger.info("Database schema creation completed")

def insert_sample_data(cursor):
    """
    Insert sample data for testing purposes
    """
    
    # Insert sample users
    cursor.execute("""
        INSERT INTO users (username, email, password_hash, display_name, is_verified)
        VALUES 
            ('testuser1', 'test1@example.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/VjPyV8Eim', 'Test User 1', true),
            ('testuser2', 'test2@example.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/VjPyV8Eim', 'Test User 2', true)
        ON CONFLICT (username) DO NOTHING;
    """)
    
    # Insert sample user stats
    cursor.execute("""
        INSERT INTO user_stats (user_id, games_played, games_won, games_lost, total_score, rank_points)
        SELECT u.id, 10, 6, 3, 600, 1200
        FROM users u 
        WHERE u.username = 'testuser1'
        ON CONFLICT (user_id) DO NOTHING;
    """)
    
    cursor.execute("""
        INSERT INTO user_stats (user_id, games_played, games_won, games_lost, total_score, rank_points)
        SELECT u.id, 8, 3, 4, 300, 950
        FROM users u 
        WHERE u.username = 'testuser2'
        ON CONFLICT (user_id) DO NOTHING;
    """)
    
    logger.info("Inserted sample data")