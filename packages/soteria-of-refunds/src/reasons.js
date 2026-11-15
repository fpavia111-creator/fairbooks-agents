// Card-network dispute reason codes -> dispute category -> evidence checklist.
// A working map for triage, not the networks' rulebooks: codes and evidence rules
// change, and your processor's dispute guide is the one that counts.

/** code -> [category, label]. Keys are upper-case. */
export const REASON_CODES = Object.freeze({
  visa: {
    '10.1': ['fraud', 'EMV liability shift counterfeit fraud'], '10.2': ['fraud', 'EMV liability shift non-counterfeit fraud'], '10.3': ['fraud', 'Other fraud: card-present'], '10.4': ['fraud', 'Other fraud: card-absent'], '10.5': ['fraud', 'Visa fraud monitoring program'],
    '11.1': ['authorization', 'Card recovery bulletin'], '11.2': ['authorization', 'Declined authorization'], '11.3': ['authorization', 'No authorization'],
    '12.1': ['processing_error', 'Late presentment'], '12.2': ['processing_error', 'Incorrect transaction code'], '12.3': ['processing_error', 'Incorrect currency'], '12.4': ['processing_error', 'Incorrect account number'], '12.5': ['processing_error', 'Incorrect amount'], '12.6.1': ['duplicate', 'Duplicate processing'], '12.6.2': ['duplicate', 'Paid by other means'], '12.7': ['processing_error', 'Invalid data'],
    '13.1': ['not_received', 'Merchandise/services not received'], '13.2': ['cancelled_recurring', 'Cancelled recurring transaction'], '13.3': ['not_as_described', 'Not as described or defective merchandise/services'], '13.4': ['not_as_described', 'Counterfeit merchandise'], '13.5': ['not_as_described', 'Misrepresentation'], '13.6': ['credit_not_processed', 'Credit not processed'], '13.7': ['credit_not_processed', 'Cancelled merchandise/services'], '13.8': ['not_received', 'Original credit transaction not accepted'], '13.9': ['not_received', 'Non-receipt of cash or load transaction value'],
  },
  mastercard: {
    4808: ['authorization', 'Authorization-related chargeback'], 4812: ['processing_error', 'Account number not on file'], 4831: ['processing_error', 'Transaction amount differs'], 4834: ['duplicate', 'Point-of-interaction error (duplicate / paid by other means)'],
    4837: ['fraud', 'No cardholder authorization'], 4840: ['fraud', 'Fraudulent processing of transactions'], 4841: ['cancelled_recurring', 'Cancelled recurring or digital goods'], 4842: ['processing_error', 'Late presentment'],
    4849: ['fraud', 'Questionable merchant activity'], 4853: ['not_as_described', 'Cardholder dispute (defective / not as described)'], 4855: ['not_received', 'Goods or services not provided'], 4859: ['not_received', 'Addendum, no-show or ATM dispute'], 4860: ['credit_not_processed', 'Credit not processed'], 4863: ['fraud', 'Cardholder does not recognize (potential fraud)'], 4870: ['fraud', 'Chip liability shift'], 4871: ['fraud', 'Chip/PIN liability shift'],
  },
  amex: {
    A01: ['authorization', 'Charge amount exceeds authorization amount'], A02: ['authorization', 'No valid authorization'], A08: ['authorization', 'Authorization approval expired'],
    C02: ['credit_not_processed', 'Credit not processed'], C04: ['not_received', 'Goods/services returned or refused'], C05: ['credit_not_processed', 'Goods/services cancelled'], C08: ['not_received', 'Goods/services not received or only partially received'], C14: ['duplicate', 'Paid by other means'], C18: ['credit_not_processed', '"No show" or CARDeposit cancelled'], C28: ['cancelled_recurring', 'Cancelled recurring billing'], C31: ['not_as_described', 'Goods/services not as described'], C32: ['not_as_described', 'Goods/services damaged or defective'],
    F10: ['fraud', 'Missing imprint'], F14: ['fraud', 'Missing signature'], F24: ['fraud', 'No card member authorization'], F29: ['fraud', 'Card not present'], F30: ['fraud', 'EMV counterfeit'], F31: ['fraud', 'EMV lost/stolen/non-received'],
    P01: ['processing_error', 'Unassigned card number'], P03: ['credit_not_processed', 'Credit processed as charge'], P04: ['processing_error', 'Charge processed as credit'], P05: ['processing_error', 'Incorrect charge amount'], P07: ['processing_error', 'Late submission'], P08: ['duplicate', 'Duplicate charge'], P22: ['processing_error', 'Non-matching card number'], P23: ['processing_error', 'Currency discrepancy'],
  },
  discover: {
    AA: ['fraud', 'Does not recognize'], AP: ['cancelled_recurring', 'Cancelled recurring transaction'], AW: ['processing_error', 'Altered amount'], CD: ['credit_not_processed', 'Credit posted as card sale'], DP: ['duplicate', 'Duplicate processing'], NF: ['processing_error', 'Non-receipt of cash from ATM'], PM: ['duplicate', 'Paid by other means'], RG: ['not_received', 'Non-receipt of goods or services'], RM: ['not_as_described', 'Cardholder disputes quality of goods or services'], RN2: ['credit_not_processed', 'Credit not received'], UA01: ['fraud', 'Fraud: card-present transaction'], UA02: ['fraud', 'Fraud: card-not-present transaction'],
  },
});

