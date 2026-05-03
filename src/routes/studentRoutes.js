const express = require('express');
const Student = require('../models/Student');
const User = require('../models/User');
const { protect, adminOnly } = require('../middleware/auth');

const router = express.Router();

const autoAssignInstructor = async (postalCode) => {
  if (!postalCode) return null;
  return User.findOne({
    role: 'instructor',
    active: true,
    postalCodes: { $in: [postalCode.trim().toUpperCase(), postalCode.trim()] }
  });
};

router.get('/', protect, async (req, res) => {
  const query = {};

  if (req.user.role === 'instructor') {
    query.assignedInstructor = req.user._id;
  }

  const students = await Student.find(query)
    .populate('assignedInstructor', 'name email phone postalCodes')
    .sort({ createdAt: -1 });

  res.json(students);
});

router.post('/', protect, adminOnly, async (req, res) => {
  const payload = { ...req.body };
  payload.postalCode = String(payload.postalCode || '').trim().toUpperCase();

  if (!payload.assignedInstructor) {
    const instructor = await autoAssignInstructor(payload.postalCode);
    if (instructor) {
      payload.assignedInstructor = instructor._id;
      payload.status = 'assigned';
    }
  } else {
    payload.status = payload.status || 'assigned';
  }

  const student = await Student.create(payload);
  const populated = await Student.findById(student._id).populate('assignedInstructor', 'name email phone postalCodes');
  res.status(201).json(populated);
});

router.put('/:id', protect, adminOnly, async (req, res) => {
  const payload = { ...req.body };
  if (payload.postalCode) payload.postalCode = String(payload.postalCode).trim().toUpperCase();
  if (payload.assignedInstructor) payload.status = payload.status || 'assigned';

  const student = await Student.findByIdAndUpdate(req.params.id, payload, { new: true, runValidators: true })
    .populate('assignedInstructor', 'name email phone postalCodes');

  if (!student) return res.status(404).json({ message: 'Student not found' });
  res.json(student);
});

router.delete('/:id', protect, adminOnly, async (req, res) => {
  const deleted = await Student.findByIdAndDelete(req.params.id);
  if (!deleted) return res.status(404).json({ message: 'Student not found' });
  res.json({ message: 'Student deleted' });
});

module.exports = router;
