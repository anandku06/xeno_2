import { Router, Request, Response } from 'express';
import { parseSegment, generateMessage } from '../services/aiService';

const router = Router();

// POST /ai/parse-segment — NL query → structured rules
router.post('/parse-segment', async (req: Request, res: Response) => {
  try {
    const { query } = req.body;

    if (!query || typeof query !== 'string') {
      res.status(400).json({ error: 'query string is required' });
      return;
    }

    const rules = await parseSegment(query);
    res.json({ rules, originalQuery: query });
  } catch (err: any) {
    console.error('POST /ai/parse-segment error:', err.message);
    res.status(422).json({ error: err.message });
  }
});

// POST /ai/generate-message — segment description → message variants
router.post('/generate-message', async (req: Request, res: Response) => {
  try {
    const { segmentDescription, channel, brandName } = req.body;

    if (!segmentDescription || !channel) {
      res.status(400).json({ error: 'segmentDescription and channel are required' });
      return;
    }

    const messages = await generateMessage(segmentDescription, channel, brandName);
    res.json({ messages });
  } catch (err: any) {
    console.error('POST /ai/generate-message error:', err.message);
    res.status(422).json({ error: err.message });
  }
});

export default router;
