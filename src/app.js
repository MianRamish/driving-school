const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/authRoutes');
const studentRoutes = require('./routes/studentRoutes');
const instructorRoutes = require('./routes/instructorRoutes');
const availabilityRoutes = require('./routes/availabilityRoutes');
const lessonRoutes = require('./routes/lessonRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const { sendEmail } = require('./utils/email');

const app = express();

app.use(cors({
  origin: process.env.CLIENT_URL || '*',
  credentials: true
}));
app.use(express.json());

app.get('/', (req, res) => res.json({ message: 'Driving School API running' }));
app.get('/health', (req, res) => res.json({ ok: true, service: 'kudos-driving-school-api', timestamp: new Date().toISOString() }));

app.get('/api/test-email', async (req, res) => {
  try {
    const result = await sendEmail({
      to: 'ramishqamar16@gmail.com',
      subject: 'Kudos SMTP Test',
      html: '<h1>Email test successful</h1><p>Hostinger SMTP is working.</p>',
    });

    res.json({ success: true, result });
  } catch (error) {
    console.error('TEST EMAIL ERROR:', error);
    res.status(500).json({
      success: false,
      message: error.message,
      code: error.code,
      response: error.response,
    });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/instructors', instructorRoutes);
app.use('/api/availability', availabilityRoutes);
app.use('/api/lessons', lessonRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/notifications', notificationRoutes);

app.use((req, res) => res.status(404).json({ message: 'Route not found' }));

app.use((error, req, res, next) => {
  console.error(error);
  res.status(500).json({ message: error.message || 'Server error' });
});

module.exports = app;
