

import express from 'express';
import AdminController from '../controllers/adminController.js';
import { protect, authorize } from '../middleware/auth.js';
import { batchOperationValidation, exportValidation, validate } from '../middleware/validator.js';

const router = express.Router();

// All admin routes require authentication and admin role
router.use(protect);
router.use(authorize('admin'));

// Dashboard & Analytics
router.get('/dashboard', AdminController.getDashboard);
router.get('/analytics', AdminController.getAnalytics);

// User Management
router.get('/users', AdminController.getUsers);
router.put('/users/:id', AdminController.updateUser);
router.delete('/users/:id', AdminController.deleteUser);

// Submission Management
router.get('/submissions', AdminController.getSubmissions);
router.put('/submissions/:id/override', AdminController.overrideSubmission);
router.delete('/submissions/:id', AdminController.deleteSubmission);

// Export & Batch Operations
router.get('/submissions/export', exportValidation, validate, AdminController.exportSubmissions);
router.get('/submissions/export/preview', AdminController.getExportPreview);
router.post('/submissions/batch', batchOperationValidation, validate, AdminController.batchUpdateSubmissions);

export default router;
