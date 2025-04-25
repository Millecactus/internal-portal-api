import { EnduranceSchema, EnduranceModelType } from 'endurance-core';
import { Types } from 'mongoose';

@EnduranceModelType.modelOptions({
    options: {
        allowMixed: EnduranceModelType.Severity.ALLOW
    }
})
class Group extends EnduranceSchema {
    @EnduranceModelType.prop({ required: true })
    public name!: string;

    @EnduranceModelType.prop({ required: true })
    public description!: string;

    @EnduranceModelType.prop({ type: [Types.ObjectId], default: [] })
    public users!: Types.ObjectId[];

    public static getModel() {
        return GroupModel;
    }
}

const GroupModel = EnduranceModelType.getModelForClass(Group);
export default GroupModel;
