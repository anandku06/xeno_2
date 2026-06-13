import pool from './client';
import dotenv from 'dotenv';

dotenv.config();

const migrations = [
  // 1. Enable uuid extension
  `CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`,

  // 2. Customers table
  `CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(50),
    city VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  );`,

  // 3. Orders table
  `CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    total_amount DECIMAL(12,2) NOT NULL,
    ordered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status VARCHAR(50) DEFAULT 'completed'
  );`,

  // 4. Campaigns table
  `CREATE TABLE IF NOT EXISTS campaigns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    channel VARCHAR(50) NOT NULL DEFAULT 'email',
    status VARCHAR(50) NOT NULL DEFAULT 'draft',
    message_body TEXT,
    scheduled_at TIMESTAMP WITH TIME ZONE,
    sent_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  );`,

  // 5. Segments table
  `CREATE TABLE IF NOT EXISTS segments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
    name VARCHAR(255),
    rules JSONB NOT NULL DEFAULT '[]',
    matched_count INTEGER DEFAULT 0
  );`,

  // 6. Campaign recipients table
  `CREATE TABLE IF NOT EXISTS campaign_recipients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL DEFAULT 'queued',
    message_body TEXT,
    sent_at TIMESTAMP WITH TIME ZONE
  );`,

  // 7. Delivery events table
  `CREATE TABLE IF NOT EXISTS delivery_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    recipient_id UUID NOT NULL REFERENCES campaign_recipients(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL,
    metadata JSONB DEFAULT '{}',
    occurred_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(recipient_id, event_type)
  );`,

  // 8. Indexes for performance
  `CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);`,
  `CREATE INDEX IF NOT EXISTS idx_orders_ordered_at ON orders(ordered_at);`,
  `CREATE INDEX IF NOT EXISTS idx_campaign_recipients_campaign ON campaign_recipients(campaign_id);`,
  `CREATE INDEX IF NOT EXISTS idx_campaign_recipients_customer ON campaign_recipients(customer_id);`,
  `CREATE INDEX IF NOT EXISTS idx_delivery_events_recipient ON delivery_events(recipient_id);`,
  `CREATE INDEX IF NOT EXISTS idx_segments_campaign ON segments(campaign_id);`,
];

async function migrate() {
  console.log('🔄 Running migrations...');

  for (let i = 0; i < migrations.length; i++) {
    try {
      await pool.query(migrations[i]);
      console.log(`  ✅ Migration ${i + 1}/${migrations.length} applied`);
    } catch (err: any) {
      console.error(`  ❌ Migration ${i + 1} failed:`, err.message);
      throw err;
    }
  }

  console.log('✅ All migrations applied successfully');
  await pool.end();
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
