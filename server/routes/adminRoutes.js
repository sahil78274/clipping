// server/routes/adminRoutes.js
const express = require('express');
const router = express.Router();
const {
  getDashboardStats,
  getUsers,
  updateUserCredits,
  updateUserRole,
  getAllProjects,
  getAllTransactions,
  getSystemStatus,
} = require('../controllers/adminController');
const { verifyToken, requireAdmin } = require('../middleware/auth');

router.use(verifyToken, requireAdmin);

router.get('/dashboard', getDashboardStats);
router.get('/users', getUsers);
router.patch('/users/:id/credits', updateUserCredits);
router.patch('/users/:id/role', updateUserRole);
router.get('/projects', getAllProjects);
router.get('/transactions', getAllTransactions);
router.get('/system-status', getSystemStatus);

module.exports = router;
