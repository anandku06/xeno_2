import pool from './client';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';

dotenv.config();

// Simple deterministic pseudo-random for seeding
function createRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const random = createRandom(42);

const firstNames = [
  'Aarav', 'Vivaan', 'Aditya', 'Vihaan', 'Arjun', 'Sai', 'Reyansh', 'Ayaan',
  'Krishna', 'Ishaan', 'Ananya', 'Diya', 'Saanvi', 'Aanya', 'Aadhya', 'Isha',
  'Priya', 'Neha', 'Riya', 'Kavya', 'Rohan', 'Rahul', 'Amit', 'Vikram',
  'Suresh', 'Pooja', 'Meera', 'Nisha', 'Deepa', 'Lakshmi', 'Rajesh', 'Sanjay',
  'Kiran', 'Arun', 'Manoj', 'Sneha', 'Tanvi', 'Shruti', 'Gauri', 'Pallavi'
];

const lastNames = [
  'Sharma', 'Patel', 'Singh', 'Kumar', 'Verma', 'Gupta', 'Joshi', 'Reddy',
  'Nair', 'Iyer', 'Mehta', 'Shah', 'Chopra', 'Malhotra', 'Kapoor', 'Bhat',
  'Rao', 'Das', 'Pillai', 'Menon', 'Chauhan', 'Pandey', 'Mishra', 'Saxena',
  'Tiwari', 'Desai', 'Kulkarni', 'Hegde', 'Banerjee', 'Mukherjee'
];

const cities = [
  'Mumbai', 'Mumbai', 'Mumbai', // weighted more
  'Delhi', 'Delhi',
  'Bangalore', 'Bangalore', 'Bangalore',
  'Chennai', 'Hyderabad', 'Hyderabad',
  'Pune', 'Pune',
  'Kolkata', 'Jaipur', 'Ahmedabad',
  'Lucknow', 'Chandigarh', 'Kochi', 'Indore'
];

const domains = ['gmail.com', 'outlook.com', 'yahoo.com', 'hotmail.com', 'proton.me'];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(random() * arr.length)];
}

function generatePhone(): string {
  let phone = '+91 ';
  const starts = ['6', '7', '8', '9'];
  phone += pick(starts);
  for (let i = 0; i < 9; i++) {
    phone += Math.floor(random() * 10).toString();
  }
  return phone;
}

async function seed() {
  console.log('🌱 Seeding database...');

  // Clear existing data
  await pool.query('DELETE FROM delivery_events');
  await pool.query('DELETE FROM campaign_recipients');
  await pool.query('DELETE FROM segments');
  await pool.query('DELETE FROM campaigns');
  await pool.query('DELETE FROM orders');
  await pool.query('DELETE FROM customers');

  console.log('  🗑️  Cleared existing data');

  // Generate 200 customers
  const customerIds: string[] = [];
  const usedEmails = new Set<string>();

  for (let i = 0; i < 200; i++) {
    const firstName = pick(firstNames);
    const lastName = pick(lastNames);
    const name = `${firstName} ${lastName}`;
    const domain = pick(domains);

    // Ensure unique email
    let email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${Math.floor(random() * 999)}@${domain}`;
    while (usedEmails.has(email)) {
      email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${Math.floor(random() * 9999)}@${domain}`;
    }
    usedEmails.add(email);

    const phone = generatePhone();
    const city = pick(cities);
    const id = uuidv4();
    customerIds.push(id);

    // Spread created_at over last 365 days
    const daysAgo = Math.floor(random() * 365);
    const createdAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);

    await pool.query(
      `INSERT INTO customers (id, name, email, phone, city, created_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [id, name, email, phone, city, createdAt]
    );
  }

  console.log(`  👥 Created 200 customers`);

  // Generate 500-800 orders spread across customers
  const totalOrders = 500 + Math.floor(random() * 300);
  let orderCount = 0;

  for (let i = 0; i < totalOrders; i++) {
    const customerId = pick(customerIds);

    // Varied order amounts: most between 200-5000, some high-value up to 25000
    let amount: number;
    const r = random();
    if (r < 0.6) {
      amount = 200 + random() * 3000; // Normal orders
    } else if (r < 0.9) {
      amount = 3000 + random() * 8000; // Medium-high
    } else {
      amount = 8000 + random() * 17000; // High-value
    }
    amount = Math.round(amount * 100) / 100;

    // Orders spread over last 180 days, some older
    const daysAgo = Math.floor(random() * 180);
    const orderedAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);

    const statuses = ['completed', 'completed', 'completed', 'completed', 'processing', 'shipped', 'cancelled'];
    const status = pick(statuses);

    await pool.query(
      `INSERT INTO orders (customer_id, total_amount, ordered_at, status)
       VALUES ($1, $2, $3, $4)`,
      [customerId, amount, orderedAt, status]
    );
    orderCount++;
  }

  console.log(`  🛒 Created ${orderCount} orders`);
  console.log('✅ Seeding complete!');

  // Quick stats
  const stats = await pool.query(`
    SELECT
      (SELECT COUNT(*) FROM customers) as customer_count,
      (SELECT COUNT(*) FROM orders) as order_count,
      (SELECT ROUND(AVG(total_amount)::numeric, 2) FROM orders) as avg_order,
      (SELECT COUNT(DISTINCT city) FROM customers) as city_count
  `);

  console.log('\n📊 Seed Summary:');
  console.log(`   Customers: ${stats.rows[0].customer_count}`);
  console.log(`   Orders: ${stats.rows[0].order_count}`);
  console.log(`   Avg Order: ₹${stats.rows[0].avg_order}`);
  console.log(`   Cities: ${stats.rows[0].city_count}`);

  await pool.end();
}

seed().catch((err) => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
