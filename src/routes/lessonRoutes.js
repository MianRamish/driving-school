const express = require('express');
const Lesson = require('../models/Lesson');
const Student = require('../models/Student');
const Availability = require('../models/Availability');
const Notification = require('../models/Notification');
const User = require('../models/User');
const { protect, adminOnly } = require('../middleware/auth');
const { dayNameFromDate, isValidDateString, isValidTimeString, minutes, overlaps } = require('../utils/scheduling');
const {
  sendStudentLessonAssignedEmail,
  sendLessonCreatedByInstructorEmail,
  sendLessonAssignedToInstructorEmail,
  sendLessonCancellationEmails,
  sendLessonRescheduledEmails,
  sendEmailSafely
} = require('../utils/email');

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

const populateLesson = (id) => Lesson.findById(id)
  .populate('student', 'firstName lastName phone email postalCode')
  .populate('instructor', 'name email phone')
  .lean();

const isDifferent = (a, b) => String(a || '') !== String(b || '');

const snapshotLesson = (lesson) => ({
  student: lesson.student,
  instructor: lesson.instructor,
  date: lesson.date,
  startTime: lesson.startTime,
  endTime: lesson.endTime,
  pickupLocation: lesson.pickupLocation,
  status: lesson.status,
  notes: lesson.notes
});

const hasScheduleChanged = (before, after) => [
  'student',
  'instructor',
  'date',
  'startTime',
  'endTime',
  'pickupLocation'
].some((field) => isDifferent(before[field], after[field]));

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
      .populate('student', 'firstName lastName phone email postalCode')
      .populate('instructor', 'name email phone')
      .sort({ date: 1, startTime: 1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Lesson.countDocuments(query)
  ]);

  res.json({ items: lessons, total, page, limit, hasMore: skip + lessons.length < total });
});

router.post('/', protect, async (req, res) => {
  if (!['admin', 'instructor'].includes(req.user.role)) {
    return res.status(403).json({ message: 'Not allowed' });
  }

  const student = req.body.student;
  const instructor = req.user.role === 'instructor' ? req.user._id : req.body.instructor;
  const { date, startTime, endTime } = req.body;

  const validationError = validateLessonInput({ student, instructor, date, startTime, endTime });
  if (validationError) return res.status(400).json({ message: validationError });

  if (req.user.role === 'instructor') {
    const existingStudent = await Student.findOne({ _id: student, assignedInstructor: req.user._id }).lean();
    if (!existingStudent) {
      return res.status(403).json({ message: 'You can only create lessons for your own students' });
    }
  }

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

  const populated = await populateLesson(lesson._id);

  await sendEmailSafely('student lesson assigned email', sendStudentLessonAssignedEmail({ lesson: populated }));

  if (req.user.role === 'admin') {
    await Notification.create({
      recipient: instructor,
      lesson: lesson._id,
      type: 'lesson_assigned',
      title: 'New lesson assigned',
      message: `${populated.student?.firstName || 'A student'} ${populated.student?.lastName || ''} has been scheduled for ${date} at ${startTime}.`.trim()
    });

    await sendEmailSafely('instructor lesson assigned/reassigned email', sendLessonAssignedToInstructorEmail({ lesson: populated }));
  } else {
    await sendEmailSafely('admin lesson created email', sendLessonCreatedByInstructorEmail({ User, lesson: populated }));
  }

  res.status(201).json(populated);
});

router.put('/:id', protect, async (req, res) => {
  const lesson = await Lesson.findById(req.params.id);
  if (!lesson) return res.status(404).json({ message: 'Lesson not found' });

  if (req.user.role !== 'admin' && String(lesson.instructor) !== String(req.user._id)) {
    return res.status(403).json({ message: 'Not allowed' });
  }

  const previous = snapshotLesson(lesson);
  const previousPopulated = await populateLesson(lesson._id);
  const previousInstructor = String(lesson.instructor);

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

  const nextSnapshot = snapshotLesson(lesson);
  const becameCancelled = previous.status !== 'cancelled' && lesson.status === 'cancelled';
  const scheduleChanged = !becameCancelled && lesson.status !== 'cancelled' && hasScheduleChanged(previous, nextSnapshot);

  if (becameCancelled || scheduleChanged) {
    lesson.reminderSent = false;
  }

  await lesson.save();

  if (req.user.role === 'admin' && isDifferent(lesson.student, previous.student)) {
    await Student.findByIdAndUpdate(lesson.student, {
      assignedInstructor: lesson.instructor,
      status: lesson.status === 'cancelled' ? 'assigned' : 'active'
    });
  }

  const populated = await populateLesson(lesson._id);

  if (becameCancelled) {
    await sendEmailSafely('lesson cancellation emails', sendLessonCancellationEmails({ lesson: populated }));
  } else if (scheduleChanged) {
    await sendEmailSafely('lesson rescheduled emails', sendLessonRescheduledEmails({ lesson: populated, previousLesson: previousPopulated }));
  }

  if (req.user.role === 'admin' && String(populated.instructor?._id || populated.instructor) !== previousInstructor) {
    await Notification.create({
      recipient: populated.instructor._id,
      lesson: lesson._id,
      type: 'lesson_assigned',
      title: 'Lesson reassigned',
      message: `${populated.student?.firstName || 'A student'} ${populated.student?.lastName || ''} has been assigned to you for ${populated.date} at ${populated.startTime}.`.trim()
    });

    await sendEmailSafely('instructor lesson assigned/reassigned email', sendLessonAssignedToInstructorEmail({ lesson: populated }));
  }

  res.json(populated);
});

router.delete('/:id', protect, adminOnly, async (req, res) => {
  const existing = await populateLesson(req.params.id);
  const deleted = await Lesson.findByIdAndDelete(req.params.id);
  if (!deleted) return res.status(404).json({ message: 'Lesson not found' });

  if (existing && existing.status !== 'cancelled') {
    await sendEmailSafely('lesson deletion cancellation emails', sendLessonCancellationEmails({ lesson: existing }));
  }

  res.json({ message: 'Lesson deleted' });
});

module.exports = router;
