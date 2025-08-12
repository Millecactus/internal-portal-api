import { EnduranceSchema, EnduranceModelType, EnduranceDocumentType } from '@programisto/endurance-core';
import Role from './role.model.js';

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

    @EnduranceModelType.prop({ required: false, unique: false })
    backupEmail!: string;

    @EnduranceModelType.prop({ required: false, select: false })
    password?: string;

    @EnduranceModelType.prop({ required: true })
    firstname!: string;

    @EnduranceModelType.prop({ required: true })
    lastname!: string;

    @EnduranceModelType.prop({ ref: () => Role, required: false })
    roles?: typeof Role[];

    @EnduranceModelType.prop({ required: false, default: true })
    isActive!: boolean;

    public static getModel() {
        return UserAdminModel;
    }
}

const UserAdminModel = EnduranceModelType.getModelForClass(UserAdmin);
export default UserAdminModel;
export type UserAdminDocument = EnduranceDocumentType<UserAdmin>;
