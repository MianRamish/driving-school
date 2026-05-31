const twilio = require('twilio');

const isSmsDebugEnabled = () => process.env.TWILIO_SMS_DEBUG === 'true' || process.env.NODE_ENV !== 'production';

const hasTwilioSmsConfig = () => Boolean(
  process.env.TWILIO_ACCOUNT_SID
  && process.env.TWILIO_AUTH_TOKEN
  && process.env.TWILIO_MESSAGING_SERVICE_SID
);

let cachedClient = null;
const getClient = () => {
  if (!hasTwilioSmsConfig()) return null;
  if (!cachedClient) {
    cachedClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  }
  return cachedClient;
};

const normalizePhoneNumber = (phone) => {
  if (!phone) return '';
  const raw = String(phone).trim();
  if (!raw) return '';

  // Twilio SMS expects E.164 numbers like +923039358816.
  // Keep only common phone characters, then remove spaces/dashes/brackets.
  const compact = raw.replace(/[\s().-]/g, '');
  return compact.startsWith('+') ? compact : `+${compact}`;
};

const smsConfigStatus = () => ({
  configured: hasTwilioSmsConfig(),
  hasAccountSid: Boolean(process.env.TWILIO_ACCOUNT_SID),
  hasAuthToken: Boolean(process.env.TWILIO_AUTH_TOKEN),
  hasMessagingServiceSid: Boolean(process.env.TWILIO_MESSAGING_SERVICE_SID),
  messagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID
    ? `${process.env.TWILIO_MESSAGING_SERVICE_SID.slice(0, 6)}...${process.env.TWILIO_MESSAGING_SERVICE_SID.slice(-4)}`
    : null
});

const safeSendSms = async ({ to, body }) => {
  const formattedTo = normalizePhoneNumber(to);

  try {
    const client = getClient();

    if (!client || !formattedTo || !body) {
      const result = {
        skipped: true,
        reason: !client
          ? 'Missing Twilio SMS environment variables'
          : !formattedTo
            ? 'Missing recipient phone number'
            : 'Missing SMS body',
        to: formattedTo || null,
        config: smsConfigStatus()
      };
      if (isSmsDebugEnabled()) console.warn('SMS skipped:', result);
      return result;
    }

    const message = await client.messages.create({
      to: formattedTo,
      messagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID,
      body
    });

    if (isSmsDebugEnabled()) {
      console.log('SMS sent:', {
        sid: message.sid,
        to: formattedTo,
        status: message.status,
        messagingServiceSid: smsConfigStatus().messagingServiceSid
      });
    }

    return message;
  } catch (error) {
    const result = {
      failed: true,
      to: formattedTo || null,
      error: error.message,
      code: error.code,
      moreInfo: error.moreInfo
    };
    console.error('SMS notification failed:', result);
    return result;
  }
};

const sendStudentCreatedSms = async (student) => {
  const fullName = `${student.firstName || ''} ${student.lastName || ''}`.trim() || 'Student';
  const instructorName = student.assignedInstructor?.name || 'your instructor';

  return safeSendSms({
    to: student.phone,
    body: `Hi ${fullName}, you have been added to Kudos Driving School. Your instructor is ${instructorName}. We will send your lesson updates by SMS.`
  });
};

const sendInstructorCreatedSms = async (instructor) => safeSendSms({
  to: instructor.phone,
  body: `Hi ${instructor.name || 'Instructor'}, your Kudos Driving School instructor account has been created. You will receive student and lesson updates by SMS.`
});

const sendStudentAssignedSms = async (student) => {
  const fullName = `${student.firstName || ''} ${student.lastName || ''}`.trim() || 'A student';
  const instructor = student.assignedInstructor || {};

  return safeSendSms({
    to: instructor.phone,
    body: `Hi ${instructor.name || 'Instructor'}, ${fullName} has been assigned to you. Student phone: ${student.phone || 'not provided'}.`
  });
};

const sendLessonCreatedSms = async (lesson) => {
  const student = lesson.student || {};
  const instructor = lesson.instructor || {};
  const fullName = `${student.firstName || ''} ${student.lastName || ''}`.trim() || 'Student';
  const pickupText = lesson.pickupLocation ? ` Pickup: ${lesson.pickupLocation}.` : '';

  return Promise.all([
    safeSendSms({
      to: student.phone,
      body: `Hi ${fullName}, your driving lesson is scheduled for ${lesson.date} from ${lesson.startTime} to ${lesson.endTime} with ${instructor.name || 'your instructor'}.${pickupText}`
    }),
    safeSendSms({
      to: instructor.phone,
      body: `Hi ${instructor.name || 'Instructor'}, lesson scheduled: ${fullName} on ${lesson.date} from ${lesson.startTime} to ${lesson.endTime}.${pickupText}`
    })
  ]);
};

module.exports = {
  smsConfigStatus,
  safeSendSms,
  sendStudentCreatedSms,
  sendInstructorCreatedSms,
  sendStudentAssignedSms,
  sendLessonCreatedSms
};
