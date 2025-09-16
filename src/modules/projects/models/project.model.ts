import { EnduranceSchema, EnduranceModelType, EnduranceDocumentType } from '@programisto/endurance-core';
import { Types } from 'mongoose';

@EnduranceModelType.modelOptions({
    schemaOptions: {
        collection: 'projects',
        timestamps: true,
        toObject: { virtuals: true },
        toJSON: { virtuals: true },
        _id: true,
        validateBeforeSave: false,
        strict: false
    }
})
class Project extends EnduranceSchema {
    @EnduranceModelType.prop({ required: true })
    public title!: string;

    @EnduranceModelType.prop({ required: true })
    public description!: string;

    @EnduranceModelType.prop({ required: true })
    public startDate!: Date;

    @EnduranceModelType.prop()
    public endDate?: Date;

    @EnduranceModelType.prop({ type: Types.ObjectId, ref: 'UserAdmin', required: true })
    public accountManager!: Types.ObjectId;

    @EnduranceModelType.prop({ type: Types.ObjectId, ref: 'Organization', required: true })
    public client!: Types.ObjectId;

    @EnduranceModelType.prop({ type: Types.ObjectId, ref: 'Contact' })
    public clientSponsor?: Types.ObjectId;

    @EnduranceModelType.prop({ type: [String], default: [] })
    public categories!: string[];

    @EnduranceModelType.prop({ type: [String], default: [] })
    public tags!: string[];

    @EnduranceModelType.prop({ type: [Types.ObjectId], ref: 'Note', default: [] })
    public notes!: Types.ObjectId[];

    @EnduranceModelType.prop({ type: [Types.ObjectId], default: [] })
    public documents!: Types.ObjectId[];

    @EnduranceModelType.prop({ type: Types.ObjectId })
    public logo?: Types.ObjectId;

    @EnduranceModelType.prop()
    public pnl?: string;

    @EnduranceModelType.prop()
    public team?: string;

    @EnduranceModelType.prop({
        type: String,
        enum: ['TIME_AND_MATERIALS', 'FIXED_PRICE'],
        default: 'TIME_AND_MATERIALS'
    })
    public billingType!: 'TIME_AND_MATERIALS' | 'FIXED_PRICE';

    @EnduranceModelType.prop()
    public fixedPrice?: number;

    @EnduranceModelType.prop({ type: [Types.ObjectId], ref: 'ProjectUser', default: [] })
    public assignedUsers!: Types.ObjectId[];

    @EnduranceModelType.prop({ type: [Types.ObjectId], ref: 'ProjectTask', default: [] })
    public tasks!: Types.ObjectId[];

    @EnduranceModelType.prop({
        type: String,
        enum: ['PLANNING', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED', 'CANCELLED'],
        default: 'PLANNING'
    })
    public status!: 'PLANNING' | 'IN_PROGRESS' | 'ON_HOLD' | 'COMPLETED' | 'CANCELLED';

    @EnduranceModelType.prop({ default: 0 })
    public progress!: number; // Pourcentage de progression (0-100)

    @EnduranceModelType.prop()
    public budget?: number;

    @EnduranceModelType.prop({ default: true })
    public isActive!: boolean;

    public static getModel() {
        return ProjectModel;
    }
}

const ProjectModel = EnduranceModelType.getModelForClass(Project);
export default ProjectModel;
export type ProjectDocument = EnduranceDocumentType<Project>;
