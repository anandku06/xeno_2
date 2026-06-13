import { Router, Request, Response } from 'express';
import pool from '../db/client';
import { fanOutCampaign } from '../services/campaignSender';

const router = Router();

// GET /campaigns — list all campaigns with summary stats
router.get('/', async (req: Request, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT
        c.*,
        COALESCE(s.matched_count, 0) AS audience_size,
        COALESCE(stats.total, 0)::int AS total_recipients,
        COALESCE(stats.sent, 0)::int AS sent_count,
        COALESCE(stats.delivered, 0)::int AS delivered_count,
        COALESCE(stats.opened, 0)::int AS opened_count,
        COALESCE(stats.clicked, 0)::int AS clicked_count,
        COALESCE(stats.failed, 0)::int AS failed_count
      FROM campaigns c
      LEFT JOIN segments s ON s.campaign_id = c.id
      LEFT JOIN LATERAL (
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE cr.status != 'queued')::int AS sent,
          COUNT(*) FILTER (WHERE cr.status = 'delivered' OR cr.status = 'opened' OR cr.status = 'clicked')::int AS delivered,
          COUNT(*) FILTER (WHERE cr.status = 'opened' OR cr.status = 'clicked')::int AS opened,
          COUNT(*) FILTER (WHERE cr.status = 'clicked')::int AS clicked,
          COUNT(*) FILTER (WHERE cr.status = 'failed')::int AS failed
        FROM campaign_recipients cr
        WHERE cr.campaign_id = c.id
      ) stats ON true
      ORDER BY c.created_at DESC
    `);

    res.json({ data: result.rows });
  } catch (err: any) {
    console.error('GET /campaigns error:', err.message);
    res.status(500).json({ error: 'Failed to fetch campaigns' });
  }
});

// GET /campaigns/:id — single campaign with full stats
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT * FROM campaigns WHERE id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Campaign not found' });
      return;
    }

    res.json(result.rows[0]);
  } catch (err: any) {
    console.error('GET /campaigns/:id error:', err.message);
    res.status(500).json({ error: 'Failed to fetch campaign' });
  }
});

// GET /campaigns/:id/stats — aggregate delivery stats
router.get('/:id/stats', async (req: Request, res: Response) => {
  try {
    const campaignId = req.params.id;

    const result = await pool.query(`
      SELECT
        $1::uuid AS campaign_id,
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status != 'queued')::int AS sent,
        COUNT(*) FILTER (WHERE status IN ('delivered', 'opened', 'clicked'))::int AS delivered,
        COUNT(*) FILTER (WHERE status IN ('opened', 'clicked'))::int AS opened,
        COUNT(*) FILTER (WHERE status = 'clicked')::int AS clicked,
        COUNT(*) FILTER (WHERE status = 'failed')::int AS failed
      FROM campaign_recipients
      WHERE campaign_id = $1
    `, [campaignId]);

    const stats = result.rows[0];
    const total = stats.total || 1;

    res.json({
      ...stats,
      delivered_rate: Math.round((stats.delivered / total) * 100),
      open_rate: Math.round((stats.opened / total) * 100),
      click_rate: Math.round((stats.clicked / total) * 100),
      fail_rate: Math.round((stats.failed / total) * 100),
    });
  } catch (err: any) {
    console.error('GET /campaigns/:id/stats error:', err.message);
    res.status(500).json({ error: 'Failed to fetch campaign stats' });
  }
});

// GET /campaigns/:id/recipients — per-recipient status breakdown
router.get('/:id/recipients', async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const offset = parseInt(req.query.offset as string) || 0;

    const result = await pool.query(`
      SELECT
        cr.*,
        cust.name AS customer_name,
        cust.email AS customer_email,
        cust.city AS customer_city
      FROM campaign_recipients cr
      JOIN customers cust ON cust.id = cr.customer_id
      WHERE cr.campaign_id = $1
      ORDER BY cr.sent_at DESC NULLS LAST
      LIMIT $2 OFFSET $3
    `, [req.params.id, limit, offset]);

    const countResult = await pool.query(
      'SELECT COUNT(*) FROM campaign_recipients WHERE campaign_id = $1',
      [req.params.id]
    );

    res.json({
      data: result.rows,
      pagination: {
        total: parseInt(countResult.rows[0].count),
        limit,
        offset,
      },
    });
  } catch (err: any) {
    console.error('GET /campaigns/:id/recipients error:', err.message);
    res.status(500).json({ error: 'Failed to fetch recipients' });
  }
});

// POST /campaigns — create a new campaign
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, channel, message_body } = req.body;

    if (!name || !channel || !message_body) {
      res.status(400).json({ error: 'name, channel, and message_body are required' });
      return;
    }

    const result = await pool.query(
      `INSERT INTO campaigns (name, channel, message_body, status)
       VALUES ($1, $2, $3, 'draft')
       RETURNING *`,
      [name, channel, message_body]
    );

    res.status(201).json(result.rows[0]);
  } catch (err: any) {
    console.error('POST /campaigns error:', err.message);
    res.status(500).json({ error: 'Failed to create campaign' });
  }
});

// POST /campaigns/:id/send — trigger campaign fan-out
router.post('/:id/send', async (req: Request, res: Response) => {
  try {
    const campaignId = req.params.id as string;

    // Verify campaign exists and is in draft status
    const campaign = await pool.query(
      'SELECT * FROM campaigns WHERE id = $1',
      [campaignId]
    );

    if (campaign.rows.length === 0) {
      res.status(404).json({ error: 'Campaign not found' });
      return;
    }

    if (campaign.rows[0].status !== 'draft') {
      res.status(400).json({ error: 'Campaign has already been sent or is sending' });
      return;
    }

    const recipientCount = await fanOutCampaign(campaignId);

    res.status(202).json({
      message: 'Campaign send initiated',
      recipientCount,
      campaignId,
    });
  } catch (err: any) {
    console.error('POST /campaigns/:id/send error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
