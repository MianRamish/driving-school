const mongoose = require('mongoose');

const lessonSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true, index: true },
    instructor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    date: { type: String, required: true, index: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    pickupLocation: { type: String, default: '', trim: true },
    status: {
      type: String,
      enum: ['scheduled', 'completed', 'cancelled', 'missed'],
      default: 'scheduled',
      index: true
    },
    notes: { type: String, default: '', trim: true },
    reminderSent: { type: Boolean, default: false, index: true }
  },
  { timestamps: true }
);

lessonSchema.index({ instructor: 1, date: 1, startTime: 1 });
lessonSchema.index({ date: 1, status: 1 });

module.exports = mongoose.model('Lesson', lessonSchema);
