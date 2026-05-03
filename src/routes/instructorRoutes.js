const express = require('express');
const User = require('../models/User');
const { protect, adminOnly } = require('../middleware/auth');

const router = express.Router();

router.get('/', protect, async (req, res) => {
  const instructors = await User.find({ role: 'instructor' }).select('-password').sort({ createdAt: -1 });
  res.json(instructors);
});

router.post('/', protect, adminOnly, async (req, res) => {
  const { name, email, password, phone, postalCodes, active } = req.body;

  const exists = await User.findOne({ email: String(email || '').toLowerCase() });
  if (exists) return res.status(409).json({ message: 'Email already exists' });

  const instructor = await User.create({
    name,
    email,
    password: password || 'Instructor123',
    role: 'instructor',
    phone,
    postalCodes: Array.isArray(postalCodes)
      ? postalCodes.map((x) => String(x).trim().toUpperCase()).filter(Boolean)
      : String(postalCodes || '').split(',').map((x) => x.trim().toUpperCase()).filter(Boolean),
    active: active !== false
  });

  res.status(201).json(instructor.safe());
});

router.put('/:id', protect, adminOnly, async (req, res) => {
  const payload = { ...req.body };
  delete payload.password;
  delete payload.role;

  if (payload.postalCodes && !Array.isArray(payload.postalCodes)) {
    payload.postalCodes = String(payload.postalCodes).split(',').map((x) => x.trim().toUpperCase()).filter(Boolean);
  }

  const instructor = await User.findOneAndUpdate(
    { _id: req.params.id, role: 'instructor' },
    payload,
    { new: true, runValidators: true }
  ).select('-password');

  if (!instructor) return res.status(404).json({ message: 'Instructor not found' });
  res.json(instructor);
});

module.exports = router;
