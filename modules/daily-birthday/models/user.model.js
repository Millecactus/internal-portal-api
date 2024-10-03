import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  firstname: {
    type: String,
    required: true,
  },
  lastname: {
    type: String,
    required: true,
  },
  birthday: {
    type: Date,
    required: true,
  },
  discordId: {
    type: String,
    required: true,
  },
  office365Id: {
    type: String,
    required: true,
  },
});

userSchema.statics.getUsersWithBirthdayToday = async function() {
  const today = new Date();
  const month = today.getMonth() + 1; // Les mois sont indexés à partir de 0
  const day = today.getDate();

  return this.find({
    $expr: {
      $and: [
        { $eq: [{ $month: "$birthday" }, month] },
        { $eq: [{ $dayOfMonth: "$birthday" }, day] }
      ]
    }
  });
};

const User = mongoose.model('User', userSchema, 'users');

export default User;
