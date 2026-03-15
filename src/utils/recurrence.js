import { addWeeks, addMonths, addYears, parseISO, format, isBefore } from 'date-fns';
import { db } from '../db/schema.js';
import { generateUUID } from './security.js';
import { adjustedPaymentDate } from './banking-calendar.js';

/**
 * Generates an array of future transaction instances based on frequency and count.
 * 
 * @param {Object} base - The original transaction object to base instances on.
 * @param {string} frequency - One of 'weekly', 'biweekly', 'monthly', 'quarterly', 'annually'.
 * @param {number} count - Number of instances to generate.
 * @returns {Array} Array of generated transaction objects.
 */
export function generateInstances(base, frequency, count) {
  const instances = [];
  const baseDate = parseISO(base.parentDate || base.date);
  const recurrenceId = base.recurrenceId || generateUUID();

  for (let i = 0; i < count; i++) {
    let nextInstanceDate;
    const step = i + 1;
    
    // If we are generating from an instance that is NOT the parent, 
    // we need to offset the step. But the plan says "always calculate 
    // instances by adding the interval to the original base date (parentDate)".
    // If parentDate is not provided, we assume base.date IS the starting point.
    
    switch (frequency) {
      case 'weekly':
        nextInstanceDate = addWeeks(baseDate, step);
        break;
      case 'biweekly':
        nextInstanceDate = addWeeks(baseDate, step * 2);
        break;
      case 'monthly':
        nextInstanceDate = addMonths(baseDate, step);
        break;
      case 'quarterly':
        nextInstanceDate = addMonths(baseDate, step * 3);
        break;
      case 'annually':
        nextInstanceDate = addYears(baseDate, step);
        break;
      default:
        nextInstanceDate = addMonths(baseDate, step);
    }

    const dateStr = format(nextInstanceDate, 'yyyy-MM-dd');
    const instance = { 
      ...base, 
      date: dateStr, 
      isRecurring: true, 
      recurrenceId,
      parentDate: base.parentDate || base.date 
    };
    
    // Remove primary key
    delete instance.id;

    // Update nextDate if present
    if (instance.nextDate) instance.nextDate = dateStr;

    // Apply payment adjustment for predictedPaymentDate
    const adjustment = base.paymentAdjustment || 'none';
    const adjustedDate = adjustedPaymentDate(nextInstanceDate, adjustment);
    const adjustedDateStr = format(adjustedDate, 'yyyy-MM-dd');
    instance.predictedPaymentDate = adjustedDateStr;
    instance.paymentAdjustment = adjustment;
    // instance.date remains the nominal scheduling anchor — DO NOT adjust it

    instances.push(instance);
  }
  return instances;
}

/**
 * Advances a recurrentExpense item to its next occurrence date.
 * Pure function â€” no side effects, no DB access.
 *
 * @param {Object} item - recurrentExpense item from DB
 * @returns {{ nextDate: string, cycleCurrent: number }}
 */
export function advanceNextDate(item) {
  const base = parseISO(item.nextDate);
  let advanced;
  switch (item.frequency) {
    case 'weekly':    advanced = addWeeks(base, 1); break;
    case 'biweekly':  advanced = addWeeks(base, 2); break;
    case 'monthly':   advanced = addMonths(base, 1); break;
    case 'quarterly': advanced = addMonths(base, 3); break;
    case 'annually':  advanced = addYears(base, 1); break;
    default:          advanced = addMonths(base, 1);
  }
  const nextDate = format(advanced, 'yyyy-MM-dd');
  const shouldIncrement = item.isDebtPayment === true && item.cycleTotal > 0;
  const cycleCurrent = shouldIncrement
    ? (item.cycleCurrent || 0) + 1
    : (item.cycleCurrent || 0);
  const adjustment = item.paymentAdjustment || 'none';
  const adjustedDate = adjustedPaymentDate(parseISO(nextDate), adjustment);
  const predictedPaymentDate = format(adjustedDate, 'yyyy-MM-dd');
  return { nextDate, predictedPaymentDate, cycleCurrent };
}

export const RecurrenceManager = {
  /**
   * Scans DB for recurring series and generates new instances if needed.
   * Series nearing expiration (latest instance < 2 months away) get 12 more instances.
   */
  async checkAndGenerate() {
    const horizon = addMonths(new Date(), 2);
    const results = {
      recurrentExpenses: 0,
      oneOffExpenses: 0
    };

    // Use a transaction to ensure atomicity
    await db.transaction('rw', [db.recurrentExpenses, db.oneOffExpenses], async () => {
      for (const tableName of ['recurrentExpenses', 'oneOffExpenses']) {
        const table = db[tableName];
        
        // Dexie stores booleans/ints as 1/0 usually, but let's be safe.
        // We only care about active recurring items.
        const allRecurring = await table.where('isRecurring').equals(1).toArray();
        
        if (allRecurring.length === 0) continue;

        // Group by recurrenceId to find the latest instance for each series
        const seriesMap = new Map();
        allRecurring.forEach(item => {
          const currentLatest = seriesMap.get(item.recurrenceId);
          if (!currentLatest || isBefore(parseISO(currentLatest.date), parseISO(item.date))) {
            seriesMap.set(item.recurrenceId, item);
          }
        });

        // Check each series for expansion
        for (const [recurrenceId, latestInstance] of seriesMap) {
          const latestDate = parseISO(latestInstance.date);
          
          if (isBefore(latestDate, horizon)) {
            const frequency = latestInstance.frequency || 'monthly';
            // Generate 12 more instances starting FROM the latest instance
            // Note: generateInstances uses parentDate if available to prevent drift.
            const newInstances = generateInstances(latestInstance, frequency, 12);
            
            await table.bulkAdd(newInstances);
            results[tableName] += newInstances.length;
          }
        }
      }
    });

    return results;
  }
};
