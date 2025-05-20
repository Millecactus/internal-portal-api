import { EnduranceSchema, EnduranceModelType } from 'endurance-core';

@EnduranceModelType.modelOptions({
    schemaOptions: {
        collection: 'roles',
        timestamps: true,
        _id: true,
        validateBeforeSave: false
    }
})
class Role extends EnduranceSchema {

    @EnduranceModelType.prop({ required: true, unique: true })
    public name!: string;

    public static getModel() {
        return RoleModel;
    }
}
const RoleModel = EnduranceModelType.getModelForClass(Role, {
    schemaOptions: {
        collection: 'roles',
        timestamps: true,
        toObject: { virtuals: true },
        toJSON: { virtuals: true },
        validateBeforeSave: false
    }
});
export default RoleModel;
