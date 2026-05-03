const express = require('express');
const Availability = require('../models/Availability');
const { protect } = require('../middleware/auth');
const { isValidTimeString, minutes, overlaps } = require('../utils/scheduling');

const router = express.Router();

const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

router.get('/', protect, async (req, res) => {
  const query = {};
  if (req.query.instructor) query.instructor = req.query.instructor;
  if (req.user.role === 'instructor') query.instructor = req.user._id;

  const availability = await Availability.find(query).populate('instructor', 'name email').lean();
  availability.sort((a, b) => dayOrder.indexOf(a.dayOfWeek) - dayOrder.indexOf(b.dayOfWeek) || a.startTime.localeCompare(b.startTime));
  res.json(availability);
});

router.post('/', protect, async (req, res) => {
  const payload = { ...req.body };
  if (req.user.role === 'instructor') payload.instructor = req.user._id;

  if (req.user.role !== 'admin' && String(payload.instructor) !== String(req.user._id)) {
    return res.status(403).json({ message: 'Not allowed' });
  }

  if (!payload.instructor || !payload.dayOfWeek || !payload.startTime || !payload.endTime) {
    return res.status(400).json({ message: 'Instructor, day, start time and end time are required' });
  }

  if (!isValidTimeString(payload.startTime) || !isValidTimeString(payload.endTime)) {
    return res.status(400).json({ message: 'Please provide valid start and end times' });
  }

  if (minutes(payload.startTime) >= minutes(payload.endTime)) {
    return res.status(400).json({ message: 'End time must be after start time' });
  }

  const existing = await Availability.find({ instructor: payload.instructor, dayOfWeek: payload.dayOfWeek }).lean();
  const conflict = existing.some((slot) => overlaps(payload.startTime, payload.endTime, slot.startTime, slot.endTime));
  if (conflict) return res.status(409).json({ message: 'This availability overlaps an existing slot' });

  const item = await Availability.create(payload);
  const populated = await Availability.findById(item._id).populate('instructor', 'name email').lean();
  res.status(201).json(populated);
});

router.delete('/:id', protect, async (req, res) => {
  const item = await Availability.findById(req.params.id);
  if (!item) return res.status(404).json({ message: 'Availability not found' });

  if (req.user.role !== 'admin' && String(item.instructor) !== String(req.user._id)) {
    return res.status(403).json({ message: 'Not allowed' });
  }

  await item.deleteOne();
  res.json({ message: 'Availability deleted' });
});

module.exports = router;
