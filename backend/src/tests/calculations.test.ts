import { LoanEngineService } from '../services/loanEngine';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion Failed: ${message}`);
  }
}

async function runTests() {
  console.log('--- Starting Loan Engine Calculation Tests ---');

  // Test 1: Compound Interest EMI Generation
  console.log('\nRunning Test 1: Compound Interest (Reducing Balance) schedule generation...');
  const compResult = LoanEngineService.calculateSchedule(
    10000,     // Principal
    12.0,      // Rate
    12,        // Tenure Months
    'COMPOUND',
    new Date('2026-01-01')
  );

  console.log(`- Calculated EMI: ${compResult.emi} (Expected: ~888.49)`);
  console.log(`- Total Interest: ${compResult.totalInterest} (Expected: ~661.85)`);
  console.log(`- Total Payable: ${compResult.totalPayable} (Expected: ~10661.85)`);
  console.log(`- Schedule Installments: ${compResult.schedule.length}`);

  assert(Math.abs(compResult.emi - 888.49) < 1, 'Compound EMI should be close to 888.49');
  assert(Math.abs(compResult.totalInterest - 661.85) < 5, 'Compound total interest should be close to 661.85');
  assert(compResult.schedule.length === 12, 'Schedule should have 12 rows');
  assert(Math.abs(compResult.schedule[0].interestAmount - 100) < 0.1, 'First installment interest should be 100 (10000 * 0.01)');
  console.log('✔ Test 1 Passed!');

  // Test 2: Simple Flat Interest Generation
  console.log('\nRunning Test 2: Simple (Flat Rate) schedule generation...');
  const simpleResult = LoanEngineService.calculateSchedule(
    5000,
    10.0,
    6,
    'SIMPLE',
    new Date('2026-01-01')
  );

  console.log(`- Calculated EMI: ${simpleResult.emi} (Expected: ~875.00)`);
  console.log(`- Total Interest: ${simpleResult.totalInterest} (Expected: ~250.00)`);
  console.log(`- Total Payable: ${simpleResult.totalPayable} (Expected: ~5250.00)`);

  assert(Math.abs(simpleResult.emi - 875.00) < 0.1, 'Simple EMI should be exactly 875');
  assert(Math.abs(simpleResult.totalInterest - 250.00) < 0.1, 'Simple total interest should be exactly 250');
  assert(simpleResult.schedule[0].interestAmount === 41.67 || simpleResult.schedule[0].interestAmount === 41.66, 'Monthly simple interest should be 250/6 ~ 41.67');
  console.log('✔ Test 2 Passed!');

  // Test 3: Rescheduling - Option A (Reduce EMI)
  console.log('\nRunning Test 3: Principal Reduction Option A (Reduce EMI)...');
  // Say customer pays principal prepay, remaining principal is 6000, original tenure remaining is 8 months
  const optAResult = LoanEngineService.recalculateRemainingSchedule(
    6000,
    12.0,
    8,
    'COMPOUND',
    888.49,
    'REDUCE_EMI',
    new Date('2026-03-01')
  );

  console.log(`- Recalculated EMI: ${optAResult.emi} (Original was 888.49)`);
  console.log(`- New schedule rows: ${optAResult.schedule.length}`);
  
  assert(optAResult.emi < 888.49, 'New EMI should be lower than original');
  assert(optAResult.schedule.length === 8, 'Schedule months should remain 8');
  console.log('✔ Test 3 Passed!');

  // Test 4: Rescheduling - Option B (Reduce Tenure)
  console.log('\nRunning Test 4: Principal Reduction Option B (Reduce Tenure)...');
  const optBResult = LoanEngineService.recalculateRemainingSchedule(
    5000,
    12.0,
    8,
    'COMPOUND',
    888.49,
    'REDUCE_TENURE',
    new Date('2026-03-01')
  );

  console.log(`- Recalculated EMI: ${optBResult.emi} (Should remain ~888.49)`);
  console.log(`- New schedule rows: ${optBResult.schedule.length} (Should be less than 8 months)`);
  
  assert(Math.abs(optBResult.emi - 888.49) < 0.1, 'EMI should remain same');
  assert(optBResult.schedule.length < 8, 'Tenure should be shortened');
  console.log('✔ Test 4 Passed!');

  // Test 5: Edge Case - Zero Interest Rate
  console.log('\nRunning Test 5: Edge Case - Zero Interest Rate...');
  const zeroInterestResult = LoanEngineService.calculateSchedule(
    5000,
    0.0,
    5,
    'COMPOUND',
    new Date('2026-01-01')
  );

  console.log(`- Calculated EMI: ${zeroInterestResult.emi} (Expected: 1000)`);
  console.log(`- Total Interest: ${zeroInterestResult.totalInterest} (Expected: 0)`);
  
  assert(Math.abs(zeroInterestResult.emi - 1000) < 0.1, 'Zero interest EMI should be Principal / Tenure');
  assert(zeroInterestResult.totalInterest === 0, 'Total interest should be 0');
  console.log('✔ Test 5 Passed!');

  console.log('\n--- All Loan Engine Calculation Tests Passed! ---');
}

runTests().catch((err) => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
