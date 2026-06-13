import { Router, Request, Response } from 'express';
import { simulateOutcome } from '../simulator';
import { dispatchCallback } from '../callbackDispatcher';

const router = Router();

/**
 * POST /send — accepts a message send request, returns 202 Accepted immediately.
 * Then simulates delivery outcome async via setTimeout.
 */
router.post('/', (req: Request, res: Response) => {
  const { recipientId, message, channel, callbackUrl } = req.body;

  if (!recipientId || !message || !callbackUrl) {
    res.status(400).json({ error: 'recipientId, message, and callbackUrl are required' });
    return;
  }

  console.log(`📤 Received send request: ${recipientId} via ${channel || 'unknown'}`);

  // Return 202 immediately — async processing
  res.status(202).json({
    status: 'accepted',
    recipientId,
    message: 'Message queued for delivery simulation',
  });

  // Simulate delivery outcome asynchronously
  const { events } = simulateOutcome();

  for (const event of events) {
    setTimeout(async () => {
      await dispatchCallback(callbackUrl, {
        recipientId,
        eventType: event.eventType,
        occurredAt: new Date().toISOString(),
      });
    }, event.delay);
  }
});

export default router;
