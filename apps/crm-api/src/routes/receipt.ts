import { Router, Request, Response } from 'express';
import pool from '../db/client';

const router = Router();

// POST /receipt — callback endpoint for delivery events from channel stub
router.post('/', async (req: Request, res: Response) => {
  try {
    const { recipientId, eventType, occurredAt } = req.body;

    if (!recipientId || !eventType) {
      res.status(400).json({ error: 'recipientId and eventType are required' });
      return;
    }

    const validEvents = ['sent', 'delivered', 'opened', 'clicked', 'failed'];
    if (!validEvents.includes(eventType)) {
      res.status(400).json({ error: `Invalid eventType. Must be one of: ${validEvents.join(', ')}` });
      return;
    }

    // Verify recipient exists
    const recipientCheck = await pool.query(
      'SELECT id FROM campaign_recipients WHERE id = $1',
      [recipientId]
    );

    if (recipientCheck.rows.length === 0) {
      res.status(404).json({ error: 'Recipient not found' });
      return;
    }

    // Idempotency: INSERT ... ON CONFLICT DO NOTHING
    // The UNIQUE(recipient_id, event_type) constraint prevents duplicates
    const insertResult = await pool.query(
      `INSERT INTO delivery_events (recipient_id, event_type, occurred_at)
       VALUES ($1, $2, $3)
       ON CONFLICT (recipient_id, event_type) DO NOTHING
       RETURNING id`,
      [recipientId, eventType, occurredAt || new Date().toISOString()]
    );

    if (insertResult.rows.length === 0) {
      // Duplicate event — idempotency check caught it
      res.status(200).json({ message: 'Duplicate event, skipped' });
      return;
    }

    // Update campaign_recipients.status to latest event type
    // Use an event priority to avoid downgrading status
    const EVENT_PRIORITY: Record<string, number> = {
      queued: 0,
      sent: 1,
      delivered: 2,
      opened: 3,
      clicked: 4,
      failed: 1, // failed is same priority as sent
    };

    const currentRecipient = await pool.query(
      'SELECT status FROM campaign_recipients WHERE id = $1',
      [recipientId]
    );

    const currentStatus = currentRecipient.rows[0]?.status || 'queued';
    const currentPriority = EVENT_PRIORITY[currentStatus] || 0;
    const newPriority = EVENT_PRIORITY[eventType] || 0;

    if (newPriority >= currentPriority) {
      await pool.query(
        'UPDATE campaign_recipients SET status = $1 WHERE id = $2',
        [eventType, recipientId]
      );
    }

    res.status(200).json({ message: 'Event recorded', eventId: insertResult.rows[0].id });
  } catch (err: any) {
    console.error('POST /receipt error:', err.message);
    res.status(500).json({ error: 'Failed to process receipt' });
  }
});

export default router;
