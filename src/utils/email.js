const nodemailer = require('nodemailer');

const {
  fullName,
  studentWelcomeTemplate,
  studentLessonAssignedTemplate,
  lessonReminderTemplate,
  lessonCancelledTemplate,
  lessonRescheduledTemplate,
  adminStudentCreatedTemplate,
  adminLessonCreatedTemplate,
  instructorLessonAssignedTemplate
} = require('./emailTemplates');

const smtpConfigured = () => Boolean(
  process.env.SMTP_HOST &&
  process.env.SMTP_PORT &&
  process.env.SMTP_USER &&
  process.env.SMTP_PASS
);

const createTransporter = () => {
  if (!smtpConfigured()) return null;

  const port = Number(process.env.SMTP_PORT || 587);
  const secure = String(process.env.SMTP_SECURE || '').toLowerCase() === 'true';

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure,

    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    },

    requireTLS: port === 587,

    tls: {
      rejectUnauthorized: false
    },

    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 15000,

    logger: true,
    debug: true
  });
};

const formatRecipients = (recipients = []) => {
  if (!Array.isArray(recipients)) return [];

  return recipients
    .map((email) => String(email || '').trim())
    .filter(Boolean)
    .filter((email, index, arr) => arr.indexOf(email) === index);
};

const sendEmail = async ({ to, subject, html, text }) => {
  const recipients = formatRecipients(Array.isArray(to) ? to : [to]);

  if (!recipients.length) {
    return { skipped: true, reason: 'No recipients' };
  }

  const transporter = createTransporter();

  if (!transporter) {
    console.warn(`Email skipped because SMTP is not configured. Subject: ${subject}`);
    return { skipped: true, reason: 'SMTP not configured' };
  }

  const from = process.env.EMAIL_FROM || process.env.SMTP_USER;

  try {
    console.log('Sending email:', {
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: process.env.SMTP_SECURE,
      from,
      to: recipients.join(',')
    });

    const info = await transporter.sendMail({
      from,
      to: recipients.join(','),
      subject,
      text,
      html
    });

    console.log('EMAIL SENT:', info.messageId);

    return {
      skipped: false,
      success: true,
      messageId: info.messageId
    };
  } catch (error) {
    console.error('Email send failed:', {
      message: error.message,
      code: error.code,
      command: error.command,
      response: error.response,
      responseCode: error.responseCode
    });

    return {
      skipped: true,
      reason: error.message,
      code: error.code,
      command: error.command,
      response: error.response,
      responseCode: error.responseCode
    };
  }
};

const getAdminEmails = async (User) => {
  const admins = await User.find({ role: 'admin', active: true })
    .select('email')
    .lean();

  return admins
    .map((admin) => admin.email)
    .filter(Boolean);
};

const sendTemplate = async ({ to, template }) => {
  try {
    return await sendEmail({ to, ...template });
  } catch (error) {
    console.error('Email template/send failed:', error.message);
    return { skipped: true, reason: error.message };
  }
};

const sendEmailSafely = async (label, emailJob) => {
  try {
    const result = typeof emailJob === 'function'
      ? await emailJob()
      : await emailJob;

    if (Array.isArray(result)) {
      result.forEach((item) => {
        if (item?.skipped) {
          console.warn(`[Email skipped] ${label}: ${item.reason}`);
        }
      });
    } else if (result?.skipped) {
      console.warn(`[Email skipped] ${label}: ${result.reason}`);
    }

    return result;
  } catch (error) {
    console.error(`[Email failed] ${label}:`, error.message);
    return { skipped: true, reason: error.message };
  }
};

const runEmailJob = (label, emailJob) => {
  setImmediate(() => {
    sendEmailSafely(label, emailJob).catch((error) => {
      console.error(`[Email background failed] ${label}:`, error.message);
    });
  });
};

const sendStudentWelcomeEmail = async ({ student }) => {
  if (!student?.email) {
    return { skipped: true, reason: 'Student email missing' };
  }

  return sendTemplate({
    to: student.email,
    template: studentWelcomeTemplate({ student })
  });
};

const sendStudentLessonAssignedEmail = async ({ lesson }) => {
  if (!lesson.student?.email) {
    return { skipped: true, reason: 'Student email missing' };
  }

  return sendTemplate({
    to: lesson.student.email,
    template: studentLessonAssignedTemplate({ lesson })
  });
};

const sendLessonReminderEmails = async ({ lesson }) => Promise.all([
  lesson.student?.email
    ? sendTemplate({
        to: lesson.student.email,
        template: lessonReminderTemplate({ lesson, recipientType: 'student' })
      })
    : Promise.resolve({ skipped: true, reason: 'Student email missing' }),

  lesson.instructor?.email
    ? sendTemplate({
        to: lesson.instructor.email,
        template: lessonReminderTemplate({ lesson, recipientType: 'instructor' })
      })
    : Promise.resolve({ skipped: true, reason: 'Instructor email missing' })
]);

const sendLessonCancellationEmails = async ({ lesson }) => Promise.all([
  lesson.student?.email
    ? sendTemplate({
        to: lesson.student.email,
        template: lessonCancelledTemplate({ lesson, recipientType: 'student' })
      })
    : Promise.resolve({ skipped: true, reason: 'Student email missing' }),

  lesson.instructor?.email
    ? sendTemplate({
        to: lesson.instructor.email,
        template: lessonCancelledTemplate({ lesson, recipientType: 'instructor' })
      })
    : Promise.resolve({ skipped: true, reason: 'Instructor email missing' })
]);

const sendLessonRescheduledEmails = async ({ lesson, previousLesson }) => Promise.all([
  lesson.student?.email
    ? sendTemplate({
        to: lesson.student.email,
        template: lessonRescheduledTemplate({
          lesson,
          previousLesson,
          recipientType: 'student'
        })
      })
    : Promise.resolve({ skipped: true, reason: 'Student email missing' }),

  lesson.instructor?.email
    ? sendTemplate({
        to: lesson.instructor.email,
        template: lessonRescheduledTemplate({
          lesson,
          previousLesson,
          recipientType: 'instructor'
        })
      })
    : Promise.resolve({ skipped: true, reason: 'Instructor email missing' })
]);

const sendStudentCreatedByInstructorEmail = async ({ User, student, instructor }) => {
  const adminEmails = await getAdminEmails(User);

  return sendTemplate({
    to: adminEmails,
    template: adminStudentCreatedTemplate({ student, instructor })
  });
};

const sendLessonCreatedByInstructorEmail = async ({ User, lesson }) => {
  const adminEmails = await getAdminEmails(User);

  return sendTemplate({
    to: adminEmails,
    template: adminLessonCreatedTemplate({ lesson })
  });
};

const sendLessonAssignedToInstructorEmail = async ({ lesson }) => {
  if (!lesson.instructor?.email) {
    return { skipped: true, reason: 'Instructor email missing' };
  }

  return sendTemplate({
    to: lesson.instructor.email,
    template: instructorLessonAssignedTemplate({ lesson })
  });
};

module.exports = {
  sendEmail,
  sendEmailSafely,
  runEmailJob,
  fullName,
  sendStudentWelcomeEmail,
  sendStudentLessonAssignedEmail,
  sendLessonReminderEmails,
  sendLessonCancellationEmails,
  sendLessonRescheduledEmails,
  sendStudentCreatedByInstructorEmail,
  sendLessonCreatedByInstructorEmail,
  sendLessonAssignedToInstructorEmail
};
