const BRAND = {
  name: 'Kudos Driving School',
  logo: process.env.EMAIL_LOGO_URL || 'https://kudosdrivingschool.co.uk/wp-content/uploads/2025/05/rsz_kudos_new_logo_final_1-01.png',
  primary: '#f5c542',
  dark: '#101318',
  card: '#171b22',
  text: '#f7f7f7',
  muted: '#b9c0cc'
};

const escapeHtml = (value = '') => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

const fullName = (person = {}) => [person.firstName, person.lastName].filter(Boolean).join(' ').trim() || person.name || 'Unknown';
const display = (value, fallback = 'N/A') => escapeHtml(value || fallback);

const formatLessonDate = (date) => {
  if (!date) return 'N/A';
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });
};

const field = (label, value) => `
  <tr>
    <td style="padding:10px 0;color:${BRAND.muted};font-size:14px;border-bottom:1px solid rgba(255,255,255,0.08);">${escapeHtml(label)}</td>
    <td style="padding:10px 0;color:${BRAND.text};font-size:14px;font-weight:600;text-align:right;border-bottom:1px solid rgba(255,255,255,0.08);">${display(value)}</td>
  </tr>
`;

const layout = ({ title, intro, children, ctaText, ctaUrl }) => `
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:#0b0d11;font-family:Arial,Helvetica,sans-serif;color:${BRAND.text};">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0b0d11;padding:28px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:${BRAND.card};border-radius:22px;overflow:hidden;border:1px solid rgba(255,255,255,0.08);box-shadow:0 16px 45px rgba(0,0,0,0.35);">
          <tr>
            <td style="background:${BRAND.dark};padding:24px 26px;border-bottom:4px solid ${BRAND.primary};">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="vertical-align:middle;">
                    <img src="${BRAND.logo}" alt="${BRAND.name}" style="height:56px;max-width:180px;display:block;object-fit:contain;" />
                  </td>
                  <td style="vertical-align:middle;text-align:right;color:${BRAND.primary};font-weight:700;font-size:14px;">
                    ${BRAND.name}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:30px 26px;">
              <h1 style="margin:0 0 12px;color:${BRAND.text};font-size:26px;line-height:1.25;">${escapeHtml(title)}</h1>
              ${intro ? `<p style="margin:0 0 22px;color:${BRAND.muted};font-size:15px;line-height:1.65;">${escapeHtml(intro)}</p>` : ''}
              ${children}
              ${ctaText && ctaUrl ? `<p style="margin:26px 0 0;"><a href="${escapeHtml(ctaUrl)}" style="display:inline-block;background:${BRAND.primary};color:#111;font-weight:700;text-decoration:none;border-radius:12px;padding:13px 18px;">${escapeHtml(ctaText)}</a></p>` : ''}
            </td>
          </tr>
          <tr>
            <td style="background:#101318;padding:18px 26px;color:${BRAND.muted};font-size:12px;line-height:1.6;">
              This is an automated message from ${BRAND.name}. Please contact the office if any information looks incorrect.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

const detailsTable = (rows) => `
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:6px;">
    ${rows.map(([label, value]) => field(label, value)).join('')}
  </table>
