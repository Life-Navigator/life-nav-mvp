/**
 * Database configuration for PostgreSQL
 * Sets up connection pooling for improved performance
 */
import { Pool } from 'pg';

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/lifenavigator?schema=public';

// Create a connection pool for PostgreSQL
const connectionPool = new Pool({
  connectionString: DATABASE_URL,
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // How long a client is allowed to remain idle before being closed
  connectionTimeoutMillis: 10000, // How long to wait for a connection to become available
});

// Event handlers for connection management
connectionPool.on('connect', client => {
  console.log('New client connected to PostgreSQL');
});

connectionPool.on('error', (err, client) => {
  console.error('Unexpected error on idle PostgreSQL client', err);
});

export { connectionPool };