import { Router, Request, Response } from 'express';
import pool from '../db/client';

const router = Router();

// GET /customers — paginated list with search
router.get('/', async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = parseInt(req.query.offset as string) || 0;
    const search = req.query.search as string;

    let whereClause = '';
    const params: any[] = [];

    if (search) {
      whereClause = `WHERE c.name ILIKE $1 OR c.email ILIKE $1 OR c.city ILIKE $1`;
      params.push(`%${search}%`);
    }

    const countQuery = `SELECT COUNT(*) FROM customers c ${whereClause}`;
    const countResult = await pool.query(countQuery, params);
    const total = parseInt(countResult.rows[0].count);

    const dataQuery = `
      SELECT
        c.*,
        COALESCE(COUNT(o.id), 0)::int AS order_count,
        COALESCE(SUM(o.total_amount), 0)::float AS total_spend,
        MAX(o.ordered_at) AS last_order_at
      FROM customers c
      LEFT JOIN orders o ON o.customer_id = c.id
      ${whereClause}
      GROUP BY c.id
      ORDER BY c.created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;
    params.push(limit, offset);

    const result = await pool.query(dataQuery, params);

    res.json({
      data: result.rows,
      pagination: { total, limit, offset, hasMore: offset + limit < total },
    });
  } catch (err: any) {
    console.error('GET /customers error:', err.message);
    res.status(500).json({ error: 'Failed to fetch customers' });
  }
});

// POST /customers — create single customer
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, email, phone, city } = req.body;

    if (!name || !email) {
      res.status(400).json({ error: 'name and email are required' });
      return;
    }

    const result = await pool.query(
      `INSERT INTO customers (name, email, phone, city)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [name, email, phone || null, city || null]
    );

    res.status(201).json(result.rows[0]);
  } catch (err: any) {
    if (err.code === '23505') {
      res.status(409).json({ error: 'Customer with this email already exists' });
      return;
    }
    console.error('POST /customers error:', err.message);
    res.status(500).json({ error: 'Failed to create customer' });
  }
});

// POST /customers/bulk — bulk import (JSON array)
router.post('/bulk', async (req: Request, res: Response) => {
  try {
    const customers = req.body;

    if (!Array.isArray(customers) || customers.length === 0) {
      res.status(400).json({ error: 'Request body must be a non-empty array of customers' });
      return;
    }

    const client = await pool.connect();
    let created = 0;
    let skipped = 0;

    try {
      await client.query('BEGIN');

      for (const c of customers) {
        if (!c.name || !c.email) {
          skipped++;
          continue;
        }
        try {
          await client.query(
            `INSERT INTO customers (name, email, phone, city)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (email) DO NOTHING`,
            [c.name, c.email, c.phone || null, c.city || null]
          );
          created++;
        } catch {
          skipped++;
        }
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    res.status(201).json({ created, skipped, total: customers.length });
  } catch (err: any) {
    console.error('POST /customers/bulk error:', err.message);
    res.status(500).json({ error: 'Failed to bulk import customers' });
  }
});

export default router;
