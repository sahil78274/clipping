// server/routes/creditRoutes.js
const express = require('express');
const router = express.Router();
const {
  getCredits,
  getPackages,
  buyCredits,
  getTransactions,
} = require('../controllers/creditController');
const { verifyToken } = require('../middleware/auth');

router.get('/packages', getPackages);

router.use(verifyToken);

router.get('/', getCredits);
router.post('/purchase', buyCredits);
router.get('/transactions', getTransactions);

module.exports = router;
