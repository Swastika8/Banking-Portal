import { Router } from 'express';
import { CollateralController } from '../controllers/collateralController';
import { authMiddleware, requirePermission } from '../middleware/auth';

const router = Router();

router.use(authMiddleware);

// By collateral ID
router.post('/:collateralId/images', requirePermission('Loan Update'), CollateralController.uploadImage);
router.get('/:collateralId/images', requirePermission('Loan View'), CollateralController.listImages);
router.delete('/images/:imageId', requirePermission('Loan Update'), CollateralController.deleteImage);

// By loan ID (convenience endpoint for workspace)
router.get('/by-loan/:loanId', requirePermission('Loan View'), CollateralController.getImagesByLoan);

export default router;
