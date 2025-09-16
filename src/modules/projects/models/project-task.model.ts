import { EnduranceSchema, EnduranceModelType, EnduranceDocumentType } from '@programisto/endurance-core';
import { Types } from 'mongoose';

@EnduranceModelType.modelOptions({
    schemaOptions: {
        collection: 'project_tasks',
        timestamps: true,
        toObject: { virtuals: true },
        toJSON: { virtuals: true },
        _id: true,
        validateBeforeSave: false,
        strict: false
    }
})
class ProjectTask extends EnduranceSchema {
    @EnduranceModelType.prop({ type: Types.ObjectId, ref: 'Project', required: true })
    public project!: Types.ObjectId;

    @EnduranceModelType.prop({ required: true })
    public title!: string;

    @EnduranceModelType.prop({ required: true })
    public description!: string;

    @EnduranceModelType.prop({ required: true })
    public startDate!: Date;

    @EnduranceModelType.prop()
    public endDate?: Date;

    @EnduranceModelType.prop()
    public estimatedHours?: number; // Temps prévu en heures

    @EnduranceModelType.prop({ default: 0 })
    public actualHours!: number; // Temps total réel passé en heures (calculé automatiquement)

    @EnduranceModelType.prop({ type: Types.ObjectId, ref: 'UserAdmin' })
    public assignedTo?: Types.ObjectId; // Utilisateur principal responsable de la tâche

    @EnduranceModelType.prop({ type: [Types.ObjectId], ref: 'UserAdmin', default: [] })
    public contributors!: Types.ObjectId[]; // Utilisateurs qui contribuent à la tâche

    @EnduranceModelType.prop({ type: [Types.ObjectId], ref: 'Note', default: [] })
    public notes!: Types.ObjectId[];

    @EnduranceModelType.prop({ type: [Types.ObjectId], default: [] })
    public documents!: Types.ObjectId[];

    @EnduranceModelType.prop({ type: [String], default: [] })
    public tags!: string[];

    @EnduranceModelType.prop({ type: [String], default: [] })
    public categories!: string[];

    @EnduranceModelType.prop({
        type: String,
        enum: ['TODO', 'IN_PROGRESS', 'REVIEW', 'TESTING', 'COMPLETED', 'CANCELLED'],
        default: 'TODO'
    })
    public status!: 'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'TESTING' | 'COMPLETED' | 'CANCELLED';

    @EnduranceModelType.prop({
        type: String,
        enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
        default: 'MEDIUM'
    })
    public priority!: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

    @EnduranceModelType.prop({ default: 0 })
    public progress!: number; // Pourcentage de progression (0-100)

    @EnduranceModelType.prop({ type: Types.ObjectId, ref: 'ProjectTask' })
    public parentTask?: Types.ObjectId; // Pour les sous-tâches

    @EnduranceModelType.prop({ type: [Types.ObjectId], ref: 'ProjectTask', default: [] })
    public subtasks!: Types.ObjectId[];

    @EnduranceModelType.prop({ default: true })
    public isActive!: boolean;

    public static getModel() {
        return ProjectTaskModel;
    }
}

const ProjectTaskModel = EnduranceModelType.getModelForClass(ProjectTask);
export default ProjectTaskModel;
export type ProjectTaskDocument = EnduranceDocumentType<ProjectTask>;
