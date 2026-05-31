const express = require('express');
const Student = require('../models/Student');
const User = require('../models/User');
const { protect, adminOnly } = require('../middleware/auth');
const { sendStudentCreatedSms, sendStudentAssignedSms } = require('../services/sms.service');
const { createNotification, notifyAdmins } = require('../services/notification.service');

const router = express.Router();

const autoAssignInstructor = async (postalCode) => {
  if (!postalCode) return null;
  return User.findOne({
    role: 'instructor',
    active: true,
    postalCodes: { $in: [postalCode.trim().toUpperCase(), postalCode.trim()] }
  });
};

const canInstructorAccessStudent = (student, userId) => String(student.assignedInstructor || '') === String(userId);

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
  const studentName = `${populated.firstName || ''} ${populated.lastName || ''}`.trim();

  await Promise.all([
    sendStudentCreatedSms(populated),
    populated.assignedInstructor ? sendStudentAssignedSms(populated) : null,
    notifyAdmins({
      title: 'New student added',
      message: `${studentName || 'A student'} has been added${populated.assignedInstructor ? ` and assigned to ${populated.assignedInstructor.name}` : ''}.`
    }),
    populated.assignedInstructor ? createNotification({
      recipient: populated.assignedInstructor._id,
      title: 'New student assigned',
      message: `${studentName || 'A student'} has been assigned to you.`
    }) : null
  ]);

  res.status(201).json(populated);
});

router.put('/:id', protect, async (req, res) => {
  const student = await Student.findById(req.params.id);
  if (!student) return res.status(404).json({ message: 'Student not found' });
  const previousInstructorId = student.assignedInstructor ? String(student.assignedInstructor) : '';

  if (req.user.role !== 'admin') {
    if (!canInstructorAccessStudent(student, req.user._id)) {
      return res.status(403).json({ message: 'Not allowed' });
    }

    const allowedInstructorFields = ['status', 'lostReason', 'notes'];
    const payload = {};
    allowedInstructorFields.forEach((field) => {
      if (Object.prototype.hasOwnProperty.call(req.body, field)) payload[field] = req.body[field];
    });

    if (payload.status && payload.status !== 'lost') {
      return res.status(403).json({ message: 'Instructors can only mark a student as lost from this screen' });
    }

    if (payload.status === 'lost') {
      payload.lostAt = new Date();
      payload.lostReason = String(payload.lostReason || '').trim();
      if (!payload.lostReason) return res.status(400).json({ message: 'Lost reason is required' });
    }

    Object.assign(student, payload);
    await student.save();
  } else {
    const payload = { ...req.body };
    if (payload.postalCode) payload.postalCode = String(payload.postalCode).trim().toUpperCase();
    if (Object.prototype.hasOwnProperty.call(payload, 'assignedInstructor') && !payload.assignedInstructor) payload.assignedInstructor = null;
    if (payload.assignedInstructor) payload.status = payload.status || 'assigned';
    if (payload.status === 'lost') {
      payload.lostAt = payload.lostAt || new Date();
      payload.lostReason = String(payload.lostReason || '').trim();
      if (!payload.lostReason) return res.status(400).json({ message: 'Lost reason is required' });
    }
    Object.assign(student, payload);
    await student.save();
  }

  const populated = await Student.findById(student._id).populate('assignedInstructor', 'name email phone postalCodes');

  const nextInstructorId = populated.assignedInstructor?._id ? String(populated.assignedInstructor._id) : '';
  if (req.user.role === 'admin' && nextInstructorId && nextInstructorId !== previousInstructorId) {
    const fullName = `${populated.firstName || ''} ${populated.lastName || ''}`.trim() || 'A student';
    await Promise.all([
      sendStudentAssignedSms(populated),
      createNotification({
        recipient: populated.assignedInstructor._id,
        title: 'Student assigned',
        message: `${fullName} has been assigned to you.`
      })
    ]);
  }

  res.json(populated);
});

router.delete('/:id', protect, adminOnly, async (req, res) => {
  const deleted = await Student.findByIdAndDelete(req.params.id);
  if (!deleted) return res.status(404).json({ message: 'Student not found' });
  res.json({ message: 'Student deleted' });
});

module.exports = router;
