const express = require('express');
const Lesson = require('../models/Lesson');
const Student = require('../models/Student');
const Availability = require('../models/Availability');
const Notification = require('../models/Notification');
const { protect, adminOnly } = require('../middleware/auth');
const { dayNameFromDate, isValidDateString, isValidTimeString, minutes, overlaps } = require('../utils/scheduling');

const router = express.Router();

const validateLessonInput = ({ student, instructor, date, startTime, endTime }) => {
  if (!student || !instructor || !date || !startTime || !endTime) {
    return 'Student, instructor, date, start time and end time are required';
  }
  if (!isValidDateString(date)) return 'Please provide a valid lesson date';
  if (!isValidTimeString(startTime) || !isValidTimeString(endTime)) return 'Please provide valid start and end times';
  if (minutes(startTime) >= minutes(endTime)) return 'End time must be after start time';
  return null;
};

async function assertInstructorAvailable({ instructor, date, startTime, endTime, excludeLessonId = null }) {
  const dayOfWeek = dayNameFromDate(date);
  const availability = await Availability.find({ instructor, dayOfWeek }).lean();
  const insideAvailability = availability.some((slot) => minutes(slot.startTime) <= minutes(startTime) && minutes(slot.endTime) >= minutes(endTime));

  if (!insideAvailability) {
    return `Instructor is not available on ${dayOfWeek} from ${startTime} to ${endTime}`;
  }

  const query = { instructor, date, status: { $ne: 'cancelled' } };
  if (excludeLessonId) query._id = { $ne: excludeLessonId };

  const sameDayLessons = await Lesson.find(query).select('startTime endTime').lean();
  const conflict = sameDayLessons.some((lesson) => overlaps(startTime, endTime, lesson.startTime, lesson.endTime));

  return conflict ? 'Instructor already has a lesson during this time' : null;
}

router.get('/', protect, async (req, res) => {
  const query = {};
  if (req.user.role === 'instructor') query.instructor = req.user._id;
  if (req.query.instructor && req.user.role === 'admin') query.instructor = req.query.instructor;
  if (req.query.status) query.status = req.query.status;
  if (req.query.from || req.query.to) {
    query.date = {};
    if (req.query.from) query.date.$gte = req.query.from;
    if (req.query.to) query.date.$lte = req.query.to;
  }

  const limit = Math.min(Number(req.query.limit) || 100, 200);
  const page = Math.max(Number(req.query.page) || 1, 1);
  const skip = (page - 1) * limit;

  const [lessons, total] = await Promise.all([
    Lesson.find(query)
      .populate('student', 'firstName lastName phone postalCode')
      .populate('instructor', 'name email phone')
      .sort({ date: 1, startTime: 1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Lesson.countDocuments(query)
  ]);

  res.json({ items: lessons, total, page, limit, hasMore: skip + lessons.length < total });
});

router.post('/', protect, adminOnly, async (req, res) => {
  const { student, instructor, date, startTime, endTime } = req.body;
  const validationError = validateLessonInput({ student, instructor, date, startTime, endTime });
  if (validationError) return res.status(400).json({ message: validationError });

  const availabilityError = await assertInstructorAvailable({ instructor, date, startTime, endTime });
  if (availabilityError) return res.status(409).json({ message: availabilityError });

  const lesson = await Lesson.create({
    student,
    instructor,
    date,
    startTime,
    endTime,
    pickupLocation: req.body.pickupLocation || '',
    notes: req.body.notes || ''
  });

  await Student.findByIdAndUpdate(student, {
    assignedInstructor: instructor,
    status: 'active'
  });

  const populated = await Lesson.findById(lesson._id)
    .populate('student', 'firstName lastName phone postalCode')
    .populate('instructor', 'name email phone')
    .lean();

  await Notification.create({
    recipient: instructor,
    lesson: lesson._id,
    type: 'lesson_assigned',
    title: 'New lesson assigned',
    message: `${populated.student?.firstName || 'A student'} ${populated.student?.lastName || ''} has been scheduled for ${date} at ${startTime}.`.trim()
  });

  res.status(201).json(populated);
});

router.put('/:id', protect, async (req, res) => {
  const lesson = await Lesson.findById(req.params.id);
  if (!lesson) return res.status(404).json({ message: 'Lesson not found' });

  if (req.user.role !== 'admin' && String(lesson.instructor) !== String(req.user._id)) {
    return res.status(403).json({ message: 'Not allowed' });
  }

  if (req.user.role !== 'admin') {
    const allowedInstructorFields = ['status', 'notes'];
    Object.keys(req.body).forEach((key) => {
      if (allowedInstructorFields.includes(key)) lesson[key] = req.body[key];
    });
  } else {
    const next = {
      student: req.body.student || lesson.student,
      instructor: req.body.instructor || lesson.instructor,
      date: req.body.date || lesson.date,
      startTime: req.body.startTime || lesson.startTime,
      endTime: req.body.endTime || lesson.endTime,
      status: req.body.status || lesson.status
    };

    const validationError = validateLessonInput(next);
    if (validationError) return res.status(400).json({ message: validationError });

    if (next.status !== 'cancelled') {
      const availabilityError = await assertInstructorAvailable({ ...next, excludeLessonId: lesson._id });
      if (availabilityError) return res.status(409).json({ message: availabilityError });
    }

    ['student', 'instructor', 'date', 'startTime', 'endTime', 'pickupLocation', 'status', 'notes'].forEach((field) => {
      if (Object.prototype.hasOwnProperty.call(req.body, field)) lesson[field] = req.body[field];
    });
  }

  await lesson.save();

  const populated = await Lesson.findById(lesson._id)
    .populate('student', 'firstName lastName phone postalCode')
    .populate('instructor', 'name email phone')
    .lean();

  res.json(populated);
});

router.delete('/:id', protect, adminOnly, async (req, res) => {
  const deleted = await Lesson.findByIdAndDelete(req.params.id);
  if (!deleted) return res.status(404).json({ message: 'Lesson not found' });
  res.json({ message: 'Lesson deleted' });
});

module.exports = router;
