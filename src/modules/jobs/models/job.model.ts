import { EnduranceSchema, EnduranceModelType, ObjectId } from '@programisto/endurance-core';
import { Types } from 'mongoose';

export enum ContractType {
    CDI = 'CDI',
    CDD = 'CDD',
    FREELANCE = 'FREELANCE',
    INTERNSHIP = 'STAGE'
}

export enum WorkMode {
    HYBRID = 'HYBRIDE',
    ON_SITE = 'PRESENTIEL',
    REMOTE = 'REMOTE'
}

export enum ExperienceLevel {
    JUNIOR = 'JUNIOR',
    CONFIRMED = 'CONFIRMED',
    SENIOR = 'SENIOR'
}

export enum JobStatus {
    DRAFT = 'DRAFT',
    PUBLISHED = 'PUBLISHED',
    CLOSED = 'CLOSED'
}

@EnduranceModelType.modelOptions({
    options: {
        allowMixed: EnduranceModelType.Severity.ALLOW
    }
})
@EnduranceModelType.pre<Job>('save', async function (this: Job, next) {
    try {
        this.status = this.status.toUpperCase() as JobStatus;
        this.contractType = this.contractType.toUpperCase() as ContractType;
        this.workMode = this.workMode.toUpperCase() as WorkMode;
        if (this.experienceLevel) {
            this.experienceLevel = this.experienceLevel.toUpperCase() as ExperienceLevel;
        }
        next();
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        next(new Error('Erreur lors du pré-enregistrement: ' + errorMessage));
    }
})
class Job extends EnduranceSchema {
    @EnduranceModelType.prop({ required: true })
    public title!: string;

    @EnduranceModelType.prop({ required: true })
    public description!: string;

    @EnduranceModelType.prop({ required: true, enum: ContractType })
    public contractType!: ContractType;

    @EnduranceModelType.prop({ required: true, default: 'Bordeaux' })
    public location!: string;

    @EnduranceModelType.prop({ required: true, enum: WorkMode, default: WorkMode.HYBRID })
    public workMode!: WorkMode;

    @EnduranceModelType.prop({ required: false, enum: ExperienceLevel })
    public experienceLevel!: ExperienceLevel;

    @EnduranceModelType.prop({ required: false, type: Number })
    public minSalary!: number;

    @EnduranceModelType.prop({ required: false, type: Number })
    public maxSalary!: number;

    @EnduranceModelType.prop({ type: [String], required: true })
    public requiredSkills!: string[];

    @EnduranceModelType.prop({ type: [Types.ObjectId], ref: 'JobApplication', default: [] })
    public applications!: Types.ObjectId[];

    @EnduranceModelType.prop({ required: true, enum: JobStatus, default: JobStatus.DRAFT })
    public status!: JobStatus;

    public static getModel() {
        return JobModel;
    }
}

const JobModel = EnduranceModelType.getModelForClass(Job);
export default JobModel;