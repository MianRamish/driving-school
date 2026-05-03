const express = require('express');
const User = require('../models/User');
const createToken = require('../utils/token');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email: String(email || '').toLowerCase() });
  if (!user || !(await user.matchPassword(password || ''))) {
    return res.status(401).json({ message: 'Invalid email or password' });
  }

  if (!user.active) {
    return res.status(403).json({ message: 'Account disabled' });
  }

  res.json({
    token: createToken(user._id),
    user: user.safe()
  });
});

router.get('/me', protect, async (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
