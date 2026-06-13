// ── Customer ──────────────────────────────────────────────
export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  city: string;
  created_at: Date;
}

export interface CreateCustomerInput {
  name: string;
  email: string;
  phone?: string;
  city?: string;
}

// ── Order ─────────────────────────────────────────────────
export interface Order {
  id: string;
  customer_id: string;
  total_amount: number;
  ordered_at: Date;
  status: string;
}

export interface CreateOrderInput {
  customer_id: string;
  total_amount: number;
  status?: string;
}

// ── Campaign ──────────────────────────────────────────────
export type CampaignChannel = 'whatsapp' | 'sms' | 'email' | 'rcs';
export type CampaignStatus = 'draft' | 'sending' | 'sent';

export interface Campaign {
  id: string;
  name: string;
  channel: CampaignChannel;
  status: CampaignStatus;
  message_body: string;
  scheduled_at?: Date;
  sent_at?: Date;
  created_at: Date;
}

export interface CreateCampaignInput {
  name: string;
  channel: CampaignChannel;
  message_body: string;
  segment_id?: string;
}

// ── Segment ───────────────────────────────────────────────
export type RuleOperator = 'gt' | 'lt' | 'eq' | 'gte' | 'lte' | 'neq' | 'in';
export type RuleField = 'total_spend' | 'order_count' | 'days_since_last_order' | 'city';

export interface SegmentRule {
  field: RuleField;
  operator: RuleOperator;
  value: string | number;
}

export interface Segment {
  id: string;
  campaign_id: string;
  name: string;
  rules: SegmentRule[];
  matched_count: number;
}

// ── Campaign Recipient ────────────────────────────────────
export type RecipientStatus = 'queued' | 'sent' | 'delivered' | 'opened' | 'clicked' | 'failed';

export interface CampaignRecipient {
  id: string;
  campaign_id: string;
  customer_id: string;
  status: RecipientStatus;
  message_body: string;
  sent_at?: Date;
}

// ── Delivery Event ────────────────────────────────────────
export type EventType = 'sent' | 'delivered' | 'opened' | 'clicked' | 'failed';

export interface DeliveryEvent {
  id: string;
  recipient_id: string;
  event_type: EventType;
  metadata?: Record<string, unknown>;
  occurred_at: Date;
}

// ── API Payloads ──────────────────────────────────────────
export interface SegmentPreviewResponse {
  count: number;
  sample: Customer[];
}

export interface CampaignStats {
  campaign_id: string;
  total: number;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  failed: number;
  delivered_rate: number;
  open_rate: number;
  click_rate: number;
}

export interface SendPayload {
  recipientId: string;
  message: string;
  channel: CampaignChannel;
  callbackUrl: string;
}

export interface ReceiptPayload {
  recipientId: string;
  eventType: EventType;
  occurredAt: string;
}

export interface AIParseSegmentRequest {
  query: string;
}

export interface AIGenerateMessageRequest {
  segmentDescription: string;
  channel: CampaignChannel;
  brandName?: string;
}
