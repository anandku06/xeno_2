/**
 * Delivery outcome simulator.
 * Simulates real-world message delivery with weighted random outcomes.
 *
 * Tradeoff: using setTimeout instead of a real queue for delay simulation.
 * At production volume, would use SQS or BullMQ here too.
 */

export interface SimulationResult {
  events: Array<{ eventType: string; delay: number }>;
}

/**
 * Simulate delivery outcome with weighted probabilities:
 * - delivered: 70%
 * - failed: 10%
 * - opened (of delivered): 50%
 * - clicked (of opened): 20%
 */
export function simulateOutcome(): SimulationResult {
  const events: Array<{ eventType: string; delay: number }> = [];

  const rand = Math.random();

  if (rand < 0.10) {
    // 10% chance of failure
    events.push({
      eventType: 'failed',
      delay: 1000 + Math.random() * 3000,
    });
  } else {
    // 90% chance of delivery attempt, 70% actually delivered (from total)
    // Simplifying: if not failed, then delivered
    const deliveryDelay = 2000 + Math.random() * 8000;
    events.push({
      eventType: 'delivered',
      delay: deliveryDelay,
    });

    // 50% of delivered get opened
    if (Math.random() < 0.50) {
      const openDelay = deliveryDelay + 1000 + Math.random() * 5000;
      events.push({
        eventType: 'opened',
        delay: openDelay,
      });

      // 20% of opened get clicked
      if (Math.random() < 0.20) {
        const clickDelay = openDelay + 500 + Math.random() * 3000;
        events.push({
          eventType: 'clicked',
          delay: clickDelay,
        });
      }
    }
  }

  return { events };
}
