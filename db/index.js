const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function initDB() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS pole_readings (
        id          SERIAL PRIMARY KEY,
        node_id     VARCHAR(50) NOT NULL,
        tilt_angle  NUMERIC(6,2) NOT NULL,
        alert       BOOLEAN DEFAULT FALSE,
        alert_level VARCHAR(20) DEFAULT 'normal',
        created_at  TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS alerts (
        id          SERIAL PRIMARY KEY,
        node_id     VARCHAR(50) NOT NULL,
        tilt_angle  NUMERIC(6,2) NOT NULL,
        alert_level VARCHAR(20) NOT NULL,
        message     TEXT,
        resolved    BOOLEAN DEFAULT FALSE,
        created_at  TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_readings_node ON pole_readings(node_id);
      CREATE INDEX IF NOT EXISTS idx_readings_time ON pole_readings(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_alerts_node   ON alerts(node_id);
    `);

    console.log('✅ Database tables ready');
  } finally {
    client.release();
  }
}

module.exports = { pool, initDB };