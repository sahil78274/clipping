// server/services/creditService.js
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const CreditPackage = require('../models/CreditPackage');
const { CREDIT_COST_PER_CLIP } = require('../config/packages');

/**
 * Calculates estimated credit cost for a project
 * @param {number} clipsCount - number of requested clips
 * @returns {number}
 */
const calculateCost = (clipsCount = 5) => {
  const count = Math.max(1, parseInt(clipsCount, 10) || 5);
  return count * CREDIT_COST_PER_CLIP;
};

/**
 * Reserves credits from user balance before starting project processing.
 * Atomic check-and-decrement ensures balance never drops below zero.
 */
const reserveCredits = async (userId, amount, projectId, description = 'Credit reservation for clip generation') => {
  if (amount <= 0) return { success: true, balance: 0 };

  // Atomically deduct credits only if user has >= amount
  const user = await User.findOneAndUpdate(
    { _id: userId, credits: { $gte: amount } },
    { $inc: { credits: -amount } },
    { new: true }
  );

  if (!user) {
    const currentUser = await User.findById(userId);
    const available = currentUser ? currentUser.credits : 0;
    throw new Error(`Insufficient credits. Required: ${amount}, Available: ${available}`);
  }

  // Record transaction for reservation
  await Transaction.create({
    userId,
    type: 'reserve',
    amount: -amount,
    balanceAfter: user.credits,
    description: `${description} (${amount} credits reserved)`,
    status: 'reserved',
    projectId,
  });

  return { success: true, balance: user.credits, reservedAmount: amount };
};

/**
 * Finalizes credit deduction after successful rendering.
 */
const finalizeCredits = async (userId, amount, projectId, actualClipsCount = 0) => {
  const user = await User.findById(userId);
  if (!user) return;

  // Update existing reserve transaction or record deduct
  await Transaction.create({
    userId,
    type: 'deduct',
    amount: -amount,
    balanceAfter: user.credits,
    description: `Successfully processed ${actualClipsCount} clips (${amount} credits finalized)`,
    status: 'completed',
    projectId,
  });

  return { success: true, balance: user.credits };
};

/**
 * Refunds reserved credits back to user if processing failed or was cancelled.
 */
const refundCredits = async (userId, amount, projectId, reason = 'Processing failed') => {
  if (amount <= 0) return { success: true };

  const user = await User.findByIdAndUpdate(
    userId,
    { $inc: { credits: amount } },
    { new: true }
  );

  if (!user) return { success: false };

  await Transaction.create({
    userId,
    type: 'refund',
    amount: amount,
    balanceAfter: user.credits,
    description: `Refund: ${reason} (+${amount} credits returned)`,
    status: 'refunded',
    projectId,
  });

  return { success: true, balance: user.credits };
};

/**
 * Purchases a credit package for the user
 */
const purchaseCredits = async (userId, packageId) => {
  const pkg = await CreditPackage.findOne({ id: packageId, isActive: true });
  if (!pkg) {
    throw new Error('Credit package not found or inactive');
  }

  const user = await User.findByIdAndUpdate(
    userId,
    { $inc: { credits: pkg.credits } },
    { new: true }
  );

  if (!user) throw new Error('User not found');

  const tx = await Transaction.create({
    userId,
    type: 'purchase',
    amount: pkg.credits,
    balanceAfter: user.credits,
    description: `Purchased ${pkg.name} Package (+${pkg.credits} credits for ₹${pkg.price})`,
    status: 'completed',
  });

  return {
    success: true,
    user,
    package: pkg,
    transaction: tx,
  };
};

/**
 * Admin adjustments (adds or removes credits)
 */
const adminAdjustCredits = async (adminUser, targetUserId, amount, reason = 'Admin adjustment') => {
  const targetUser = await User.findById(targetUserId);
  if (!targetUser) throw new Error('Target user not found');

  const newBalance = targetUser.credits + amount;
  if (newBalance < 0) {
    throw new Error(`Cannot deduct ${Math.abs(amount)} credits: user only has ${targetUser.credits}`);
  }

  targetUser.credits = newBalance;
  await targetUser.save();

  const tx = await Transaction.create({
    userId: targetUserId,
    type: 'admin_adjustment',
    amount,
    balanceAfter: targetUser.credits,
    description: `${reason} (by ${adminUser.name || 'Admin'})`,
    status: 'completed',
  });

  return {
    success: true,
    user: targetUser,
    transaction: tx,
  };
};

module.exports = {
  calculateCost,
  reserveCredits,
  finalizeCredits,
  refundCredits,
  purchaseCredits,
  adminAdjustCredits,
};
