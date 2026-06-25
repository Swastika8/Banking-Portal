import { Router } from 'express';
import { SettingController } from '../controllers/settingController';
import { authMiddleware, requirePermission } from '../middleware/auth';

const router = Router();

// Apply auth middleware globally to this router
router.use(authMiddleware);

// Settings
router.get('/system', requirePermission('Settings View'), SettingController.getSettings);
router.put('/system', requirePermission('Settings View'), SettingController.updateSettings);

// Masters Lookup (needed for dropdowns across many screens, open to authenticated users)
router.get('/masters', SettingController.getMasters);

// Manage Custom Loan Types (Dynamic Masters)
router.post('/loan-type', requirePermission('Settings View'), SettingController.createLoanType);
router.put('/loan-type/:id', requirePermission('Settings View'), SettingController.updateLoanType);
router.delete('/loan-type/:id', requirePermission('Settings View'), SettingController.deleteLoanType);

// Manage Role Permissions
router.put('/role-permissions', requirePermission('Settings View'), SettingController.updateRolePermissions);

// Audit Logs
router.get('/audit-logs', requirePermission('Settings View'), SettingController.getAuditLogs);
router.get('/deleted-records', requirePermission('Settings View'), SettingController.getDeletedRecords);
router.delete('/deleted-records/permanent', requirePermission('Settings View'), SettingController.permanentDeleteRecord);
router.post('/restore-deleted', requirePermission('Settings View'), SettingController.restoreDeletedRecord);

export default router;
