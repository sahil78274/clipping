// server/controllers/adminController.js
const User = require('../models/User');
const Project = require('../models/Project');
const Clip = require('../models/Clip');
const Transaction = require('../models/Transaction');
const CreditPackage = require('../models/CreditPackage');
const { adminAdjustCredits } = require('../services/creditService');

// GET /api/admin/dashboard - High-level metrics
const getDashboardStats = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalProjects = await Project.countDocuments();
    const totalClips = await Clip.countDocuments();
    const failedProjects = await Project.countDocuments({ status: 'failed' });

    // Calculate total credits issued and consumed from transactions
    const creditAggregations = await Transaction.aggregate([
      {
        $group: {
          _id: '$type',
          totalAmount: { $sum: '$amount' },
        },
      },
    ]);

    let creditsIssued = 0;
    let creditsConsumed = 0;

    for (const item of creditAggregations) {
      if (item._id === 'signup_bonus' || item._id === 'purchase' || (item._id === 'admin_adjustment' && item.totalAmount > 0)) {
        creditsIssued += Math.abs(item.totalAmount);
      } else if (item._id === 'deduct' || (item._id === 'admin_adjustment' && item.totalAmount < 0)) {
        creditsConsumed += Math.abs(item.totalAmount);
      }
    }

    const recentProjects = await Project.find()
      .populate('userId', 'name email')
      .sort({ createdAt: -1 })
      .limit(6);

    const recentUsers = await User.find()
      .sort({ createdAt: -1 })
      .limit(6)
      .select('-password');

    return res.status(200).json({
      success: true,
      stats: {
        totalUsers,
        totalProjects,
        totalClips,
        creditsIssued,
        creditsConsumed,
        failedProjects,
      },
      recentProjects,
      recentUsers,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/admin/users - List all users
const getUsers = async (req, res) => {
  try {
    const search = (req.query.search || '').trim();
    const query = {};

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    const users = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 });

    // Attach project count to each user
    const userIds = users.map((u) => u._id);
    const projects = await Project.find({ userId: { $in: userIds } }, 'userId').lean();
    const userProjectCounts = {};
    for (const p of projects) {
      userProjectCounts[p.userId] = (userProjectCounts[p.userId] || 0) + 1;
    }

    const enriched = users.map((u) => ({
      ...u.toObject(),
      projectsCount: userProjectCounts[u._id] || 0,
    }));

    return res.status(200).json({
      success: true,
      users: enriched,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// PATCH /api/admin/users/:id/credits - Add or deduct credits
const updateUserCredits = async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, reason } = req.body;

    const parsedAmount = parseInt(amount, 10);
    if (isNaN(parsedAmount) || parsedAmount === 0) {
      return res.status(400).json({
        success: false,
        message: 'A non-zero credit amount is required (positive to add, negative to deduct).',
      });
    }

    const result = await adminAdjustCredits(
      req.user,
      id,
      parsedAmount,
      reason || (parsedAmount > 0 ? 'Admin added credits' : 'Admin deducted credits')
    );

    return res.status(200).json({
      success: true,
      message: `User credits adjusted by ${parsedAmount > 0 ? '+' + parsedAmount : parsedAmount}. New balance: ${result.user.credits}`,
      user: result.user,
      transaction: result.transaction,
    });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

// PATCH /api/admin/users/:id/role - Update user role
const updateUserRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!['user', 'admin'].includes(role)) {
      return res.status(400).json({ success: false, message: 'Invalid role.' });
    }

    // Prevent removing own admin role
    if (id === req.user._id.toString() && role !== 'admin') {
      return res.status(400).json({ success: false, message: 'Cannot demote your own administrator account.' });
    }

    const user = await User.findByIdAndUpdate(id, { role }, { new: true }).select('-password');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    return res.status(200).json({
      success: true,
      message: `User role updated to ${role}.`,
      user,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/admin/projects - List all projects
const getAllProjects = async (req, res) => {
  try {
    const projects = await Project.find()
      .populate('userId', 'name email')
      .sort({ createdAt: -1 });

    const projectIds = projects.map((p) => p._id);
    const clips = await Clip.find({ projectId: { $in: projectIds } }, 'projectId').lean();
    const clipCounts = {};
    for (const c of clips) {
      clipCounts[c.projectId] = (clipCounts[c.projectId] || 0) + 1;
    }

    const enriched = projects.map((p) => ({
      ...p.toObject(),
      clipsCount: clipCounts[p._id] || 0,
    }));

    return res.status(200).json({
      success: true,
      projects: enriched,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/admin/transactions - List all transactions across users
const getAllTransactions = async (req, res) => {
  try {
    const transactions = await Transaction.find()
      .populate('userId', 'name email')
      .populate('projectId', 'title')
      .sort({ createdAt: -1 })
      .limit(100);

    return res.status(200).json({
      success: true,
      transactions,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/admin/system-status - Health and config check
const getSystemStatus = async (req, res) => {
  try {
    const geminiKeyConfigured = !!process.env.GEMINI_API_KEY?.trim();
    const geminiModel = process.env.GEMINI_MODEL?.trim() || 'gemini-1.5-flash';

    return res.status(200).json({
      success: true,
      system: {
        serverUptime: process.uptime(),
        nodeVersion: process.version,
        gemini: {
          isConfigured: geminiKeyConfigured,
          model: geminiModel,
          status: geminiKeyConfigured ? 'Active' : 'Fallback Pacing Engine Active (API Key Not Set)',
        },
        ffmpeg: {
          status: 'Active',
          videoFormats: ['9:16', '16:9', '1:1'],
          subtitles: 'libfreetype burn-in enabled',
        },
        database: {
          status: 'Connected',
        },
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  getDashboardStats,
  getUsers,
  updateUserCredits,
  updateUserRole,
  getAllProjects,
  getAllTransactions,
  getSystemStatus,
};
