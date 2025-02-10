import mongoose from 'mongoose';

const presenceSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['office', 'client', 'remote', 'school', 'away'],
    required: true
  },
  date: {
    type: Date,
    required: true
  }
});

presenceSchema.pre('save', async function(next) {
  try {
    // Delete all presences for the same user and date
    await this.constructor.deleteMany({ user: this.user, date: this.date });
    next();
  } catch (error) {
    next(new Error('Error during pre-save: ' + error.message));
  }
});

const Presence = mongoose.model('Presence', presenceSchema, 'presences');

export default Presence;
