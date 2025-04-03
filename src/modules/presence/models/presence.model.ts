import { EnduranceSchema, EnduranceModelType } from 'endurance-core';
import User from '../../levelling/models/user.model.js';

@EnduranceModelType.pre<Presence>('save', async function (this: Presence, next) {
  try {
    const startOfDay = new Date(this.date);
    startOfDay.setHours(0, 0, 0, 0);
    const noon = new Date(this.date);
    noon.setHours(12, 0, 0, 0);
    const endOfDay = new Date(this.date);
    endOfDay.setHours(23, 59, 59, 999);

    let query;
    if (this.date < noon) {
      query = { user: this.user, date: { $gte: startOfDay, $lt: noon } };
    } else {
      query = { user: this.user, date: { $gte: noon, $lte: endOfDay } };
    }

    await PresenceModel.deleteMany(query);
    next();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    next(new Error('Erreur lors du pré-enregistrement: ' + errorMessage));
  }
})
class Presence extends EnduranceSchema {
  @EnduranceModelType.prop({ required: true, ref: 'User' })
  public user!: typeof User;

  @EnduranceModelType.prop({
    required: true,
    enum: ['office', 'client', 'remote', 'school', 'away']
  })
  public type!: string;

  @EnduranceModelType.prop({ required: true })
  public date!: Date;

  public static getModel() {
    return PresenceModel;
  }
}

const PresenceModel = EnduranceModelType.getModelForClass(Presence, {
  schemaOptions: { collection: 'presences' }
});
export default PresenceModel;
