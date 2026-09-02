/* ============================================================
 * Laskupaja – invoice numbering tests (plain Node, no framework)
 * Run: node tests/increment.test.js
 *
 * Covers js/numbering.js, the exact module the invoice page uses:
 *  1. Trailing-digit increment ("2026-004" -> "2026-005", …)
 *  2. No trailing digits -> returned unchanged (editable as-is)
 *  3. Zero padding preserved ("099" -> "100", "009" -> "010")
 *  4. Prefix preservation (multi-part prefixes)
 *  5. First-visit default: current year + "-001"
 *  6. Edge cases: whitespace, zero, huge digit runs
 * ============================================================ */
'use strict';

const N = require('../js/numbering.js');

let passed = 0;
let failed = 0;

function ok(cond, label) {
  if (cond) {
    passed++;
    console.log('  PASS ' + label);
  } else {
    failed++;
    console.error('  FAIL ' + label);
  }
}

console.log('Laskupaja invoice numbering tests');
console.log('='.repeat(60));

/* ---------- 1. Trailing-digit increment ---------- */

console.log('\n[1] Trailing-digit increment');
ok(N.nextInvoiceNumber('2026-004') === '2026-005', '"2026-004" -> "2026-005"');
ok(N.nextInvoiceNumber('INV007') === 'INV008', '"INV007" -> "INV008"');
ok(N.nextInvoiceNumber('1') === '2', '"1" -> "2"');
ok(N.nextInvoiceNumber('42') === '43', '"42" -> "43"');
ok(N.nextInvoiceNumber('2026001') === '2026002', '"2026001" -> "2026002"');

/* ---------- 2. No trailing digits: left as-is ---------- */

console.log('\n[2] No trailing digits -> unchanged (editable as-is)');
ok(N.nextInvoiceNumber('ABC') === 'ABC', '"ABC" unchanged');
ok(N.nextInvoiceNumber('lasku') === 'lasku', '"lasku" unchanged');
ok(N.nextInvoiceNumber('2026-') === '2026-', 'trailing dash, no digits: unchanged');
ok(N.nextInvoiceNumber('RE-B') === 'RE-B', 'prefix-only value unchanged');

/* ---------- 3. Zero padding preserved ---------- */

console.log('\n[3] Zero padding preserved');
ok(N.nextInvoiceNumber('099') === '100', '"099" -> "100"');
ok(N.nextInvoiceNumber('009') === '010', '"009" -> "010"');
ok(N.nextInvoiceNumber('008') === '009', '"008" -> "009"');
ok(N.nextInvoiceNumber('000001') === '000002', '"000001" -> "000002"');
ok(N.nextInvoiceNumber('2026-099') === '2026-100', '"2026-099" -> "2026-100" (rollover keeps width)');
ok(N.nextInvoiceNumber('999') === '1000', '"999" -> "1000" (all nines grow one digit)');

/* ---------- 4. Prefix preservation ---------- */

console.log('\n[4] Prefix preserved');
ok(N.nextInvoiceNumber('RE-0009') === 'RE-0010', '"RE-0009" -> "RE-0010"');
ok(N.nextInvoiceNumber('INV-2026-013') === 'INV-2026-014', '"INV-2026-013" -> "INV-2026-014"');
ok(N.nextInvoiceNumber('2026-004') !== '2026-4', 'padding not lost ("2026-005", not "2026-4")');

/* ---------- 5. First-visit default ---------- */

console.log('\n[5] First-visit default: current year + "-001"');
const year = String(new Date().getFullYear());
ok(N.defaultInvoiceNumber() === year + '-001', 'defaultInvoiceNumber() === "' + year + '-001"');
ok(N.nextInvoiceNumber(null) === year + '-001', 'null -> "' + year + '-001"');
ok(N.nextInvoiceNumber(undefined) === year + '-001', 'undefined -> "' + year + '-001"');
ok(N.nextInvoiceNumber('') === year + '-001', 'empty string -> "' + year + '-001"');
ok(N.nextInvoiceNumber('   ') === year + '-001', 'whitespace -> "' + year + '-001"');
ok(N.nextInvoiceNumber(year + '-001') === year + '-002', '"' + year + '-001" -> "' + year + '-002"');

/* ---------- 6. Edge cases ---------- */

console.log('\n[6] Edge cases');
ok(N.nextInvoiceNumber(' 2026-004 ') === '2026-005', 'surrounding whitespace trimmed');
ok(N.nextInvoiceNumber('0') === '1', '"0" -> "1"');
ok(N.nextInvoiceNumber('INV 009') === 'INV 010', 'space inside prefix kept: "INV 009" -> "INV 010"');
const longDigits = '9'.repeat(19);
ok(N.nextInvoiceNumber(longDigits) === '1' + '0'.repeat(19), '19-digit all-nines roll over exactly (BigInt)');
ok(N.nextInvoiceNumber('1'.repeat(19)) === '1'.repeat(18) + '2', '19 ones increment exactly (BigInt precision)');

/* ---------- Summary ---------- */

console.log('\n' + '='.repeat(60));
console.log(`Assertions: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log('RESULT: FAIL');
  process.exit(1);
} else {
  console.log('RESULT: ALL TESTS PASSED');
}
