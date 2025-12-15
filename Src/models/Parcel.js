const mongoose = require('mongoose');

const addressSchema = new mongoose.Schema({
  text: String,
  lat: Number,
  lng: Number
}, { _id: false });

const coordSchema = new mongoose.Schema({
  lat: Number,
  lng: Number,
  ts: { type: Date, default: Date.now }
}, { _id: false });

const parcelSchema = new mongoose.Schema({
  bookingId: { type: String, required: true, unique: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  pickupAddress: addressSchema,
  deliveryAddress: addressSchema,
  size: String,
  weight: Number,
  paymentType: { type: String, enum: ['COD','Prepaid'], default: 'Prepaid' },
  codAmount: { type: Number, default: 0 },
  status: { type: String, enum: ['Booked','Assigned','PickedUp','InTransit','Delivered','Failed'], default: 'Booked' },
  agentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  trackingCoordinates: [coordSchema]
}, { timestamps: true });

module.exports = mongoose.model('Parcel', parcelSchema);
