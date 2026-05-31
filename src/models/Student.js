const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true },
    phone: { type: String, required: true, trim: true },
    postalCode: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ['new', 'assigned', 'active', 'completed', 'on-hold', 'lost'],
      default: 'new'
    },
    notes: { type: String, default: '' },
    lostReason: { type: String, default: '', trim: true },
    lostAt: { type: Date, default: null },
    assignedInstructor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
  },
  { timestamps: true }
);

studentSchema.virtual('fullName').get(function fullName() {
  return `${this.firstName} ${this.lastName}`;
});

studentSchema.set('toJSON', { virtuals: true });
studentSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Student', studentSchema);
