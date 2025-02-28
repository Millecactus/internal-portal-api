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


presenceSchema.pre('save', async function (next) {
  try {
    const startOfDay = new Date(this.date);
    startOfDay.setHours(0, 0, 0, 0);
    const noon = new Date(this.date);
    noon.setHours(12, 0, 0, 0);
    const endOfDay = new Date(this.date);
    endOfDay.setHours(23, 59, 59, 999);

    let query;
    if (this.date < noon) {
      // Matin: de minuit à 12h
      query = { user: this.user, date: { $gte: startOfDay, $lt: noon } };
    } else {
      // Après-midi: de 12h à 23h59
      query = { user: this.user, date: { $gte: noon, $lte: endOfDay } };
    }

    await this.constructor.deleteMany(query);
    next();
  } catch (error) {
    next(new Error('Erreur lors du pré-enregistrement: ' + error.message));
  }
});

const Presence = mongoose.model('Presence', presenceSchema, 'presences');

export default Presence;
