import { PrismaClient } from '@prisma/client';
import { PaymentEngineService } from '../services/paymentEngine';

const prisma = new PrismaClient();

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion Failed: ${message}`);
  }
}

async function runTests() {
  console.log('--- Starting Payment Engine Integration Tests ---');

  // Define test data variables
  let customerId: number | null = null;
  let loanId: number | null = null;

  try {
    // 1. Check/Prepare masters
    const loanType = await prisma.loanTypeMaster.findFirst({ where: { name: 'Gold Loan', is_deleted: false } });
    const interestType = await prisma.interestTypeMaster.findFirst({ where: { code: 'COMPOUND', is_deleted: false } });
    const status = await prisma.loanStatusMaster.findFirst({ where: { code: 'APPROVED', is_deleted: false } });
    const paymentType = await prisma.paymentTypeMaster.findFirst({ where: { code: 'EMI', is_deleted: false } });

    assert(!!loanType, 'Gold Loan type master should exist');
    assert(!!interestType, 'COMPOUND interest type master should exist');
    assert(!!status, 'APPROVED status master should exist');
    assert(!!paymentType, 'EMI payment type master should exist');

    console.log('✔ Masters verified.');

    // 2. Create Test Customer
    const customer = await prisma.customer.create({
      data: {
        name: 'Automated Payment Test Customer',
        mobile: '9999990001',
        email: 'payment_test@example.com',
        address: 'Test Environment Suite',
        dob: new Date('1990-01-01'),
        occupation: 'Testing Agent',
      },
    });
    customerId = customer.id;
    console.log(`✔ Customer created with ID: ${customerId}`);

    // 3. Create Test Loan
    const loan = await prisma.loan.create({
      data: {
        customerId: customer.id,
        loanTypeId: loanType!.id,
        amount: 10000.0,
        interestTypeId: interestType!.id,
        interestRate: 12.0,
        tenureMonths: 12,
        startDate: new Date('2026-01-01'),
        statusId: status!.id,
        outstandingPrincipal: 10000.0,
        outstandingInterest: 0,
      },
    });
    loanId = loan.id;
    console.log(`✔ Loan created with ID: ${loanId}`);

    // 4. Create EMI Schedule (Installment #1)
    const schedule = await prisma.emiSchedule.create({
      data: {
        loanId: loan.id,
        installmentNumber: 1,
        dueDate: new Date('2026-02-01'),
        principalAmount: 788.49,
        interestAmount: 100.0,
        totalAmount: 888.49,
        paidAmount: 0,
        status: 'UNPAID',
      },
    });
    console.log(`✔ Installment #1 schedule row created.`);

    // 5. Derive Balances before payment
    const initialBalances = await PaymentEngineService.deriveBalances(loanId);
    console.log(`- Initial outstanding principal: ${initialBalances.outstandingPrincipal} (Expected: 10000)`);
    assert(initialBalances.outstandingPrincipal === 10000.0, 'Outstanding principal should start at 10000');

    // 6. Process Payment of EMI (amount = 888.49)
    console.log('Processing payment...');
    const payment = await PaymentEngineService.processPayment({
      loanId,
      paymentTypeCode: 'EMI',
      amount: 888.49,
      referenceNumber: 'REF-TEST-999',
      notes: 'Automated integration test payment',
      createdBy: 'TEST_SUITE',
    });

    console.log(`✔ Payment processed. Payment ID: ${payment.id}`);
    console.log(`- Allocated Principal: ${payment.principalPortion}`);
    console.log(`- Allocated Interest: ${payment.interestPortion}`);
    console.log(`- Remaining Principal Balance: ${payment.remainingBalance}`);

    // 7. Assertions
    assert(Math.abs(payment.amount - 888.49) < 0.01, 'Payment amount should match input');
    assert(Math.abs(payment.principalPortion - 788.49) < 0.01, 'Allocated principal should be 788.49');
    assert(Math.abs(payment.interestPortion - 100.0) < 0.01, 'Allocated interest should be 100.0');
    assert(Math.abs(payment.remainingBalance - 9211.51) < 0.01, 'Remaining balance should be 9211.51 (10000 - 788.49)');

    // Verify EMI Schedule row was updated
    const updatedSchedule = await prisma.emiSchedule.findUnique({
      where: { id: schedule.id },
    });
    assert(!!updatedSchedule, 'Schedule should exist');
    assert(updatedSchedule!.status === 'PAID', 'Schedule installment status should be PAID');
    assert(Math.abs(updatedSchedule!.paidAmount - 888.49) < 0.01, 'Schedule paidAmount should be 888.49');

    // Verify Loan Cache was updated
    const updatedLoan = await prisma.loan.findUnique({
      where: { id: loanId },
    });
    assert(!!updatedLoan, 'Loan should exist');
    assert(Math.abs(updatedLoan!.outstandingPrincipal - 9211.51) < 0.01, 'Loan outstandingPrincipal cache should be updated to 9211.51');

    console.log('✔ All Payment assertions passed!');

  } finally {
    // 8. Cleanup Database
    console.log('Starting cleanup...');
    if (loanId !== null) {
      // First find all transactions referencing the payments, etc.
      // Clean up in reverse dependencies order
      await prisma.payment.deleteMany({ where: { loanId } });
      await prisma.emiSchedule.deleteMany({ where: { loanId } });
      await prisma.loanTimeline.deleteMany({ where: { loanId } });
      await prisma.loanTransaction.deleteMany({ where: { loanId } });
      await prisma.loan.delete({ where: { id: loanId } });
      console.log('✔ Cleaned up payments, schedules, and loan records.');
    }
    if (customerId !== null) {
      await prisma.customer.delete({ where: { id: customerId } });
      console.log('✔ Cleaned up customer records.');
    }
    await prisma.$disconnect();
    console.log('✔ Database connection closed.');
  }

  console.log('\n--- All Payment Engine Integration Tests Passed! ---');
}

runTests().catch((err) => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
