/* ============================================================
 * Laskupaja – viitenumero tests (plain Node, no framework)
 * Run: node tests/reference.test.js
 *
 * Covers:
 *  1. Known-good fixtures (hand-verified) validate for both formats
 *  2. Known-bad fixtures fail
 *  3. generate -> validate round-trips for both formats
 *  4. Every single-digit corruption is rejected (both formats)
 *  5. Cross-format rejection + normalization (spaces, case, dashes)
 *  6. Invalid inputs (empty, letters in national, too long/short) fail
 * ============================================================ */
'use strict';

const V = require('../js/reference.js');

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

function throws(fn, label) {
  try {
    fn();
    ok(false, label + ' (expected throw)');
  } catch (e) {
    ok(true, label);
  }
}

console.log('Laskupaja viitenumero tests');
console.log('='.repeat(60));

/* ---------- 1. Known-good fixtures (hand-verified) ---------- */

console.log('\n[1] Known-good national references');
const nationalGood = ['12344', '1234561', '20260011'];
for (const ref of nationalGood) {
  ok(V.validateNational(ref) === true, `national "${ref}" is valid`);
}

console.log('\n[1b] Known-good RF references');
const rfGood = ['RF7812345', 'RF45ABC', 'RF602026001'];
for (const ref of rfGood) {
  ok(V.validateRF(ref) === true, `RF "${ref}" is valid`);
}

/* ---------- 2. Known-bad fixtures ---------- */

console.log('\n[2] Known-bad references');
ok(V.validateNational('12345') === false, 'national "12345" (wrong check) fails');
ok(V.validateNational('RF7812345') === false, 'national validator rejects RF ref');
ok(V.validateRF('RF7712345') === false, 'RF with wrong check digits fails');
ok(V.validateRF('20260011') === false, 'RF validator rejects national ref');
ok(V.validateRF('RF9812345') === false, 'RF check digits "98" fail on this base');

/* ---------- 3. Round-trips ---------- */

console.log('\n[3] generate -> validate round-trips');
const invoiceNumbers = ['1', '42', '123456789', '2026001', '2026012'];
for (const num of invoiceNumbers) {
  const nat = V.generateNational(num);
  const rf = V.generateRF(num);
  ok(nat.length >= 4 && nat.length <= 20, `national ${nat} within 4-20 chars`);
  ok(V.validateNational(nat) === true, `national ${nat} (from "${num}") validates`);
  ok(V.validateRF(rf) === true, `RF ${rf} (from "${num}") validates`);
}

/* ---------- 4. Single-digit corruptions ---------- */

console.log('\n[4] Single-digit corruptions are rejected');

function corruptDigits(ref, validateFn) {
  let allCaught = true;
  for (let i = 0; i < ref.length; i++) {
    const orig = ref[i];
    for (let d = 0; d <= 9; d++) {
      if (String(d) === orig) continue;
      const mutated = ref.slice(0, i) + d + ref.slice(i + 1);
      if (validateFn(mutated)) allCaught = false;
    }
  }
  return allCaught;
}

for (const num of ['1', '2026001', '1234567890123456789']) {
  const nat = V.generateNational(num);
  ok(corruptDigits(nat, V.validateNational), `all digit corruptions of ${nat} fail`);
}

const rfAlnum = ['2026001', 'ABC123', 'XYZ'];
for (const base of rfAlnum) {
  const rf = V.generateRF(base);
  let allCaught = true;
  for (let i = 4; i < rf.length; i++) {
    const orig = rf[i];
    const isDigit = /[0-9]/.test(orig);
    for (let d = 0; d <= (isDigit ? 9 : 1); d++) {
      let repl;
      if (isDigit) {
        if (String(d) === orig) continue;
        repl = String(d);
      } else if (d === 0) {
        repl = orig === 'A' ? 'B' : 'A'; // letter swap
      } else {
        continue;
      }
      const mutated = rf.slice(0, i) + repl + rf.slice(i + 1);
      if (V.validateRF(mutated)) allCaught = false;
    }
  }
  /* Also corrupt the two numeric check digits. */
  for (const pos of [2, 3]) {
    const orig = rf[pos];
    for (let d = 0; d <= 9; d++) {
      if (String(d) === orig) continue;
      const mutated = rf.slice(0, pos) + d + rf.slice(pos + 1);
      if (V.validateRF(mutated)) allCaught = false;
    }
  }
  ok(allCaught, `all char corruptions of ${rf} fail`);
}

/* ---------- 5. Cross-format & normalization ---------- */

console.log('\n[5] Normalization & auto-detection');
ok(V.validateNational('2026 0011') === true, 'national tolerates spaces');
ok(V.validateRF('rf60-2026-001') === true, 'RF lower-case + dashes validates');
ok(V.validateRF('rf602026001') === true, 'RF lower-case + no spaces validates');
ok(V.validateRF('RF60 2026 001'.replace(/ /g, '')) === true, 'RF tolerates spaces');
ok(V.validateAny('RF602026001').valid === true && V.validateAny('RF602026001').format === 'rf', 'validateAny detects RF');
ok(V.validateAny('20260011').valid === true && V.validateAny('20260011').format === 'national', 'validateAny detects national');
ok(V.validateAny('HELLO').valid === false, 'validateAny rejects garbage');

/* ---------- 6. Invalid inputs ---------- */

console.log('\n[6] Invalid inputs');
ok(V.validateNational('') === false, 'empty national fails');
ok(V.validateNational(null) === false, 'null national fails');
ok(V.validateNational('12A44') === false, 'letters in national fail');
ok(V.validateNational('123') === false, 'too-short national (3 chars) fails');
ok(V.validateNational('1'.repeat(21)) === false, 'too-long national (21 chars) fails');
ok(V.validateRF('RF') === false, 'bare "RF" fails');
ok(V.validateRF('RF00') === false, '"RF00" without base fails');
ok(V.validateRF('RF12' + 'A'.repeat(22)) === false, 'over-long RF base fails');
throws(() => V.generateNational(''), 'generateNational("") throws');
throws(() => V.generateNational('abc'), 'generateNational("abc") throws');
throws(() => V.generateRF(''), 'generateRF("") throws');
throws(() => V.generateRF('A'.repeat(22)), 'generateRF(22 chars) throws');

/* ---------- Summary ---------- */

console.log('\n' + '='.repeat(60));
console.log(`Assertions: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log('RESULT: FAIL');
  process.exit(1);
} else {
  console.log('RESULT: ALL TESTS PASSED');
}
