const mongoose = require('mongoose');

const availabilitySchema = new mongoose.Schema(
  {
    instructor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    dayOfWeek: {
      type: String,
      enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
      required: true,
      index: true
    },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true }
  },
  { timestamps: true }
);

availabilitySchema.index({ instructor: 1, dayOfWeek: 1, startTime: 1 });

module.exports = mongoose.model('Availability', availabilitySchema);
