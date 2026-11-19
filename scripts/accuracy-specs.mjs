// What the fixtures of the agents behind the four engagements (Month-end, Access review, Dispute packs,
// Migration readiness) plant on purpose, how the clean set is made, and one-edit mutation cases.
// Used by scripts/accuracy.mjs. Written in the final pass (19 Nov 2026) by the same author as the rules.
//
// case:      the eval case whose tool and files are the planted run (args may be overridden with `args`).
// planted:   finding codes the fixture notes and that eval case name (a code listed twice is planted twice).
// ignore:    informational tags that are not problems (an admin role is a review priority, not a finding).
// clean:     edits that remove each planted problem and nothing else:
//              ['set', file, where, values] ['drop', file, where] ['dropLast', file, where] ['add', file, row]
//              ['text', file, from, to]   (any text file: receipts, JSON)
// mutations: one edit on the clean set and the finding code it must raise.
// Agents not listed here are not measured yet (see docs/accuracy-2026-11-19.md).

export const SPECS = {
  'fairbooks-three-way-match': {
    case: 'match-finds-exceptions',
    planted: ['qty_over_received', 'partial_receipt', 'price_variance', 'duplicate_invoice', 'not_received', 'no_po', 'po_line_missing'],
    clean: [
      ['set', 'fixtures/receipts.csv', { receipt: 'GRN-902' }, { qty: '50' }],
      ['set', 'fixtures/invoices.csv', { invoice: 'INV-2003' }, { unit_price: '180.00' }],
      ['dropLast', 'fixtures/invoices.csv', { invoice: 'INV-2001' }],
      ['add', 'fixtures/receipts.csv', { receipt: 'GRN-904', po: 'PO-4473', line: '1', qty: '5', date: '2026-11-06' }],
      ['drop', 'fixtures/invoices.csv', { invoice: 'INV-2005' }],
      ['drop', 'fixtures/invoices.csv', { invoice: 'INV-2006' }],
    ],
    mutations: [
      { id: 'price-up', op: ['set', 'fixtures/invoices.csv', { invoice: 'INV-2001' }, { unit_price: '12.50' }], expect: 'price_variance' },
      { id: 'billed-more', op: ['set', 'fixtures/invoices.csv', { invoice: 'INV-2004' }, { qty: '6' }], expect: 'qty_over_received' },
      { id: 'billed-twice', op: ['add', 'fixtures/invoices.csv', { invoice: 'INV-2004', vendor: 'Initech Hardware (fictional)', po: 'PO-4473', line: '1', qty: '5', unit_price: '1400.00', date: '2026-11-07' }], expect: 'duplicate_invoice' },
    ],
  },

  'fairbooks-refunds-and-chargebacks': {
    case: 'triage-per-policy',
    planted: ['over_review_threshold_200', 'over_review_threshold_200', 'outside_window_72_days', 'no_tracking', 'exceeds_refundable_50', 'duplicate_of_R-1001', 'order_not_found'],
    clean: [
      ['set', 'fixtures/requests.csv', { request_id: 'R-1002' }, { amount: '180.00' }],
      ['set', 'fixtures/orders.csv', { order_id: 'O-502' }, { amount: '180.00' }],
      ['set', 'fixtures/requests.csv', { request_id: 'R-1006' }, { amount: '190.00' }],
      ['set', 'fixtures/orders.csv', { order_id: 'O-506' }, { amount: '190.00' }],
      ['set', 'fixtures/orders.csv', { order_id: 'O-503' }, { delivered_date: '2026-10-25' }],
      ['set', 'fixtures/orders.csv', { order_id: 'O-504' }, { delivered_date: '2026-11-04', tracking: '1Z999EXAMPLE04', status: 'delivered' }],
      ['set', 'fixtures/orders.csv', { order_id: 'O-505' }, { refunded: '0' }],
      ['drop', 'fixtures/requests.csv', { request_id: 'R-1007' }],
      ['add', 'fixtures/orders.csv', { order_id: 'O-999', customer: 'gus@example.com', amount: '20.00', refunded: '0', order_date: '2026-10-28', delivered_date: '2026-11-01', tracking: '1Z999EXAMPLE99', status: 'delivered' }],
    ],
    mutations: [
      { id: 'delivered-long-ago', op: ['set', 'fixtures/orders.csv', { order_id: 'O-501' }, { delivered_date: '2026-09-15' }], expect: 'outside_window_48_days' },
      { id: 'already-refunded', op: ['set', 'fixtures/orders.csv', { order_id: 'O-501' }, { refunded: '30.00' }], expect: 'exceeds_refundable_15' },
      { id: 'large-request', op: ['set', 'fixtures/requests.csv', { request_id: 'R-1001' }, { amount: '250.00' }], expect: 'over_review_threshold_200' },
    ],
  },

  'fairbooks-access-review': {
    case: 'finds-leaver',
    planted: ['not_in_hr_roster', 'never_logged_in', 'privileged_without_mfa', 'shared_or_generic_account', 'non_human_without_owner', 'non_human_without_rotation_date', 'terminated_in_hr', 'terminated_in_hr', 'stale_166_days'],
    ignore: ['privileged_role'],
    clean: [
      ['drop', 'fixtures/access-export.csv', { user: 'shared mailbox' }],
      ['set', 'fixtures/access-export.csv', { user: 'integration-sync' }, { owner: 'Avery Stone (fictional)', last_rotated: '2026-09-01' }],
      ['set', 'fixtures/hr-roster.csv', { email: 'riley.park@example.com' }, { status: 'active', termination_date: '' }],
      ['set', 'fixtures/access-export.csv', { user: 'Jordan Lee (fictional)' }, { last_login: '2026-11-05' }],
    ],
    mutations: [
      { id: 'admin-without-mfa', op: ['set', 'fixtures/access-export.csv', { user: 'Avery Stone (fictional)' }, { mfa: 'no' }], expect: 'privileged_without_mfa' },
      { id: 'leaver', op: ['set', 'fixtures/hr-roster.csv', { email: 'sam.rivera@example.com' }, { status: 'terminated', termination_date: '2026-10-15' }], expect: 'terminated_in_hr' },
      { id: 'stale', op: ['set', 'fixtures/access-export.csv', { user: 'Sam Rivera (fictional)' }, { last_login: '2026-03-01' }], expect: 'stale_258_days' },
    ],
  },

  'fairbooks-erp-migration': {
    case: 'untied-books-blocking',
    planted: ['missing_in_target', 'field_mismatch', 'totals_do_not_tie'],
    clean: [
      ['set', 'fixtures/netsuite-sandbox-open-invoices.csv', { externalid: 'INV-1040' }, { amount: '2450.00' }],
      ['add', 'fixtures/netsuite-sandbox-open-invoices.csv', { externalid: 'INV-1041', customer: 'Copper Kettle Foods (fictional)', date: '2026-09-15', amount: '1500.00', currency: 'USD', status: 'open' }],
    ],
    mutations: [
      { id: 'currency-changed', op: ['set', 'fixtures/netsuite-sandbox-open-invoices.csv', { externalid: 'INV-1038' }, { currency: 'EUR' }], expect: 'field_mismatch' },
      { id: 'not-loaded', op: ['drop', 'fixtures/netsuite-sandbox-open-invoices.csv', { externalid: 'INV-1039' }], expect: 'missing_in_target' },
    ],
  },

  'fairbooks-master-data-duplicates': {
    case: 'finds-acme-by-tax-id',
    planted: ['duplicate_cluster', 'duplicate_cluster', 'weak_pair'],
    note: 'A finding here is a proposed merge cluster (and a weak pair below the threshold); the match reasons inside a cluster are its explanation.',
    clean: [
      ['drop', 'fixtures/vendors.csv', { internalid: 'V101' }],
      ['drop', 'fixtures/vendors.csv', { internalid: 'V103' }],
      ['set', 'fixtures/vendors.csv', { internalid: 'V105' }, { companyname: 'Cedar Point Robotics (fictional)', email: 'ap@cedarpoint.example' }],
    ],
    mutations: [
      { id: 'same-tax-id', op: ['add', 'fixtures/vendors.csv', { internalid: 'V107', companyname: 'Copper Kettle Foods LLC (fictional)', taxid: '44-3332221', email: 'billing@copperkettle.example', phone: '214-555-0111', address: '5 Elm Street Dallas TX', isinactive: 'F' }], expect: 'duplicate_cluster' },
      { id: 'retyped-name', op: ['add', 'fixtures/vendors.csv', { internalid: 'V108', companyname: 'Blue Harbour Logistics (fictional)', taxid: '', email: 'ar@blueharbor.example', phone: '312 555 0199', address: '9 Dock Road Chicago IL', isinactive: 'F' }], expect: 'duplicate_cluster' },
    ],
  },

  'fairbooks-expense-policy': {
    case: 'recommendations',
    planted: ['over_limit', 'preapproval_missing', 'receipt_amount_mismatch', 'late_submission', 'late_submission', 'disallowed_category', 'disallowed_category', 'attendees_missing', 'possible_duplicate', 'receipt_reused', 'missing_receipt'],
    clean: [
      ['set', 'fixtures/expenses.csv', { report_id: 'R-101', line_id: '2' }, { amount: '150.00' }],
      ['text', 'fixtures/receipts/r101-dinner.txt', '210.00', '150.00'],
      ['set', 'fixtures/expenses.csv', { report_id: 'R-103', line_id: '1' }, { amount: '624.00', submitted_on: '2026-09-10', preapproved_by: 'Kim Ortiz' }],
      ['drop', 'fixtures/expenses.csv', { report_id: 'R-103', line_id: '2' }],
      ['set', 'fixtures/expenses.csv', { report_id: 'R-104', line_id: '1' }, { attendees: '1' }],
      ['drop', 'fixtures/expenses.csv', { report_id: 'R-104', line_id: '3' }],
      ['set', 'fixtures/expenses.csv', { report_id: 'R-104', line_id: '4' }, { amount: '20.00' }],
      ['drop', 'fixtures/expenses.csv', { report_id: 'R-105' }],
    ],
    mutations: [
      { id: 'hotel-over', op: ['set', 'fixtures/expenses.csv', { report_id: 'R-101', line_id: '1' }, { amount: '560.00' }], expect: 'over_limit' },
      { id: 'sent-late', op: ['set', 'fixtures/expenses.csv', { report_id: 'R-102', line_id: '1' }, { submitted_on: '2026-12-01' }], expect: 'late_submission' },
      { id: 'no-receipt', op: ['set', 'fixtures/expenses.csv', { report_id: 'R-102', line_id: '2' }, { amount: '40.00' }], expect: 'missing_receipt' },
    ],
  },

  'fairbooks-bank-reconciliation': {
    case: 'matches-and-ties',
    planted: ['bank_fee', 'interest', 'outstanding_payment', 'deposit_in_transit'],
    note: 'The planted problems are October\'s reconciling items (a fee and interest only on the bank side, a check and a deposit only in the ledger). In the clean month both sides carry all four lines and close at 12,822.88.',
    args: { bank_balance: 12822.88, gl_balance: 12822.88 },
    clean: [
      ['add', 'fixtures/gl-cash.csv', { date: '2026-10-31', memo: 'Monthly service fee', reference: '', amount: '-25.00' }],
      ['add', 'fixtures/gl-cash.csv', { date: '2026-10-31', memo: 'Interest paid', reference: '', amount: '3.12' }],
      ['add', 'fixtures/bank-statement.csv', { date: '2026-10-30', description: 'Check 4103', reference: '4103', amount: '-400.00' }],
      ['add', 'fixtures/bank-statement.csv', { date: '2026-10-31', description: 'Deposit', reference: 'R-503', amount: '800.00' }],
    ],
    mutations: [
      { id: 'fee-not-booked', op: ['add', 'fixtures/bank-statement.csv', { date: '2026-10-31', description: 'Wire fee', reference: '', amount: '-15.00' }], expect: 'bank_fee' },
      { id: 'check-not-cleared', op: ['add', 'fixtures/gl-cash.csv', { date: '2026-10-30', memo: 'Check 4104 Initech (fictional)', reference: '4104', amount: '-150.00' }], expect: 'outstanding_payment' },
    ],
  },
};
