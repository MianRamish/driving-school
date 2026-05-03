const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

const isValidDateString = (date) => datePattern.test(date) && !Number.isNaN(new Date(`${date}T00:00:00`).getTime());
const isValidTimeString = (time) => timePattern.test(time);
const minutes = (time) => {
  const [hour, minute] = String(time).split(':').map(Number);
  return hour * 60 + minute;
};
const overlaps = (aStart, aEnd, bStart, bEnd) => minutes(aStart) < minutes(bEnd) && minutes(aEnd) > minutes(bStart);
const dayNameFromDate = (date) => days[new Date(`${date}T00:00:00`).getDay()];

module.exports = {
  dayNameFromDate,
  isValidDateString,
  isValidTimeString,
  minutes,
  overlaps
};
