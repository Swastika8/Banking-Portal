import { Router } from 'express';
import { CustomerController } from '../controllers/customerController';
import { authMiddleware, requirePermission } from '../middleware/auth';

const router = Router();

// Apply auth middleware globally to this router
router.use(authMiddleware);

router.get('/search', requirePermission('Customer View'), CustomerController.search);
router.get('/workspace/:id', requirePermission('Customer View'), CustomerController.getWorkspace);
router.post('/risk/recalculate/:id', requirePermission('Customer View'), CustomerController.recalculateRisk);
router.post('/create', requirePermission('Customer Create'), CustomerController.create);
router.put('/update/:id', requirePermission('Customer Update'), CustomerController.update);
router.delete('/delete/:id', requirePermission('Customer Delete'), CustomerController.delete);

// Notes API
router.post('/note/:customerId', requirePermission('Customer Update'), CustomerController.addNote);
router.delete('/note/:noteId', requirePermission('Customer Update'), CustomerController.deleteNote);

// Documents API
router.post('/document/:customerId', requirePermission('Customer Update'), CustomerController.uploadDocument);
router.delete('/document/:docId', requirePermission('Customer Update'), CustomerController.deleteDocument);

export default router;
