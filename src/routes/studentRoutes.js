const express = require('express');
const Student = require('../models/Student');
const User = require('../models/User');
const { protect } = require('../middleware/auth');
const {
  sendStudentCreatedByInstructorEmail,
  sendStudentWelcomeEmail,
  runEmailJob
} = require('../utils/email');

const router = express.Router();

const autoAssignInstructor = async (postalCode) => {
  if (!postalCode) return null;
  return User.findOne({
    role: 'instructor',
    active: true,
    postalCodes: { $in: [postalCode.trim().toUpperCase(), postalCode.trim()] }
  });
};

const canManageStudent = (user, student) => {
  if (user.role === 'admin') return true;
  return String(student.assignedInstructor || '') === String(user._id);
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

router.post('/', protect, async (req, res) => {
  if (!['admin', 'instructor'].includes(req.user.role)) {
    return res.status(403).json({ message: 'Not allowed' });
  }

  const payload = { ...req.body };
  payload.postalCode = String(payload.postalCode || '').trim().toUpperCase();

  if (req.user.role === 'instructor') {
    payload.assignedInstructor = req.user._id;
    payload.status = payload.status || 'assigned';
  } else if (!payload.assignedInstructor) {
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

  runEmailJob('student welcome email', () => sendStudentWelcomeEmail({ student: populated }));

  if (req.user.role === 'instructor') {
    runEmailJob('admin new student email', () => sendStudentCreatedByInstructorEmail({
      User,
      student: populated,
      instructor: req.user
    }));
  }
});

router.put('/:id', protect, async (req, res) => {
  if (!['admin', 'instructor'].includes(req.user.role)) {
    return res.status(403).json({ message: 'Not allowed' });
  }

  const student = await Student.findById(req.params.id);
  if (!student) return res.status(404).json({ message: 'Student not found' });

  if (!canManageStudent(req.user, student)) {
    return res.status(403).json({ message: 'Not allowed' });
  }

  const payload = { ...req.body };
  if (payload.postalCode) payload.postalCode = String(payload.postalCode).trim().toUpperCase();

  if (req.user.role === 'instructor') {
    delete payload.assignedInstructor;
  } else if (payload.assignedInstructor) {
    payload.status = payload.status || 'assigned';
  }

  Object.assign(student, payload);
  await student.save();

  const populated = await Student.findById(student._id).populate('assignedInstructor', 'name email phone postalCodes');
  res.json(populated);
});

router.delete('/:id', protect, async (req, res) => {
  if (!['admin', 'instructor'].includes(req.user.role)) {
    return res.status(403).json({ message: 'Not allowed' });
  }

  const student = await Student.findById(req.params.id);
  if (!student) return res.status(404).json({ message: 'Student not found' });

  if (!canManageStudent(req.user, student)) {
    return res.status(403).json({ message: 'Not allowed' });
  }

  await student.deleteOne();
  res.json({ message: 'Student deleted' });
});

module.exports = router;
