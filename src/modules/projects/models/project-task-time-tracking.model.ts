import { EnduranceSchema, EnduranceModelType, EnduranceDocumentType } from '@programisto/endurance-core';
import { Types } from 'mongoose';

@EnduranceModelType.modelOptions({
    schemaOptions: {
        collection: 'project_task_time_tracking',
        timestamps: true,
        toObject: { virtuals: true },
        toJSON: { virtuals: true },
        _id: true,
        validateBeforeSave: false,
        strict: false
    }
})
class ProjectTaskTimeTracking extends EnduranceSchema {
    @EnduranceModelType.prop({ type: Types.ObjectId, ref: 'ProjectTask', required: true })
    public task!: Types.ObjectId;

    @EnduranceModelType.prop({ type: Types.ObjectId, ref: 'UserAdmin', required: true })
    public user!: Types.ObjectId;

    @EnduranceModelType.prop({ required: true })
    public date!: Date; // Date de la session de travail

    @EnduranceModelType.prop({ required: true, min: 0 })
    public hours!: number; // Nombre d'heures travaillées

    @EnduranceModelType.prop()
    public description?: string; // Description du travail effectué

    @EnduranceModelType.prop({
        type: String,
        enum: ['DEVELOPMENT', 'TESTING', 'REVIEW', 'MEETING', 'DOCUMENTATION', 'OTHER'],
        default: 'DEVELOPMENT'
    })
    public workType!: 'DEVELOPMENT' | 'TESTING' | 'REVIEW' | 'MEETING' | 'DOCUMENTATION' | 'OTHER';

    @EnduranceModelType.prop({ default: true })
    public isBillable!: boolean; // Si le temps est facturable

    @EnduranceModelType.prop()
    public notes?: string; // Notes additionnelles

    public static getModel() {
        return ProjectTaskTimeTrackingModel;
    }
}

const ProjectTaskTimeTrackingModel = EnduranceModelType.getModelForClass(ProjectTaskTimeTracking);
export default ProjectTaskTimeTrackingModel;
export type ProjectTaskTimeTrackingDocument = EnduranceDocumentType<ProjectTaskTimeTracking>;
