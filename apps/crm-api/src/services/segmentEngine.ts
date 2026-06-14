import pool from '../db/client';

// Whitelist of allowed fields to prevent SQL injection
const ALLOWED_FIELDS: Record<string, string> = {
  total_spend: 'COALESCE(SUM(o.total_amount), 0)',
  order_count: 'COUNT(o.id)',
  days_since_last_order: `EXTRACT(DAY FROM NOW() - MAX(o.ordered_at))`,
  city: 'c.city',
};

const OPERATOR_MAP: Record<string, string> = {
  gt: '>',
  lt: '<',
  eq: '=',
  gte: '>=',
  lte: '<=',
  neq: '!=',
};

interface SegmentRule {
  field: string;
  operator: string;
  value: string | number;
}

/**
 * Builds a parameterized SQL query from an array of segment rules.
 * Returns { query, params } — never uses string interpolation for values.
 */
export function buildSegmentQuery(
  rules: SegmentRule[],
  options: { limit?: number; countOnly?: boolean } = {}
): { query: string; params: any[] } {
  const params: any[] = [];
  const havingClauses: string[] = [];
  const whereClauses: string[] = [];

  for (const rule of rules) {
    const fieldExpr = ALLOWED_FIELDS[rule.field];
    if (!fieldExpr) {
      throw new Error(`Invalid field: ${rule.field}. Allowed: ${Object.keys(ALLOWED_FIELDS).join(', ')}`);
    }

    const sqlOp = OPERATOR_MAP[rule.operator];
    if (!sqlOp && rule.operator !== 'in') {
      throw new Error(`Invalid operator: ${rule.operator}. Allowed: ${Object.keys(OPERATOR_MAP).join(', ')}, in`);
    }

    // city is a WHERE clause (non-aggregate), rest are HAVING clauses (aggregate)
    if (rule.field === 'city') {
      if (rule.operator === 'in') {
        const cities = Array.isArray(rule.value) ? rule.value : [rule.value];
        const placeholders = cities.map((_, i) => `$${params.length + i + 1}`);
        whereClauses.push(`LOWER(c.city) IN (${placeholders.join(', ')})`);
        params.push(...cities.map((c) => String(c).toLowerCase()));
      } else {
        params.push(typeof rule.value === 'string' ? rule.value.toLowerCase() : rule.value);
        whereClauses.push(`LOWER(c.city) ${sqlOp} $${params.length}`);
      }
    } else {
      params.push(rule.value);
      havingClauses.push(`${fieldExpr} ${sqlOp} $${params.length}`);
    }
  }

  const whereStr = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
  const havingStr = havingClauses.length > 0 ? `HAVING ${havingClauses.join(' AND ')}` : '';

  if (options.countOnly) {
    const query = `
      SELECT COUNT(*) as count FROM (
        SELECT c.id
        FROM customers c
        LEFT JOIN orders o ON o.customer_id = c.id
        ${whereStr}
        GROUP BY c.id
        ${havingStr}
      ) AS matched
    `;
    return { query, params };
  }

  const limitStr = options.limit ? `LIMIT $${params.length + 1}` : '';
  if (options.limit) params.push(options.limit);

  const query = `
    SELECT
      c.*,
      COALESCE(COUNT(o.id), 0)::int AS order_count,
      COALESCE(SUM(o.total_amount), 0)::float AS total_spend,
      MAX(o.ordered_at) AS last_order_at,
      CASE WHEN MAX(o.ordered_at) IS NOT NULL
        THEN EXTRACT(DAY FROM NOW() - MAX(o.ordered_at))::int
        ELSE NULL
      END AS days_since_last_order
    FROM customers c
    LEFT JOIN orders o ON o.customer_id = c.id
    ${whereStr}
    GROUP BY c.id
    ${havingStr}
    ORDER BY c.created_at DESC
    ${limitStr}
  `;

  return { query, params };
}

/**
 * Executes a segment query and returns matched customers.
 */
export async function executeSegmentQuery(
  rules: SegmentRule[],
  options: { limit?: number } = {}
): Promise<any[]> {
  const { query, params } = buildSegmentQuery(rules, options);
  const result = await pool.query(query, params);
  return result.rows;
}

/**
 * Returns count of matched customers for a set of rules.
 */
export async function countSegmentMatches(rules: SegmentRule[]): Promise<number> {
  const { query, params } = buildSegmentQuery(rules, { countOnly: true });
  const result = await pool.query(query, params);
  return parseInt(result.rows[0].count);
}