`;

const lessonRows = (lesson = {}) => [
  ['Student', fullName(lesson.student)],
  ['Instructor', lesson.instructor?.name],
  ['Date', formatLessonDate(lesson.date)],
  ['Time', `${lesson.startTime || 'N/A'} - ${lesson.endTime || 'N/A'}`],
  ['Pickup location', lesson.pickupLocation || 'N/A'],
  ['Notes', lesson.notes || 'N/A']
];

const studentRows = (student = {}) => [
  ['Student', fullName(student)],
  ['Email', student.email || 'N/A'],
  ['Phone', student.phone || 'N/A'],
  ['Postal code', student.postalCode || 'N/A'],
  ['Assigned instructor', student.assignedInstructor?.name || 'Not assigned yet'],
  ['Status', student.status || 'N/A']
];

const studentWelcomeTemplate = ({ student }) => ({
  subject: `Welcome to ${BRAND.name}`,
  text: `Welcome to ${BRAND.name}, ${fullName(student)}. Your details have been added to our system. Instructor: ${student.assignedInstructor?.name || 'Not assigned yet'}. Phone: ${student.phone || 'N/A'}. Postal code: ${student.postalCode || 'N/A'}.`,
  html: layout({
    title: `Welcome, ${fullName(student)}`,
    intro: 'Your details have been added to our driving school system. We will use these details to manage your lessons and keep you updated.',
    children: detailsTable(studentRows(student))
  })
});

const studentLessonAssignedTemplate = ({ lesson }) => ({
  subject: `Your driving lesson is booked for ${formatLessonDate(lesson.date)}`,
  text: `Your driving lesson has been booked with ${lesson.instructor?.name || 'your instructor'} on ${lesson.date} from ${lesson.startTime} to ${lesson.endTime}. Pickup location: ${lesson.pickupLocation || 'N/A'}.`,
  html: layout({
    title: 'Your lesson is booked',
    intro: 'A driving lesson has been added to your schedule. Please review the details below.',
    children: detailsTable(lessonRows(lesson))
  })
});

const lessonReminderTemplate = ({ lesson, recipientType = 'student' }) => ({
  subject: `Reminder: driving lesson tomorrow at ${lesson.startTime}`,
  text: `Reminder: ${recipientType === 'instructor' ? `${fullName(lesson.student)} has` : 'you have'} a driving lesson on ${lesson.date} from ${lesson.startTime} to ${lesson.endTime}. Pickup location: ${lesson.pickupLocation || 'N/A'}.`,
  html: layout({
    title: 'Lesson reminder',
    intro: recipientType === 'instructor'
      ? 'You have a lesson scheduled in approximately 24 hours.'
      : 'This is a reminder that your driving lesson is scheduled in approximately 24 hours.',
    children: detailsTable(lessonRows(lesson))
  })
});

const lessonCancelledTemplate = ({ lesson, recipientType = 'student' }) => ({
  subject: `Lesson cancelled: ${formatLessonDate(lesson.date)} at ${lesson.startTime}`,
  text: `The driving lesson on ${lesson.date} from ${lesson.startTime} to ${lesson.endTime} has been cancelled.`,
  html: layout({
    title: 'Lesson cancelled',
    intro: recipientType === 'instructor'
      ? 'A lesson assigned to you has been cancelled.'
      : 'Your driving lesson has been cancelled. Please contact the office if you need help rebooking.',
    children: detailsTable(lessonRows(lesson))
  })
});

const lessonRescheduledTemplate = ({ lesson, previousLesson, recipientType = 'student' }) => ({
  subject: `Lesson rescheduled: ${formatLessonDate(lesson.date)} at ${lesson.startTime}`,
  text: `Your lesson has been rescheduled. New details: ${lesson.date} from ${lesson.startTime} to ${lesson.endTime}. Previous details: ${previousLesson.date} from ${previousLesson.startTime} to ${previousLesson.endTime}.`,
  html: layout({
    title: 'Lesson rescheduled',
    intro: recipientType === 'instructor'
      ? 'A lesson assigned to you has been rescheduled. Please review the updated details.'
      : 'Your driving lesson has been rescheduled. Please review the updated details.',
    children: `
      <h2 style="margin:10px 0 8px;color:${BRAND.primary};font-size:16px;">Updated details</h2>
      ${detailsTable(lessonRows(lesson))}
      <h2 style="margin:26px 0 8px;color:${BRAND.primary};font-size:16px;">Previous details</h2>
      ${detailsTable([
        ['Date', formatLessonDate(previousLesson.date)],
        ['Time', `${previousLesson.startTime || 'N/A'} - ${previousLesson.endTime || 'N/A'}`],
        ['Pickup location', previousLesson.pickupLocation || 'N/A']
      ])}
    `
  })
});

const adminStudentCreatedTemplate = ({ student, instructor }) => ({
  subject: `New student added by ${instructor?.name || 'Instructor'}`,
  text: `${instructor?.name || 'An instructor'} added a new student: ${fullName(student)}. Phone: ${student.phone || 'N/A'}. Email: ${student.email || 'N/A'}. Postal code: ${student.postalCode || 'N/A'}.`,
  html: layout({
    title: 'New student added',
    intro: `${instructor?.name || 'An instructor'} has added a new student to the system.`,
    children: detailsTable(studentRows(student))
  })
});

const adminLessonCreatedTemplate = ({ lesson }) => ({
  subject: `New lesson added by ${lesson.instructor?.name || 'Instructor'}`,
  text: `${lesson.instructor?.name || 'An instructor'} added a lesson for ${fullName(lesson.student)} on ${lesson.date} from ${lesson.startTime} to ${lesson.endTime}.`,
  html: layout({
    title: 'New lesson added',
    intro: 'An instructor has added a new lesson to the system.',
    children: detailsTable(lessonRows(lesson))
  })
});

const instructorLessonAssignedTemplate = ({ lesson }) => ({
  subject: `New lesson assigned: ${lesson.date} at ${lesson.startTime}`,
  text: `A lesson has been assigned to you for ${fullName(lesson.student)} on ${lesson.date} from ${lesson.startTime} to ${lesson.endTime}. Pickup location: ${lesson.pickupLocation || 'N/A'}.`,
  html: layout({
    title: 'New lesson assigned',
    intro: 'A lesson has been assigned to you. Please review the details below.',
    children: detailsTable(lessonRows(lesson))
  })
});

module.exports = {
  fullName,
  formatLessonDate,
  studentWelcomeTemplate,
  studentLessonAssignedTemplate,
  lessonReminderTemplate,
  lessonCancelledTemplate,
  lessonRescheduledTemplate,
  adminStudentCreatedTemplate,
  adminLessonCreatedTemplate,
  instructorLessonAssignedTemplate
};
