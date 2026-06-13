import { Router, Request, Response } from 'express';
import pool from '../db/client';
import { executeSegmentQuery, countSegmentMatches } from '../services/segmentEngine';

const router = Router();

// POST /segments/preview — dry-run: returns count + sample, no DB writes
router.post('/preview', async (req: Request, res: Response) => {
  try {
    const { rules } = req.body;

    if (!Array.isArray(rules) || rules.length === 0) {
      res.status(400).json({ error: 'rules must be a non-empty array' });
      return;
    }

    const count = await countSegmentMatches(rules);
    const sample = await executeSegmentQuery(rules, { limit: 10 });

    res.json({ count, sample });
  } catch (err: any) {
    console.error('POST /segments/preview error:', err.message);
    res.status(400).json({ error: err.message });
  }
});

// POST /segments — persist segment tied to a campaign
router.post('/', async (req: Request, res: Response) => {
  try {
    const { campaign_id, name, rules } = req.body;

    if (!campaign_id || !rules) {
      res.status(400).json({ error: 'campaign_id and rules are required' });
      return;
    }

    // Verify campaign exists
    const campaignCheck = await pool.query('SELECT id FROM campaigns WHERE id = $1', [campaign_id]);
    if (campaignCheck.rows.length === 0) {
      res.status(404).json({ error: 'Campaign not found' });
      return;
    }

    // Count matched customers
    const matchedCount = await countSegmentMatches(rules);

    const result = await pool.query(
      `INSERT INTO segments (campaign_id, name, rules, matched_count)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [campaign_id, name || 'Untitled Segment', JSON.stringify(rules), matchedCount]
    );

    res.status(201).json(result.rows[0]);
  } catch (err: any) {
    console.error('POST /segments error:', err.message);
    res.status(500).json({ error: 'Failed to create segment' });
  }
});

// GET /segments/:id — get segment by ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const result = await pool.query('SELECT * FROM segments WHERE id = $1', [req.params.id]);

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Segment not found' });
      return;
    }

    res.json(result.rows[0]);
  } catch (err: any) {
    console.error('GET /segments/:id error:', err.message);
    res.status(500).json({ error: 'Failed to fetch segment' });
  }
});

export default router;
