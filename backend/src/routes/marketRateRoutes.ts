import { Router } from 'express';
import { MarketRateController } from '../controllers/marketRateController';
import { authMiddleware, requirePermission } from '../middleware/auth';

const router = Router();

// Apply auth middleware globally
router.use(authMiddleware);

router.get('/', MarketRateController.list);
router.post('/manual', requirePermission('Settings View'), MarketRateController.updateManual);
router.post('/sync', requirePermission('Settings View'), MarketRateController.triggerSync);
router.get('/history/:asset', MarketRateController.getHistory);

// Generate realistic demo history for MANUAL source assets (Admin only)
router.post('/generate-history', requirePermission('Settings View'), MarketRateController.generateHistory);

export default router;

