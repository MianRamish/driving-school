const express = require('express');
const Notification = require('../models/Notification');
const { protect, adminOnly } = require('../middleware/auth');
const { safeSendSms, smsConfigStatus } = require('../services/sms.service');

const router = express.Router();


router.get('/sms-status', protect, adminOnly, async (req, res) => {
  res.json(smsConfigStatus());
});

router.post('/test-sms', protect, adminOnly, async (req, res) => {
  const { to, body } = req.body;
  const result = await safeSendSms({
    to,
    body: body || 'Hi, this is a test SMS from Kudos Driving School.'
  });

  res.json({
    message: result?.sid ? 'Test SMS sent' : 'Test SMS attempted',
    result
  });
});

router.get('/', protect, async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 20, 50);
  const page = Math.max(Number(req.query.page) || 1, 1);
  const skip = (page - 1) * limit;

  const [items, unread, total] = await Promise.all([
    Notification.find({ recipient: req.user._id })
      .populate({ path: 'lesson', populate: [{ path: 'student', select: 'firstName lastName phone' }, { path: 'instructor', select: 'name' }] })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Notification.countDocuments({ recipient: req.user._id, read: false }),
    Notification.countDocuments({ recipient: req.user._id })
  ]);

  res.json({ items, unread, total, page, limit, hasMore: skip + items.length < total });
});

router.get('/unread-count', protect, async (req, res) => {
  const count = await Notification.countDocuments({ recipient: req.user._id, read: false });
  res.json({ count });
});

router.put('/:id/read', protect, async (req, res) => {
  const notification = await Notification.findOneAndUpdate(
    { _id: req.params.id, recipient: req.user._id },
    { read: true },
    { new: true }
  ).lean();

  if (!notification) return res.status(404).json({ message: 'Notification not found' });
  res.json(notification);
});

router.put('/read-all', protect, async (req, res) => {
  await Notification.updateMany({ recipient: req.user._id, read: false }, { read: true });
  res.json({ message: 'Notifications marked as read' });
});

module.exports = router;
