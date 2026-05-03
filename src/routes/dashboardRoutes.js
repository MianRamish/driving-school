const express = require('express');
const Student = require('../models/Student');
const User = require('../models/User');
const Lesson = require('../models/Lesson');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.get('/stats', protect, async (req, res) => {
  const instructorFilter = req.user.role === 'instructor' ? { instructor: req.user._id } : {};
  const studentFilter = req.user.role === 'instructor' ? { assignedInstructor: req.user._id } : {};

  const today = new Date().toISOString().slice(0, 10);

  const [students, instructors, lessons, upcoming] = await Promise.all([
    Student.countDocuments(studentFilter),
    req.user.role === 'admin' ? User.countDocuments({ role: 'instructor' }) : Promise.resolve(0),
    Lesson.countDocuments(instructorFilter),
    Lesson.find({ ...instructorFilter, status: 'scheduled', date: { $gte: today } })
      .populate('student', 'firstName lastName phone')
      .populate('instructor', 'name')
      .sort({ date: 1, startTime: 1 })
      .limit(8)
      .lean()
  ]);

  res.json({ students, instructors, lessons, upcoming });
});

module.exports = router;
