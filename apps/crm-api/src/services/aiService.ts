import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

const SEGMENT_SYSTEM_PROMPT = `You are a CRM segment parser. Given a natural language description of a customer segment, you must return ONLY a valid JSON array of rules.

Each rule must have exactly these fields:
- "field": one of "total_spend", "order_count", "days_since_last_order", "city"
- "operator": one of "gt", "lt", "eq", "gte", "lte", "neq", "in"
- "value": a number for numeric fields, or a string (or array of strings) for city

Examples:
- "high spenders" → [{"field": "total_spend", "operator": "gt", "value": 10000}]
- "customers in Mumbai who ordered more than 3 times" → [{"field": "city", "operator": "eq", "value": "Mumbai"}, {"field": "order_count", "operator": "gt", "value": 3}]
- "inactive customers who haven't ordered in 30 days" → [{"field": "days_since_last_order", "operator": "gt", "value": 30}]
- "low spenders in Delhi or Bangalore" → [{"field": "total_spend", "operator": "lt", "value": 2000}, {"field": "city", "operator": "in", "value": ["Delhi", "Bangalore"]}]

IMPORTANT:
- Return ONLY the JSON array, no explanation, no markdown, no code blocks.
- Use reasonable threshold values based on the description.
- "high spenders" typically means total_spend > 10000
- "inactive" or "haven't ordered recently" means days_since_last_order > 30
- "frequent buyers" means order_count >= 3
- Always pick the most appropriate operator for the intent.`;

const MESSAGE_SYSTEM_PROMPT = `You are a marketing copywriter for a CRM platform. Generate engaging marketing messages for campaigns.

Given a segment description, channel type, and optional brand name, generate 3 message variants.

Rules:
- Keep messages concise and engaging
- For SMS: max 160 characters
- For WhatsApp: can be longer, use emojis tastefully
- For Email: include a subject line (format as "Subject: ...\n\n...")
- For RCS: similar to WhatsApp, rich and engaging
- Include a clear call-to-action
- Personalize with {name} placeholder
- Return ONLY a valid JSON array of 3 strings, no markdown, no code blocks.

Example output:
["Hey {name}! 🎉 We miss you! Come back and enjoy 20% off your next order. Shop now!", "Hi {name}, it's been a while! Here's an exclusive deal just for you — 20% OFF storewide. Don't miss out! 🛍️", "{name}, we noticed you haven't shopped recently. Here's 20% off to welcome you back! Use code COMEBACK20 💫"]`;

/**
 * Parse a natural language query into structured segment rules using Gemini.
 */
export async function parseSegment(nlQuery: string): Promise<any[]> {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const result = await model.generateContent([
      { text: SEGMENT_SYSTEM_PROMPT },
      { text: `Parse this into segment rules: "${nlQuery}"` },
    ]);

    const responseText = result.response.text().trim();

    // Try to extract JSON from the response
    let jsonStr = responseText;

    // Remove markdown code blocks if present
    const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }

    // Remove any leading/trailing non-JSON characters
    const arrayMatch = jsonStr.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      jsonStr = arrayMatch[0];
    }

    const rules = JSON.parse(jsonStr);

    if (!Array.isArray(rules)) {
      throw new Error('AI response is not an array');
    }

    // Validate each rule
    const validFields = ['total_spend', 'order_count', 'days_since_last_order', 'city'];
    const validOperators = ['gt', 'lt', 'eq', 'gte', 'lte', 'neq', 'in'];

    for (const rule of rules) {
      if (!validFields.includes(rule.field)) {
        throw new Error(`Invalid field in AI response: ${rule.field}`);
      }
      if (!validOperators.includes(rule.operator)) {
        throw new Error(`Invalid operator in AI response: ${rule.operator}`);
      }
      if (rule.value === undefined || rule.value === null) {
        throw new Error('Rule value cannot be null');
      }
    }

    return rules;
  } catch (err: any) {
    console.error('AI parseSegment error:', err.message);
    throw new Error(`Failed to parse segment: ${err.message}`);
  }
}

/**
 * Generate message copy variants using Gemini.
 */
export async function generateMessage(
  segmentDescription: string,
  channel: string,
  brandName?: string
): Promise<string[]> {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const prompt = `Generate 3 marketing message variants for:
- Segment: ${segmentDescription}
- Channel: ${channel}
- Brand: ${brandName || 'Our Store'}

Return ONLY a JSON array of 3 message strings.`;

    const result = await model.generateContent([
      { text: MESSAGE_SYSTEM_PROMPT },
      { text: prompt },
    ]);

    const responseText = result.response.text().trim();

    let jsonStr = responseText;
    const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }

    const arrayMatch = jsonStr.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      jsonStr = arrayMatch[0];
    }

    const messages = JSON.parse(jsonStr);

    if (!Array.isArray(messages) || messages.length === 0) {
      throw new Error('AI response is not a valid array of messages');
    }

    return messages.slice(0, 3);
  } catch (err: any) {
    console.error('AI generateMessage error:', err.message);
    throw new Error(`Failed to generate messages: ${err.message}`);
  }
}
