const Lesson = require('../models/Lesson');
const Notification = require('../models/Notification');
const { sendLessonReminderEmails } = require('../utils/email');

const pad = (value) => String(value).padStart(2, '0');
const toDateKey = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const lessonDateTime = (lesson) => new Date(`${lesson.date}T${lesson.startTime}:00`);

async function sendLessonReminders() {
  const now = new Date();
  const reminderWindowStart = new Date(now.getTime() + (24 * 60 - 10) * 60 * 1000);
  const reminderWindowEnd = new Date(now.getTime() + (24 * 60 + 10) * 60 * 1000);

  const query = {
    status: 'scheduled',
    reminderSent: false,
    date: {
      $gte: toDateKey(reminderWindowStart),
      $lte: toDateKey(reminderWindowEnd)
    }
  };

  const lessons = await Lesson.find(query)
    .populate('student', 'firstName lastName email phone postalCode')
    .populate('instructor', 'name email phone')
    .limit(100);

  for (const lesson of lessons) {
    const scheduledAt = lessonDateTime(lesson);
    const scheduledMs = scheduledAt.getTime();
    if (Number.isNaN(scheduledMs)) continue;
    if (scheduledMs < reminderWindowStart.getTime() || scheduledMs > reminderWindowEnd.getTime()) continue;

    await Notification.create({
      recipient: lesson.instructor,
      lesson: lesson._id,
      type: 'lesson_reminder',
      title: 'Lesson reminder',
      message: `${lesson.student?.firstName || 'Your student'} ${lesson.student?.lastName || ''} has a lesson tomorrow at ${lesson.startTime}.`.trim()
    });

    await sendLessonReminderEmails({ lesson });

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
