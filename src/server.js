require('dotenv').config();

const app = require('./app');
const connectDB = require('./config/db');
const { startReminderJob } = require('./jobs/reminders');
const { sendEmail } = require('./utils/email');

const PORT = process.env.PORT || 5000;

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

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    startReminderJob();
  });
});