const TEXT = [
  ['fraud', /fraud|unauthori[sz]ed|not recogni[sz]ed|did not (make|authori[sz]e)|stolen/i],
  ['duplicate', /duplicate|charged twice|double charge|paid by other means/i],
  ['credit_not_processed', /credit not|refund not|not refunded|returned but/i],
  ['cancelled_recurring', /recurring|subscription|cancel+ed (plan|membership|service)/i],
  ['not_received', /not.?received|never.?arrived|non.?receipt|missing|not delivered|not provided/i],
  ['not_as_described', /not as described|defective|damaged|counterfeit|quality|wrong item|misrepresent/i],
];

export function detectNetwork(code, network) {
  const n = String(network || '').trim().toLowerCase().replace(/[^a-z]/g, '');
  if (/^visa/.test(n)) return 'visa';
  if (/^(mastercard|mc)/.test(n)) return 'mastercard';
  if (/^(amex|americanexpress)/.test(n)) return 'amex';
  if (/^discover/.test(n)) return 'discover';
  const c = String(code || '').trim().toUpperCase();
  if (/^1[0-3]\.\d(\.\d)?$/.test(c)) return 'visa';
  if (/^48\d\d$/.test(c)) return 'mastercard';
  if (/^[ACFPR]\d\d$/.test(c)) return 'amex';
  if (/^(UA0\d|AA|AP|AW|CD|DP|NF|PM|RG|RM|RN2)$/.test(c)) return 'discover';
  return null;
}

/**
 * Classify a dispute: from the network reason code when known, else from the reason text.
 * overrides: { "<CODE>": "<category>" } from the policy file win over the built-in table.
 */
export function classifyDispute({ reason_code: code, network, reason }, overrides = {}) {
  const c = String(code || '').trim().toUpperCase();
  if (c && overrides[c]) return { category: overrides[c], source: 'policy_override', network: detectNetwork(c, network), code: c, label: 'Mapped in your policy file' };
  const net = detectNetwork(c, network);
  const hit = net && REASON_CODES[net][c];
  if (hit) return { category: hit[0], source: 'reason_code', network: net, code: c, label: hit[1] };
  const t = TEXT.find(([, re]) => re.test(String(reason || '')));
  return { category: t ? t[0] : 'general', source: t ? 'reason_text' : 'none', network: net, code: c || null, label: c ? 'Unknown code; classified from the reason text' : 'No reason code; classified from the reason text' };
}

/**
 * Evidence checklist per category. `check` names a fact Soteria can see in your exports;
 * items without one must be attached by a person.
 */
export const CHECKLISTS = Object.freeze({
  fraud: [
    { id: 'avs_cvv', label: 'AVS and CVV results from the authorization' },
    { id: 'delivery_proof', label: 'Proof of delivery (carrier record)', check: 'delivered' },
    { id: 'tracking', label: 'Tracking number', check: 'tracking' },
    { id: 'prior_undisputed', label: 'Two or more earlier undisputed orders from this customer 120-365 days before the dispute (may support Visa Compelling Evidence 3.0; check your processor)', check: 'prior_undisputed' },
    { id: 'device_ip', label: 'IP address / device id matching earlier undisputed orders' },
    { id: 'customer_contact', label: 'Customer messages or account activity linking them to the order' },
  ],
  not_received: [
    { id: 'tracking', label: 'Tracking number', check: 'tracking' },
    { id: 'delivery_proof', label: 'Delivery date and carrier proof of delivery', check: 'delivered' },
    { id: 'ship_address', label: 'Shipping address matches the address on the order' },
    { id: 'customer_contact', label: 'Customer messages about delivery' },
  ],
  not_as_described: [
    { id: 'listing', label: 'Product description / listing as shown at checkout' },
    { id: 'policy_shown', label: 'Refund or return policy shown at checkout' },
    { id: 'return_status', label: 'Whether the item was returned', check: 'returned' },
    { id: 'delivery_proof', label: 'Delivery record', check: 'delivered' },
    { id: 'customer_contact', label: 'Customer messages and any offer of return or replacement' },
  ],
  duplicate: [
    { id: 'separate_charges', label: 'Both transactions, showing they are separate orders or that one was already refunded' },
    { id: 'prior_refund', label: 'Earlier refund or credit on this order', check: 'refunded' },
    { id: 'order_record', label: 'Order record for the disputed charge', check: 'order' },
  ],
  credit_not_processed: [
    { id: 'policy_shown', label: 'Refund or cancellation policy shown at checkout' },
    { id: 'return_status', label: 'Whether the item came back', check: 'returned' },
    { id: 'prior_refund', label: 'Refund or credit already issued', check: 'refunded' },
    { id: 'customer_contact', label: 'Customer messages about the return or cancellation' },
  ],
  cancelled_recurring: [
    { id: 'terms', label: 'Recurring terms the customer agreed to, and the cancellation method' },
    { id: 'no_cancel', label: 'Record that no cancellation was received before the charge' },
    { id: 'usage', label: 'Use of the service after the billing date' },
    { id: 'order_record', label: 'Order or subscription record', check: 'order' },
  ],
  authorization: [
    { id: 'auth_record', label: 'Authorization approval code and date' },
    { id: 'order_record', label: 'Order record', check: 'order' },
  ],
  processing_error: [
    { id: 'receipt', label: 'Receipt showing amount, currency and date' },
    { id: 'order_record', label: 'Order record', check: 'order' },
  ],
  general: [
    { id: 'order_record', label: 'Order record', check: 'order' },
    { id: 'delivery_proof', label: 'Delivery record', check: 'delivered' },
    { id: 'policy_shown', label: 'Terms and refund policy shown at checkout' },
    { id: 'customer_contact', label: 'Customer messages about this order' },
  ],
});
export const CATEGORIES = Object.freeze(Object.keys(CHECKLISTS));
