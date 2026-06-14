import { Worker } from 'bullmq';
import pool from '../db/client';
import dotenv from 'dotenv';

dotenv.config();

/**
 * BullMQ worker that processes send jobs.
 * Concurrency set to 5 — would tune based on DB connection pool size at scale.
 */
export function startSendWorker() {
  const redisUrl = new URL(process.env.REDIS_URL || 'redis://localhost:6379');

  const worker = new Worker(
    'campaign-send',
    async (job) => {
      const { recipientId, message, channel, campaignId } = job.data;

      const channelStubUrl = process.env.CHANNEL_STUB_URL || 'http://localhost:3002';
      const callbackUrl = `${process.env.CRM_API_URL || 'http://localhost:3001'}/receipt`;

      try {
        // Call channel stub
        const response = await fetch(`${channelStubUrl}/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recipientId,
            message,
            channel,
            callbackUrl,
          }),
        });

        if (response.status === 202) {
          // Mark as sent
          await pool.query(
            `UPDATE campaign_recipients SET status = 'sent', sent_at = NOW() WHERE id = $1`,
            [recipientId]
          );

          // Write sent delivery event
          await pool.query(
            `INSERT INTO delivery_events (recipient_id, event_type, occurred_at)
             VALUES ($1, 'sent', NOW())
             ON CONFLICT (recipient_id, event_type) DO NOTHING`,
            [recipientId]
          );
        } else {
          throw new Error(`Channel stub returned ${response.status}`);
        }
      } catch (err: any) {
        console.error(`Send failed for recipient ${recipientId}:`, err.message);

        await pool.query(
          `UPDATE campaign_recipients SET status = 'failed' WHERE id = $1`,
          [recipientId]
        );

        throw err; // Let BullMQ retry
      }
    },
    {
      connection: {
        host: redisUrl.hostname,
        port: Number(redisUrl.port) || 6379,
        password: redisUrl.password || undefined,
        username: redisUrl.username || undefined,
        maxRetriesPerRequest: null,
      },
      concurrency: 5,
    }
  );

  worker.on('completed', (job) => {
    console.log(`  ✅ Send job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    console.error(`  ❌ Send job ${job?.id} failed:`, err.message);
  });

  // Check if all jobs for a campaign are done and update status
  worker.on('completed', async (job) => {
    const { campaignId } = job.data;

    const remaining = await pool.query(
      `SELECT COUNT(*) FROM campaign_recipients WHERE campaign_id = $1 AND status = 'queued'`,
      [campaignId]
    );

    if (parseInt(remaining.rows[0].count) === 0) {
      await pool.query(
        `UPDATE campaigns SET status = 'sent' WHERE id = $1 AND status = 'sending'`,
        [campaignId]
      );
      console.log(`  📬 Campaign ${campaignId} fully sent`);
    }
  });

  console.log('👷 Send worker started (concurrency: 5)');
  return worker;
}
