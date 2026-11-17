// server/controllers/creditController.js
const CreditPackage = require('../models/CreditPackage');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const { purchaseCredits } = require('../services/creditService');
const { DEFAULT_PACKAGES } = require('../config/packages');

// GET /api/credits - Get user balance & stats
const getCredits = async (req, res) => {
  try {
    const user = await User.findById(req.user._id, 'credits name email role');
    const totalTransactions = await Transaction.countDocuments({ userId: req.user._id });
    const recentTransactions = await Transaction.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(5);

    return res.status(200).json({
      success: true,
      credits: user.credits,
      user,
      totalTransactions,
      recentTransactions,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/credits/packages - Get all credit packages
const getPackages = async (req, res) => {
  try {
    let packages = await CreditPackage.find({ isActive: true }).sort({ price: 1 });
    if (!packages || packages.length === 0) {
      packages = DEFAULT_PACKAGES;
    }
    return res.status(200).json({
      success: true,
      packages,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/credits/purchase - Purchase a credit package
const buyCredits = async (req, res) => {
  try {
    const { packageId } = req.body;
    if (!packageId) {
      return res.status(400).json({ success: false, message: 'packageId is required.' });
    }

    const result = await purchaseCredits(req.user._id, packageId);

    return res.status(200).json({
      success: true,
      message: `Successfully added ${result.package.credits} credits to your account!`,
      credits: result.user.credits,
      transaction: result.transaction,
    });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

// GET /api/credits/transactions - Get transaction history
const getTransactions = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const skip = (page - 1) * limit;

    const total = await Transaction.countDocuments({ userId: req.user._id });
    const transactions = await Transaction.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('projectId', 'title');

    return res.status(200).json({
      success: true,
      transactions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  getCredits,
  getPackages,
  buyCredits,
  getTransactions,
};
