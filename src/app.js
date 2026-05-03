const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/authRoutes');
const studentRoutes = require('./routes/studentRoutes');
const instructorRoutes = require('./routes/instructorRoutes');
const availabilityRoutes = require('./routes/availabilityRoutes');
const lessonRoutes = require('./routes/lessonRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const notificationRoutes = require('./routes/notificationRoutes');

const app = express();

app.use(cors({
  origin: process.env.CLIENT_URL || '*',
  credentials: true
}));
app.use(express.json());

app.get('/', (req, res) => res.json({ message: 'Driving School API running' }));
app.get('/health', (req, res) => res.json({ ok: true, service: 'kudos-driving-school-api', timestamp: new Date().toISOString() }));

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
