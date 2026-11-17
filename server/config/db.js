// server/config/db.js
const mongoose = require('mongoose');
const { DEFAULT_PACKAGES } = require('./packages');
const CreditPackage = require('../models/CreditPackage');
const User = require('../models/User');

let twinServerInstance = null;

const connectDB = async () => {
  let uri = process.env.MONGODB_URI?.trim();

  if (uri) {
    try {
      console.log('Connecting to MongoDB via MONGODB_URI...');
      await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 5000,
      });
      console.log('Connected to external MongoDB successfully.');
      await seedInitialData();
      return;
    } catch (err) {
      console.warn('Failed to connect to MONGODB_URI:', err.message);
      console.log('Falling back to local embedded MongoDB engine...');
    }
  }

  // Fallback to embedded MongoDB Twin for zero-config local testing
  try {
    const { createMongodbTwinServer } = require('@volter/twin-mongodb');
    console.log('Starting local embedded MongoDB engine...');
    twinServerInstance = await createMongodbTwinServer({ port: 27017 }).catch(async () => {
      // If 27017 is busy, let it pick a free port
      return await createMongodbTwinServer({ port: 0 });
    });

    uri = `${twinServerInstance.url}/clipping_db`;
    console.log(`Local MongoDB Twin ready at: ${twinServerInstance.url}`);
    await mongoose.connect(uri);
    console.log('Connected to local MongoDB successfully.');
    await seedInitialData();
  } catch (err) {
    console.error('Critical database connection error:', err.message);
    throw err;
  }
};

const seedInitialData = async () => {
  try {
    // Seed default credit packages if empty
    const count = await CreditPackage.countDocuments();
    if (count === 0) {
      console.log('Seeding default credit packages...');
      await CreditPackage.insertMany(DEFAULT_PACKAGES);
    }

    // Seed default admin account if none exists
    const adminExists = await User.findOne({ role: 'admin' });
    if (!adminExists) {
      console.log('Seeding default Administrator account (admin@clipping.ai / Admin@12345)...');
      await User.create({
        name: 'CLIPPING Admin',
        email: 'admin@clipping.ai',
        password: 'Admin@12345',
        role: 'admin',
        credits: 1000
      });
      console.log('Admin account created with 1,000 initial credits.');
    }
  } catch (err) {
    console.warn('Warning during seedInitialData:', err.message);
  }
};

module.exports = {
  connectDB,
  getTwinServer: () => twinServerInstance,
};
