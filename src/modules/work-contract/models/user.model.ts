import { EnduranceSchema, EnduranceModelType, EnduranceDocumentType } from '@programisto/endurance-core';
import { Types } from 'mongoose';
import WorkContract from './work-contract.model.js';

@EnduranceModelType.modelOptions({
    schemaOptions: {
        collection: 'work_contract_users',
        timestamps: true,
        toObject: { virtuals: true },
        toJSON: { virtuals: true },
        _id: true,
        validateBeforeSave: false,
        strict: false
    }
})
class User extends EnduranceSchema {
    @EnduranceModelType.prop({ required: true })
    public firstname!: string;

    @EnduranceModelType.prop({ required: true })
    public lastname!: string;

    @EnduranceModelType.prop({ type: [Types.ObjectId], ref: 'WorkContract', default: [] })
    public workContracts!: Types.ObjectId[];

    @EnduranceModelType.prop({ required: false, default: true })
    public isActive!: boolean;

    public static getModel() {
        return UserModel;
    }
}

const UserModel = EnduranceModelType.getModelForClass(User);
export default UserModel;
export type UserDocument = EnduranceDocumentType<User>;
