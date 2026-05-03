require('dotenv').config();
const app = require('./app');
const connectDB = require('./config/db');
const { startReminderJob } = require('./jobs/reminders');

const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    startReminderJob();
  });
});
