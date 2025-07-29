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
class Job extends EnduranceSchema {
    @EnduranceModelType.prop({ required: true })
    public title!: string;



    public static getModel() {
        return JobModel;
    }
}

const JobModel = EnduranceModelType.getModelForClass(Job);
export default JobModel;