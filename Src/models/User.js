const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['admin','agent','customer'], default: 'customer' },
  phone: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
