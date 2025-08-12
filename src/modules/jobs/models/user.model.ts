import { EnduranceSchema, EnduranceModelType, EnduranceDocumentType } from '@programisto/endurance-core';
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
class UserJobsAdmin extends EnduranceSchema {

    @EnduranceModelType.prop({ required: true, unique: true })
    email!: string;

    @EnduranceModelType.prop({ required: true })
    firstname!: string;

    @EnduranceModelType.prop({ required: true })
    lastname!: string;

    public static getModel() {
        return UserJobsModel;
    }
}

const UserJobsModel = EnduranceModelType.getModelForClass(UserJobsAdmin);
export default UserJobsModel;
export type UserJobsDocument = EnduranceDocumentType<UserJobsAdmin>;
