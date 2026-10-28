const mongoose = require('mongoose');

async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.log('[Database] No MONGODB_URI provided. Running on persistent local storage engine.');
    return false;
  }

  try {
    mongoose.set('strictQuery', false);
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 2500
    });
    console.log('[Database] Connected to MongoDB successfully.');
    return true;
  } catch (err) {
    console.warn(`[Database] MongoDB connection failed (${err.message}). Using persistent local storage engine.`);
    return false;
  }
}

module.exports = connectDB;
