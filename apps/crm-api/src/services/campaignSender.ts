import { Queue } from 'bullmq';
import pool from '../db/client';
import { executeSegmentQuery } from './segmentEngine';
import dotenv from 'dotenv';

dotenv.config();

const redisUrl = new URL(process.env.REDIS_URL || 'redis://localhost:6379');

const sendQueue = new Queue('campaign-send', {
  connection: {
    host: redisUrl.hostname,
    port: Number(redisUrl.port) || 6379,
    password: redisUrl.password || undefined,
    username: redisUrl.username || undefined,
    maxRetriesPerRequest: null,
  },
});

/**
 * Fan-out campaign to all matched recipients via BullMQ.
 * Creates campaign_recipients rows and enqueues one job per recipient.
 */
export async function fanOutCampaign(campaignId: string): Promise<number> {
  // Get campaign
  const campaignResult = await pool.query(
    'SELECT * FROM campaigns WHERE id = $1',
    [campaignId]
  );

  if (campaignResult.rows.length === 0) {
    throw new Error('Campaign not found');
  }

  const campaign = campaignResult.rows[0];

  // Get segment rules
  const segmentResult = await pool.query(
    'SELECT * FROM segments WHERE campaign_id = $1',
    [campaignId]
  );

  if (segmentResult.rows.length === 0) {
    throw new Error('No segment found for this campaign');
  }

  const segment = segmentResult.rows[0];
  const rules = segment.rules;

  // Execute segment query to get matched customers
  const customers = await executeSegmentQuery(rules);

  if (customers.length === 0) {
    throw new Error('No customers matched the segment rules');
  }

  // Update campaign status to 'sending'
  await pool.query(
    `UPDATE campaigns SET status = 'sending', sent_at = NOW() WHERE id = $1`,
    [campaignId]
  );

  // Create campaign_recipients and enqueue send jobs
  const jobs = [];

  for (const customer of customers) {
    // Personalize message body
    const personalizedMessage = campaign.message_body.replace(
      /\{name\}/gi,
      customer.name
    );

    // Insert recipient row
    const recipientResult = await pool.query(
      `INSERT INTO campaign_recipients (campaign_id, customer_id, status, message_body)
       VALUES ($1, $2, 'queued', $3)
       RETURNING id`,
      [campaignId, customer.id, personalizedMessage]
    );

    const recipientId = recipientResult.rows[0].id;

    // Enqueue BullMQ job
    jobs.push({
      name: 'send-message',
      data: {
        recipientId,
        customerId: customer.id,
        customerEmail: customer.email,
        message: personalizedMessage,
        channel: campaign.channel,
        campaignId,
      },
    });
  }

  // Bulk add jobs to queue
  await sendQueue.addBulk(jobs);

  // Update segment matched count
  await pool.query(
    'UPDATE segments SET matched_count = $1 WHERE id = $2',
    [customers.length, segment.id]
  );

  return customers.length;
}
