import { Router } from 'express';
import { ReportController } from '../controllers/reportController';
import { authMiddleware, requirePermission } from '../middleware/auth';

const router = Router();

// Apply auth middleware globally to this router
router.use(authMiddleware);

router.get('/loans', requirePermission('Report View'), ReportController.getReportData);
router.get('/export-pdf', requirePermission('Report View'), ReportController.exportPdf);

// Advanced reporting routes
router.get('/advanced', requirePermission('Report View'), ReportController.getAdvancedReport);
router.get('/advanced/export', requirePermission('Report View'), ReportController.exportAdvanced);

export default router;
