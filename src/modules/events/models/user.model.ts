import { enduranceEmitter, enduranceEventTypes, EnduranceSchema, EnduranceModelType, EnduranceDocumentType, ObjectId } from '@programisto/endurance-core';



@EnduranceModelType.modelOptions({
    schemaOptions: {
        collection: 'users',
        timestamps: true,
        toObject: { virtuals: true },
        toJSON: { virtuals: true },
        _id: true,
        validateBeforeSave: false,
        strict: false
    }
})
class UserEvent extends EnduranceSchema {
    @EnduranceModelType.prop({ required: true, unique: true })
    public email!: string;

    @EnduranceModelType.prop({ required: true })
    public firstname!: string;

    @EnduranceModelType.prop({ required: true })
    public lastname!: string;

    public static getModel() {
        return UserEventModel;
    }
}


const UserEventModel = EnduranceModelType.getModelForClass(UserEvent);
export default UserEventModel;
