"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const prisma = new client_1.PrismaClient();
async function main() {
    console.log('Seeding database...');
    // 1. Seed Roles
    const roles = [
        { name: 'Admin', description: 'System Administrator with full access' },
        { name: 'Manager', description: 'Operations Manager with approval authority' },
        { name: 'Staff', description: 'Loan Operations Staff' },
        { name: 'Viewer', description: 'ReadOnly Viewer for reports and auditing' },
    ];
    const dbRoles = {};
    for (const role of roles) {
        dbRoles[role.name] = await prisma.role.upsert({
            where: { name: role.name },
            update: {},
            create: role,
        });
    }
    // 2. Seed Permissions
    const permissions = [
        { name: 'Customer View', description: 'View customer records and profiles' },
        { name: 'Customer Create', description: 'Create new customer profiles' },
        { name: 'Customer Update', description: 'Modify customer profiles' },
        { name: 'Customer Delete', description: 'Soft delete customer profiles' },
        { name: 'Loan View', description: 'View loan accounts' },
        { name: 'Loan Create', description: 'Apply / create new loan accounts' },
        { name: 'Loan Update', description: 'Edit loan account details' },
        { name: 'Loan Approve', description: 'Approve pending loan accounts' },
        { name: 'Loan Reject', description: 'Reject pending loan accounts' },
        { name: 'Payment View', description: 'View payment transactions' },
        { name: 'Payment Create', description: 'Process payment collections' },
        { name: 'Report View', description: 'Access reporting panel' },
        { name: 'Settings View', description: 'Manage masters and global system parameters' },
    ];
    const dbPermissions = {};
    for (const perm of permissions) {
        dbPermissions[perm.name] = await prisma.permission.upsert({
            where: { name: perm.name },
            update: {},
            create: perm,
        });
    }
    // 3. Associate Role Permissions (RBAC Master seed)
    // Admin: All permissions
    await prisma.rolePermission.deleteMany({});
    for (const permKey of Object.keys(dbPermissions)) {
        await prisma.rolePermission.create({
            data: {
                roleId: dbRoles['Admin'].id,
                permissionId: dbPermissions[permKey].id,
            },
        });
    }
    // Manager: Customer (View, Create, Update), Loan (All except delete), Payment (All), Report (View), Settings (View)
    const managerPerms = [
        'Customer View', 'Customer Create', 'Customer Update',
        'Loan View', 'Loan Create', 'Loan Update', 'Loan Approve', 'Loan Reject',
        'Payment View', 'Payment Create', 'Report View', 'Settings View'
    ];
    for (const name of managerPerms) {
        await prisma.rolePermission.create({
            data: {
                roleId: dbRoles['Manager'].id,
                permissionId: dbPermissions[name].id,
            },
        });
    }
    // Staff: Customer (View, Create, Update), Loan (View, Create), Payment (View, Create), Report (View)
    const staffPerms = [
        'Customer View', 'Customer Create', 'Customer Update',
        'Loan View', 'Loan Create', 'Payment View', 'Payment Create', 'Report View'
    ];
    for (const name of staffPerms) {
        await prisma.rolePermission.create({
            data: {
                roleId: dbRoles['Staff'].id,
                permissionId: dbPermissions[name].id,
            },
        });
    }
    // Viewer: ReadOnly Views
    const viewerPerms = ['Customer View', 'Loan View', 'Payment View', 'Report View'];
    for (const name of viewerPerms) {
        await prisma.rolePermission.create({
            data: {
                roleId: dbRoles['Viewer'].id,
                permissionId: dbPermissions[name].id,
            },
        });
    }
    // 4. Seed Settings
    const settings = [
        { key: 'enable_registration', value: 'true', type: 'BOOLEAN', description: 'Enable signup on home portal' },
        { key: 'enable_forgot_password', value: 'true', type: 'BOOLEAN', description: 'Enable password recovery feature' },
        { key: 'enable_smtp', value: 'false', type: 'BOOLEAN', description: 'Enable SMTP operations for nodemailer' },
        { key: 'enable_notifications', value: 'true', type: 'BOOLEAN', description: 'Enable system notifications logging' },
        { key: 'enable_loan_applications', value: 'true', type: 'BOOLEAN', description: 'Allow users to submit new loan files' },
    ];
    for (const set of settings) {
        await prisma.systemSetting.upsert({
            where: { key: set.key },
            update: {},
            create: set,
        });
    }
    // 5. Seed Masters
    // Loan Type Master
    const loanTypes = [
        { name: 'Gold Loan', description: 'Collateralized against physical gold assets' },
        { name: 'Silver Loan', description: 'Collateralized against physical silver assets' },
        { name: 'Vehicle Loan', description: 'Automobile financing backed by vehicle title lien' },
        { name: 'Property Loan', description: 'Real estate backed mortgage loan' },
        { name: 'Business Loan', description: 'Corporate entity working capital financing' },
    ];
    const dbLoanTypes = {};
    for (const type of loanTypes) {
        dbLoanTypes[type.name] = await prisma.loanTypeMaster.upsert({
            where: { name: type.name },
            update: {},
            create: type,
        });
    }
    // Interest Type Master
    const interestTypes = [
        { name: 'Simple Interest', code: 'SIMPLE', description: 'Flat interest calculation based on original principal' },
        { name: 'Compound Interest', code: 'COMPOUND', description: 'Interest calculated on the reducing principal balance' },
    ];
    const dbInterestTypes = {};
    for (const type of interestTypes) {
        dbInterestTypes[type.code] = await prisma.interestTypeMaster.upsert({
            where: { code: type.code },
            update: {},
            create: type,
        });
    }
    // Loan Status Master
    const loanStatuses = [
        { name: 'Pending Approval', code: 'PENDING', description: 'Underwriting evaluation phase' },
        { name: 'Active Approved', code: 'APPROVED', description: 'Funds disbursed and collecting payments' },
        { name: 'Rejected', code: 'REJECTED', description: 'Application denied' },
        { name: 'Closed Settle', code: 'CLOSED', description: 'Balance fully satisfied and accounts audited' },
        { name: 'Overdue Delinquent', code: 'OVERDUE', description: 'Payments past maturity or grace periods' },
    ];
    const dbStatuses = {};
    for (const status of loanStatuses) {
        dbStatuses[status.code] = await prisma.loanStatusMaster.upsert({
            where: { code: status.code },
            update: {},
            create: status,
        });
    }
    // Payment Type Master
    const paymentTypes = [
        { name: 'EMI Installment', code: 'EMI', description: 'Regular scheduled amortization payment' },
        { name: 'Interest Only', code: 'INTEREST_ONLY', description: 'Servicing accrued interest charges only' },
        { name: 'Principal Only', code: 'PRINCIPAL_ONLY', description: 'Direct principal prepayment with recalculation' },
        { name: 'Foreclosure Payoff', code: 'FORECLOSURE', description: 'Paying off all outstanding balances to close' },
        { name: 'Penalty Delinquency', code: 'PENALTY', description: 'Late fee or service penalty payment' },
    ];
    const dbPaymentTypes = {};
    for (const pay of paymentTypes) {
        dbPaymentTypes[pay.code] = await prisma.paymentTypeMaster.upsert({
            where: { code: pay.code },
            update: {},
            create: pay,
        });
    }
    // 6. Seed Users (Admin Account)
    const adminPasswordHash = await bcryptjs_1.default.hash('AdminPassword123!', 10);
    const adminUser = await prisma.user.upsert({
        where: { email: 'admin@lms.com' },
        update: {},
        create: {
            email: 'admin@lms.com',
            passwordHash: adminPasswordHash,
            name: 'Super Administrator',
            roleId: dbRoles['Admin'].id,
        },
    });
    // 7. Seed Customers (3-5 clients)
    const customers = [
        {
            name: 'Satvik Sinha',
            mobile: '9876543210',
            email: 'satvik@lms.com',
            address: '101 Banking Plaza, Tech District',
            dob: new Date('1992-08-15'),
            occupation: 'Software Business Owner',
            kycNumber: 'AADH-8877-2233',
            kycInfo: JSON.stringify({ PAN: 'BVPSS9012A', Aadhaar: '8877-2233-1100' }),
        },
        {
            name: 'Jane Doe',
            mobile: '9876543211',
            email: 'jane.doe@domain.com',
            address: '404 Green Lanes, Resi Sector',
            dob: new Date('1995-12-01'),
            occupation: 'Financial Analyst',
            kycNumber: 'AADH-5544-3322',
            kycInfo: JSON.stringify({ PAN: 'AAKPD1234F', Aadhaar: '5544-3322-9988' }),
        },
        {
            name: 'John Smith',
            mobile: '9876543212',
            email: 'john.smith@webmail.com',
            address: '88 High Street, Business Block',
            dob: new Date('1988-04-20'),
            occupation: 'General Contractor',
            kycNumber: 'AADH-1122-3344',
            kycInfo: JSON.stringify({ PAN: 'CKJPS4567M', Aadhaar: '1122-3344-5566' }),
        },
    ];
    const dbCustomers = {};
    for (const cust of customers) {
        dbCustomers[cust.name] = await prisma.customer.upsert({
            where: { mobile: cust.mobile },
            update: {},
            create: cust,
        });
    }
    // 8. Seed Loans & EMI Schedules
    // Loan 1: Satvik Sinha - Gold Loan, $10,000, 12% Compound, 12 Months, started 3 months ago (Active)
    const startDateLoan1 = new Date();
    startDateLoan1.setMonth(startDateLoan1.getMonth() - 3);
    const loan1 = await prisma.loan.create({
        data: {
            customerId: dbCustomers['Satvik Sinha'].id,
            loanTypeId: dbLoanTypes['Gold Loan'].id,
            amount: 10000.0,
            interestTypeId: dbInterestTypes['COMPOUND'].id,
            interestRate: 12.0, // 12% annual
            tenureMonths: 12,
            startDate: startDateLoan1,
            statusId: dbStatuses['APPROVED'].id,
            outstandingPrincipal: 10000.0, // Initial
            outstandingInterest: 0,
            collateral: {
                create: {
                    type: 'GOLD',
                    weight: 250.5,
                    purity: 22.0,
                    value: 15500.0,
                    description: '22 Karat Gold jewelry including necklaces and bracelets.',
                },
            },
        },
    });
    // Calculate schedule for Loan 1
    const monthlyRate = 12.0 / 100 / 12;
    const emiLoan1 = Math.round(((10000 * monthlyRate * Math.pow(1 + monthlyRate, 12)) / (Math.pow(1 + monthlyRate, 12) - 1)) * 100) / 100;
    let principalRemaining = 10000;
    for (let i = 1; i <= 12; i++) {
        const dueDate = new Date(startDateLoan1);
        dueDate.setMonth(dueDate.getMonth() + i);
        const interestAmount = Math.round(principalRemaining * monthlyRate * 100) / 100;
        let principalAmount = Math.round((emiLoan1 - interestAmount) * 100) / 100;
        if (i === 12)
            principalAmount = principalRemaining;
        const totalAmount = principalAmount + interestAmount;
        principalRemaining = Math.max(0, principalRemaining - principalAmount);
        // Seed schedule
        const isPast = i <= 2; // Assume first 2 EMIs are paid
        await prisma.emiSchedule.create({
            data: {
                loanId: loan1.id,
                installmentNumber: i,
                dueDate,
                principalAmount,
                interestAmount,
                totalAmount,
                paidAmount: isPast ? totalAmount : 0,
                status: isPast ? 'PAID' : 'UNPAID',
            },
        });
        // Add payment history for past EMIs
        if (isPast) {
            const payDate = new Date(dueDate);
            payDate.setDate(payDate.getDate() - 2); // Paid 2 days early
            await prisma.payment.create({
                data: {
                    loanId: loan1.id,
                    paymentTypeId: dbPaymentTypes['EMI'].id,
                    amount: totalAmount,
                    principalPortion: principalAmount,
                    interestPortion: interestAmount,
                    remainingBalance: Math.round(principalRemaining * 100) / 100,
                    referenceNumber: `REF-TX-${100000 + i}`,
                    notes: `Paid early - monthly installment #${i}`,
                    paymentDate: payDate,
                },
            });
            await prisma.loanTimeline.create({
                data: {
                    loanId: loan1.id,
                    action: 'PAYMENT_MADE',
                    description: `Payment of ${totalAmount} received for installment #${i}. Principal portion: ${principalAmount}, Interest: ${interestAmount}. Remaining principal: ${principalRemaining}`,
                    createdAt: payDate,
                },
            });
        }
    }
    // Update loan 1 outstanding caches based on past payments
    const totalPaidPrincipalLoan1 = emiLoan1 * 2; // Approximate
    const remainingPrincipalCached1 = 10000 - (loan1.amount - principalRemaining); // exact balance from loop
    await prisma.loan.update({
        where: { id: loan1.id },
        data: {
            outstandingPrincipal: Math.round(principalRemaining * 100) / 100,
        },
    });
    // Timeline for loan creation
    await prisma.loanTimeline.create({
        data: {
            loanId: loan1.id,
            action: 'CREATED',
            description: 'Gold Loan application created in status PENDING.',
            createdAt: startDateLoan1,
        },
    });
    await prisma.loanTimeline.create({
        data: {
            loanId: loan1.id,
            action: 'APPROVED',
            description: 'Gold Loan application approved. Funds disbursed to bank account.',
            createdAt: startDateLoan1,
        },
    });
    // Loan 2: Jane Doe - Silver Loan, $5,000, 10% Simple Interest, 6 Months, started 1 month ago (Active)
    const startDateLoan2 = new Date();
    startDateLoan2.setMonth(startDateLoan2.getMonth() - 1);
    const loan2 = await prisma.loan.create({
        data: {
            customerId: dbCustomers['Jane Doe'].id,
            loanTypeId: dbLoanTypes['Silver Loan'].id,
            amount: 5000.0,
            interestTypeId: dbInterestTypes['SIMPLE'].id,
            interestRate: 10.0,
            tenureMonths: 6,
            startDate: startDateLoan2,
            statusId: dbStatuses['APPROVED'].id,
            outstandingPrincipal: 5000.0,
            outstandingInterest: 0,
            collateral: {
                create: {
                    type: 'SILVER',
                    weight: 1200.0,
                    purity: 99.9,
                    value: 6500.0,
                    description: 'Pure sterling silver bars (1.2 kg).',
                },
            },
        },
    });
    // Schedule for Loan 2 Simple Interest
    const totalInterest2 = 5000 * 0.10 * (6 / 12);
    const totalPayable2 = 5000 + totalInterest2;
    const emiLoan2 = totalPayable2 / 6;
    const monthlyPrincipal2 = 5000 / 6;
    const monthlyInterest2 = totalInterest2 / 6;
    let remainingPrincipal2 = 5000;
    for (let i = 1; i <= 6; i++) {
        const dueDate = new Date(startDateLoan2);
        dueDate.setMonth(dueDate.getMonth() + i);
        let principalAmount = Math.round(monthlyPrincipal2 * 100) / 100;
        let interestAmount = Math.round(monthlyInterest2 * 100) / 100;
        if (i === 6) {
            principalAmount = remainingPrincipal2;
            interestAmount = totalInterest2 - (monthlyInterest2 * 5); // adjusting for rounding
        }
        const totalAmount = principalAmount + interestAmount;
        remainingPrincipal2 = Math.max(0, remainingPrincipal2 - principalAmount);
        const isPast = i <= 1; // 1 paid EMI
        await prisma.emiSchedule.create({
            data: {
                loanId: loan2.id,
                installmentNumber: i,
                dueDate,
                principalAmount,
                interestAmount,
                totalAmount,
                paidAmount: isPast ? totalAmount : 0,
                status: isPast ? 'PAID' : 'UNPAID',
            },
        });
        if (isPast) {
            const payDate = new Date(dueDate);
            await prisma.payment.create({
                data: {
                    loanId: loan2.id,
                    paymentTypeId: dbPaymentTypes['EMI'].id,
                    amount: totalAmount,
                    principalPortion: principalAmount,
                    interestPortion: interestAmount,
                    remainingBalance: Math.round(remainingPrincipal2 * 100) / 100,
                    referenceNumber: `REF-TX-200001`,
                    notes: `Paid on due date`,
                    paymentDate: payDate,
                },
            });
            await prisma.loanTimeline.create({
                data: {
                    loanId: loan2.id,
                    action: 'PAYMENT_MADE',
                    description: `Payment of ${totalAmount} processed for EMI installment #${i}.`,
                    createdAt: payDate,
                },
            });
        }
    }
    await prisma.loan.update({
        where: { id: loan2.id },
        data: {
            outstandingPrincipal: Math.round(remainingPrincipal2 * 100) / 100,
        },
    });
    // Loan 3: John Smith - Vehicle Loan, $15,000, 8.5% Compound, 24 Months, starting today (Pending)
    await prisma.loan.create({
        data: {
            customerId: dbCustomers['John Smith'].id,
            loanTypeId: dbLoanTypes['Vehicle Loan'].id,
            amount: 15000.0,
            interestTypeId: dbInterestTypes['COMPOUND'].id,
            interestRate: 8.5,
            tenureMonths: 24,
            startDate: new Date(),
            statusId: dbStatuses['PENDING'].id,
            outstandingPrincipal: 15000.0,
            outstandingInterest: 0,
            collateral: {
                create: {
                    type: 'VEHICLE',
                    value: 20000.0,
                    description: 'Used Sedan (2022 Model) in excellent condition. Title submitted.',
                },
            },
        },
    });
    // 9. Seed Notes & Documents
    await prisma.note.create({
        data: {
            customerId: dbCustomers['Satvik Sinha'].id,
            title: 'Customer Onboarding',
            content: 'Client onboarded successfully. Verified original PAN card and gold weight at the branch counter.',
        },
    });
    await prisma.document.create({
        data: {
            customerId: dbCustomers['Satvik Sinha'].id,
            name: 'PAN_Card.pdf',
            documentType: 'PAN',
            filePath: 'uploads/pan_satvik.pdf',
            fileSize: 452000,
            fileType: 'application/pdf',
        },
    });
    // 10. Audit Logs
    await prisma.auditLog.create({
        data: {
            userId: adminUser.id,
            action: 'LOGIN',
            module: 'AUTH',
            newValue: JSON.stringify({ email: 'admin@lms.com', action: 'Success' }),
            ipAddress: '127.0.0.1',
            userAgent: 'Chrome - Windows 10',
        },
    });
    await prisma.auditLog.create({
        data: {
            userId: adminUser.id,
            action: 'CREATE',
            module: 'CUSTOMER',
            newValue: JSON.stringify({ name: 'Satvik Sinha', mobile: '9876543210' }),
            ipAddress: '127.0.0.1',
            userAgent: 'Chrome - Windows 10',
        },
    });
    console.log('Database seeding completed successfully!');
}
main()
    .catch((e) => {
    console.error('Error during database seed execution:', e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
