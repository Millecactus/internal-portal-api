import { EnduranceSchema, EnduranceModelType, EnduranceDocumentType } from 'endurance-core';
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
class UserAdmin extends EnduranceSchema {

    @EnduranceModelType.prop({ required: true, unique: true })
    email!: string;

    @EnduranceModelType.prop({ required: true })
    firstname!: string;

    @EnduranceModelType.prop({ required: true })
    lastname!: string;

    public static getModel() {
        return UserModel;
    }
}

const UserModel = EnduranceModelType.getModelForClass(UserAdmin);
export default UserModel;
export type UserDocument = EnduranceDocumentType<UserAdmin>;
