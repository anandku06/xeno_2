import { Router, Request, Response } from 'express';
import pool from '../db/client';

const router = Router();

// POST /orders — create a new order
router.post('/', async (req: Request, res: Response) => {
  try {
    const { customer_id, total_amount, status } = req.body;

    if (!customer_id || total_amount === undefined) {
      res.status(400).json({ error: 'customer_id and total_amount are required' });
      return;
    }

    // Verify customer exists
    const customerCheck = await pool.query('SELECT id FROM customers WHERE id = $1', [customer_id]);
    if (customerCheck.rows.length === 0) {
      res.status(404).json({ error: 'Customer not found' });
      return;
    }

    const result = await pool.query(
      `INSERT INTO orders (customer_id, total_amount, status)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [customer_id, total_amount, status || 'completed']
    );

    res.status(201).json(result.rows[0]);
  } catch (err: any) {
    console.error('POST /orders error:', err.message);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

// GET /orders — list orders with pagination
router.get('/', async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = parseInt(req.query.offset as string) || 0;
    const customerId = req.query.customer_id as string;

    let whereClause = '';
    const params: any[] = [];

    if (customerId) {
      whereClause = 'WHERE o.customer_id = $1';
      params.push(customerId);
    }

    const result = await pool.query(
      `SELECT o.*, c.name as customer_name, c.email as customer_email
       FROM orders o
       JOIN customers c ON c.id = o.customer_id
       ${whereClause}
       ORDER BY o.ordered_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );

    res.json({ data: result.rows });
  } catch (err: any) {
    console.error('GET /orders error:', err.message);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

export default router;
