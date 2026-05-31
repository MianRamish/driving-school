const Notification = require('../models/Notification');
const User = require('../models/User');

const createNotification = async ({ recipient, lesson = null, type = 'general', title, message }) => {
  try {
    if (!recipient || !title || !message) return null;
    return await Notification.create({ recipient, lesson, type, title, message });
  } catch (error) {
    console.error('In-app notification failed:', error.message);
    return null;
  }
};

const notifyAdmins = async ({ title, message, lesson = null, type = 'general' }) => {
  try {
    const admins = await User.find({ role: 'admin', active: { $ne: false } }).select('_id').lean();
    if (!admins.length) return [];
    return await Notification.insertMany(
      admins.map((admin) => ({ recipient: admin._id, lesson, type, title, message })),
      { ordered: false }
    );
  } catch (error) {
    console.error('Admin notification failed:', error.message);
    return [];
  }
};

module.exports = {
  createNotification,
  notifyAdmins
};
