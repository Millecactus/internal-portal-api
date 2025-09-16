import { EnduranceSchema, EnduranceModelType, EnduranceDocumentType } from '@programisto/endurance-core';
import { Types } from 'mongoose';

@EnduranceModelType.modelOptions({
    schemaOptions: {
        collection: 'project_users',
        timestamps: true,
        toObject: { virtuals: true },
        toJSON: { virtuals: true },
        _id: true,
        validateBeforeSave: false,
        strict: false
    }
})
class ProjectUser extends EnduranceSchema {
    @EnduranceModelType.prop({ type: Types.ObjectId, ref: 'Project', required: true })
    public project!: Types.ObjectId;

    @EnduranceModelType.prop({ type: Types.ObjectId, ref: 'UserAdmin', required: true })
    public user!: Types.ObjectId;

    @EnduranceModelType.prop({ required: true })
    public dailyRate!: number; // TJM en euros

    @EnduranceModelType.prop({ required: true })
    public startDate!: Date;

    @EnduranceModelType.prop()
    public endDate?: Date;

    @EnduranceModelType.prop({
        type: String,
        enum: ['ACTIVE', 'INACTIVE', 'COMPLETED'],
        default: 'ACTIVE'
    })
    public status!: 'ACTIVE' | 'INACTIVE' | 'COMPLETED';

    @EnduranceModelType.prop()
    public role?: string; // Rôle dans le projet (ex: "Développeur", "Chef de projet", etc.)

    @EnduranceModelType.prop({ default: 100 })
    public allocation!: number; // Pourcentage d'allocation (0-100)

    @EnduranceModelType.prop()
    public notes?: string;

    public static getModel() {
        return ProjectUserModel;
    }
}

const ProjectUserModel = EnduranceModelType.getModelForClass(ProjectUser);
export default ProjectUserModel;
export type ProjectUserDocument = EnduranceDocumentType<ProjectUser>;
