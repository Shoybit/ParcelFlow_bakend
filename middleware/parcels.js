const express = require('express');
const router = express.Router();
const Parcel = require('../models/Parcel');
const User = require('../models/User');
const { authMiddleware, role } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');

// Create booking (customer)
router.post('/', authMiddleware, role(['customer']), async (req, res) => {
  try {
    const { pickupAddress, deliveryAddress, size, weight, paymentType, codAmount } = req.body;
    const bookingId = 'BKG-' + uuidv4().slice(0,8).toUpperCase();
    const parcel = await Parcel.create({
      bookingId,
      customerId: req.user._id,
      pickupAddress,
      deliveryAddress,
      size,
      weight,
      paymentType,
      codAmount
    });
    res.json(parcel);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get parcel by id (authorized: owner, agent assigned, or admin)
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const p = await Parcel.findById(req.params.id).populate('customerId', 'name email').populate('agentId', 'name email');
    if (!p) return res.status(404).json({ message: 'Parcel not found' });

    const user = req.user;
    const isOwner = p.customerId && p.customerId._id.equals(user._id);
    const isAgent = p.agentId && p.agentId._id.equals(user._id);
    if (user.role === 'admin' || isOwner || isAgent) {
      return res.json(p);
    }
    return res.status(403).json({ message: 'Forbidden' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// List parcels (admin: all, customer: own, agent: assigned)
router.get('/', authMiddleware, async (req, res) => {
  try {
    const q = {};
    if (req.user.role === 'customer') q.customerId = req.user._id;
    if (req.user.role === 'agent') q.agentId = req.user._id;
    const parcels = await Parcel.find(q).sort({ createdAt: -1 }).limit(200);
    res.json(parcels);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Admin: assign agent to parcel
router.put('/:id/assign', authMiddleware, role(['admin']), async (req, res) => {
  try {
    const { agentId } = req.body;
    const agent = await User.findById(agentId);
    if (!agent || agent.role !== 'agent') return res.status(400).json({ message: 'Invalid agent' });

    const parcel = await Parcel.findByIdAndUpdate(req.params.id, { agentId, status: 'Assigned' }, { new: true });
    if (!parcel) return res.status(404).json({ message: 'Parcel not found' });

    // emit via socket if available
    const io = req.app.get('io');
    if (io) io.to(parcel._id.toString()).emit('parcelStatusUpdated', { parcelId: parcel._id.toString(), status: parcel.status });

    res.json(parcel);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Agent: update status (PickedUp, InTransit, Delivered, Failed)
router.put('/:id/status', authMiddleware, role(['agent']), async (req, res) => {
  try {
    const { status } = req.body;
    const allowed = ['PickedUp','InTransit','Delivered','Failed'];
    if (!allowed.includes(status)) return res.status(400).json({ message: 'Invalid status' });

    const parcel = await Parcel.findById(req.params.id);
    if (!parcel) return res.status(404).json({ message: 'Parcel not found' });
    if (!parcel.agentId || parcel.agentId.toString() !== req.user._id.toString()) return res.status(403).json({ message: 'Not assigned to you' });

    parcel.status = status;
    if (status === 'PickedUp') parcel.pickedAt = new Date();
    if (status === 'Delivered') parcel.deliveredAt = new Date();
    await parcel.save();

    // socket emit
    const io = req.app.get('io');
    if (io) io.to(parcel._id.toString()).emit('parcelStatusUpdated', { parcelId: parcel._id.toString(), status });

    res.json(parcel);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Agent: push location update (also can use socket; this is REST fallback)
router.post('/:id/track', authMiddleware, role(['agent']), async (req, res) => {
  try {
    const { lat, lng } = req.body;
    if (typeof lat !== 'number' || typeof lng !== 'number') return res.status(400).json({ message: 'Invalid coords' });

    const parcel = await Parcel.findById(req.params.id);
    if (!parcel) return res.status(404).json({ message: 'Parcel not found' });
    if (!parcel.agentId || parcel.agentId.toString() !== req.user._id.toString()) return res.status(403).json({ message: 'Not assigned to you' });

    parcel.trackingCoordinates.push({ lat, lng, ts: new Date() });
    await parcel.save();

    const io = req.app.get('io');
    if (io) io.to(parcel._id.toString()).emit('parcelLocationUpdated', { parcelId: parcel._id.toString(), lat, lng, ts: new Date() });

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Admin: simple report - count by status (example)
router.get('/report/status-count', authMiddleware, role(['admin']), async (req, res) => {
  try {
    const agg = await Parcel.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } }
    ]);
    res.json(agg);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
