import { Router } from 'express';
import { PaymentController } from '../controllers/paymentController';
import { authMiddleware, requirePermission } from '../middleware/auth';

const router = Router();

// Apply auth middleware globally to this router
router.use(authMiddleware);

router.post('/process', requirePermission('Payment Create'), PaymentController.process);
router.get('/balances/:loanId', requirePermission('Payment View'), PaymentController.getBalances);
router.get('/ledger/:loanId', requirePermission('Payment View'), PaymentController.getLedger);
router.get('/receipt/:paymentId', requirePermission('Payment View'), PaymentController.downloadReceipt);

export default router;
