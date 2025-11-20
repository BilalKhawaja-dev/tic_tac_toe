// Run this script from within a leaderboard service container to apply the full schema

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Read config from environment variables (same as the service)
const config = {
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'gamedb',
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
};

console.log('Database config:', {
  host: config.host,
  port: config.port,
  database: config.database,
  user: config.user,
  hasPassword: !!config.password
});

async function applySchema() {
  const pool = new Pool(config);
  
  try {
    // Read the schema file
    const schemaPath = path.join(__dirname, '../src/leaderboard-service/sql/schema.sql');
    console.log('Reading schema from:', schemaPath);
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    console.log('Applying schema...');
    await pool.query(schema);
    
    console.log('Schema applied successfully!');
    
    // Test the function
    console.log('Testing refresh_all_leaderboards function...');
    await pool.query('SELECT refresh_all_leaderboards()');
    console.log('Function works!');
    
  } catch (error) {
    console.error('Error applying schema:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

applySchema()
  .then(() => {
    console.log('All done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed:', error);
    process.exit(1);
  });
