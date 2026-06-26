import { Router } from 'express';
import { LoanController } from '../controllers/loanController';
import { authMiddleware, requirePermission } from '../middleware/auth';

const router = Router();

// Apply auth middleware globally to this router
router.use(authMiddleware);

// Standard loan operations
router.post('/create', requirePermission('Loan Create'), LoanController.create);
router.post('/import', requirePermission('Loan Create'), LoanController.import);
router.put('/:id', requirePermission('Loan Update'), LoanController.update);
router.post('/approve/:id', requirePermission('Loan Approve'), LoanController.approve);
router.post('/reject/:id', requirePermission('Loan Reject'), LoanController.reject);
router.get('/schedule/:id', requirePermission('Loan View'), LoanController.getSchedule);
router.get('/timeline/:id', requirePermission('Loan View'), LoanController.getTimeline);

// Soft-delete and restore (Admin only via Loan Delete permission)
router.delete('/:id', requirePermission('Loan Delete'), LoanController.softDelete);
router.post('/restore/:id', requirePermission('Loan Delete'), LoanController.restore);
router.get('/deleted/list', requirePermission('Loan Delete'), LoanController.listDeleted);

export default router;
