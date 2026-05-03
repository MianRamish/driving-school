const Lesson = require('../models/Lesson');
const Notification = require('../models/Notification');

const pad = (value) => String(value).padStart(2, '0');
const toDateKey = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const toTimeKey = (date) => `${pad(date.getHours())}:${pad(date.getMinutes())}`;

async function sendLessonReminders() {
  const now = new Date();
  const soon = new Date(now.getTime() + 30 * 60 * 1000);
  const today = toDateKey(now);
  const soonDate = toDateKey(soon);

  const query = {
    status: 'scheduled',
    reminderSent: false,
    date: { $gte: today, $lte: soonDate }
  };

  const lessons = await Lesson.find(query)
    .populate('student', 'firstName lastName')
    .select('student instructor date startTime reminderSent')
    .limit(100);

  const lower = now.getTime();
  const upper = soon.getTime();

  for (const lesson of lessons) {
    const lessonTime = new Date(`${lesson.date}T${lesson.startTime}:00`);
    const ms = lessonTime.getTime();
    if (Number.isNaN(ms) || ms < lower || ms > upper) continue;

    await Notification.create({
      recipient: lesson.instructor,
      lesson: lesson._id,
      type: 'lesson_reminder',
      title: 'Lesson starts soon',
      message: `${lesson.student?.firstName || 'Your student'} ${lesson.student?.lastName || ''} has a lesson at ${lesson.startTime}.`.trim()
    });

    lesson.reminderSent = true;
    await lesson.save();
  }
}

function startReminderJob() {
  if (process.env.ENABLE_REMINDER_JOB === 'false') return;
  sendLessonReminders().catch((error) => console.error('Reminder job failed:', error));
  setInterval(() => sendLessonReminders().catch((error) => console.error('Reminder job failed:', error)), 5 * 60 * 1000);
}

module.exports = { sendLessonReminders, startReminderJob };
