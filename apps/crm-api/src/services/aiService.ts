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
 * Falls back to local rule-based regex parsing if Gemini is rate limited or unavailable.
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
    console.warn(`[Gemini API] Failed to parse segment using AI (${err.message}). Falling back to local regex-based parser.`);
    return fallbackParseSegment(nlQuery);
  }
}

/**
 * Generate message copy variants using Gemini.
 * Falls back to template-based message copy if Gemini is rate limited or unavailable.
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
    console.warn(`[Gemini API] Failed to generate messages using AI (${err.message}). Falling back to local template generator.`);
    return fallbackGenerateMessage(segmentDescription, channel, brandName);
  }
}

/**
 * Local regex-based segment parser used as a fallback.
 */
function fallbackParseSegment(nlQuery: string): any[] {
  const query = nlQuery.toLowerCase();
  const rules: any[] = [];

  // Check for city
  const cities = ['mumbai', 'delhi', 'bangalore', 'pune', 'chennai', 'hyderabad', 'kolkata'];
  const foundCities: string[] = [];
  for (const city of cities) {
    if (query.includes(city)) {
      foundCities.push(city.charAt(0).toUpperCase() + city.slice(1));
    }
  }

  if (foundCities.length > 0) {
    if (foundCities.length === 1) {
      rules.push({ field: 'city', operator: 'eq', value: foundCities[0] });
    } else {
      rules.push({ field: 'city', operator: 'in', value: foundCities });
    }
  }

  // Check for spend (e.g. "spent more than 10000", "spending < 2000", "high spenders")
  const spendMatch = query.match(/(?:spent|spend|spending|amount)\s*(?:more than|greater than|above|over|>|>=)\s*(\d+)/i) || 
                     query.match(/(?:spent|spend|spending|amount)\s*(?:less than|below|under|<|<=)\s*(\d+)/i);
  
  if (spendMatch) {
    const value = parseInt(spendMatch[1], 10);
    const isLessThan = query.includes('less') || query.includes('below') || query.includes('under') || query.includes('<');
    rules.push({
      field: 'total_spend',
      operator: isLessThan ? 'lt' : 'gt',
      value
    });
  } else if (query.includes('high spender') || query.includes('high spend')) {
    rules.push({ field: 'total_spend', operator: 'gt', value: 10000 });
  } else if (query.includes('low spender') || query.includes('low spend')) {
    rules.push({ field: 'total_spend', operator: 'lt', value: 2000 });
  }

  // Check for order count (e.g. "ordered more than 3 times", "orders > 5", "frequent buyers")
  const orderMatch = query.match(/(?:ordered|orders|purchases|trips)\s*(?:more than|greater than|above|over|>|>=)\s*(\d+)/i) ||
                     query.match(/(?:ordered|orders|purchases|trips)\s*(?:less than|below|under|<|<=)\s*(\d+)/i);
  
  if (orderMatch) {
    const value = parseInt(orderMatch[1], 10);
    const isLessThan = query.includes('less') || query.includes('below') || query.includes('under') || query.includes('<');
    rules.push({
      field: 'order_count',
      operator: isLessThan ? 'lt' : 'gt',
      value
    });
  } else if (query.includes('frequent') || query.includes('frequent buyer') || query.includes('frequent customer')) {
    rules.push({ field: 'order_count', operator: 'gt', value: 3 });
  }

  // Check for days since last order (e.g. "haven't ordered in 30 days", "inactive for 60 days")
  const daysMatch = query.match(/(?:in|last|past)?\s*(\d+)\s*days/i);
  const isInactive = query.includes('inactive') || query.includes('not ordered') || query.includes("haven't ordered") || query.includes('days since');
  
  if (daysMatch && isInactive) {
    const value = parseInt(daysMatch[1], 10);
    rules.push({
      field: 'days_since_last_order',
      operator: 'gt',
      value
    });
  } else if (query.includes('inactive') || query.includes('dormant')) {
    rules.push({ field: 'days_since_last_order', operator: 'gt', value: 30 });
  }

  // Fallback default rule if nothing matches to prevent empty rules
  if (rules.length === 0) {
    rules.push({ field: 'order_count', operator: 'gte', value: 0 });
  }

  return rules;
}

/**
 * Local template-based message copy generator used as a fallback.
 */
function fallbackGenerateMessage(
  segmentDescription: string,
  channel: string,
  brandName?: string
): string[] {
  const brand = brandName || 'Our Store';
  const c = channel.toLowerCase();

  if (c.includes('sms')) {
    return [
      `Hey {name}! 🎉 Special offer for you at ${brand}. Get 15% off your next order with code OFF15. Shop now!`,
      `Hi {name}! As one of our top customers, here is an exclusive deal. Enjoy 20% off at ${brand}: store.link`,
      `Hey {name}, we haven't seen you in a while! Use code WE_MISS_YOU for free shipping on your next order at ${brand}.`
    ];
  } else if (c.includes('whatsapp') || c.includes('rcs')) {
    return [
      `Hey {name}! 👋 We've got something special for you. As a valued customer, here is a 15% discount code for ${brand}: *VALUED15*. Enjoy! 🛍️`,
      `Hi {name}! 🎉 Don't miss our latest collection curated just for you at ${brand}. Click here to explore! 🌟`,
      `Hello {name}! 🌟 We miss you at ${brand}! Come back today and get free shipping on your next order with code *BACKFORFREE*.`
    ];
  } else {
    // Email
    return [
      `Subject: Exclusive offer for {name}! 🎁\n\nHi {name},\n\nWe appreciate your support at ${brand}. As a special thank you, here is 15% off your next purchase.\n\nUse code: THANKYOU15\n\nBest,\n${brand} Team`,
      `Subject: We miss you, {name}! ❤️\n\nHi {name},\n\nIt's been a while since you visited ${brand}. We've added some exciting new items we think you'll love.\n\nCome back and take 20% off with code: MISSYOU20\n\nBest,\n${brand} Team`,
      `Subject: Just for you, {name} ✨\n\nHi {name},\n\nCheck out these personalized recommendations and special deals just for you at ${brand}.\n\nShop today and get free shipping!\n\nBest,\n${brand} Team`
    ];
  }
}
