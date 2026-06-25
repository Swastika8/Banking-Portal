import { Router } from 'express';
import { FormulaController } from '../controllers/formulaController';
import { authMiddleware, requirePermission } from '../middleware/auth';

const router = Router();

router.use(authMiddleware);

// Read — Settings View (Admin + Manager)
router.get('/', requirePermission('Settings View'), FormulaController.list);

// Write — Settings View (Admin only in practice via RBAC configuration)
router.post('/', requirePermission('Settings View'), FormulaController.create);
router.put('/:id', requirePermission('Settings View'), FormulaController.update);
router.delete('/:id', requirePermission('Settings View'), FormulaController.softDelete);

// Formula Sandbox (test before activating)
router.post('/test', requirePermission('Settings View'), FormulaController.testFormula);

// Activate / Deactivate
router.post('/:id/activate', requirePermission('Settings View'), FormulaController.activate);
router.post('/:id/deactivate', requirePermission('Settings View'), FormulaController.deactivate);

export default router;
