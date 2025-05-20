import { EnduranceSchema, EnduranceModelType, ObjectId } from 'endurance-core';
import { Types } from 'mongoose';

export enum ApplicationStatus {
    IN_PROGRESS = 'IN_PROGRESS',
    ACCEPTED = 'ACCEPTED',
    REJECTED = 'REJECTED'
}


class ApplicationDocument {
    @EnduranceModelType.prop({ required: true })
    public name!: string;

    @EnduranceModelType.prop({ required: true })
    public type!: string;

    @EnduranceModelType.prop({ required: true })
    public path!: string;

    @EnduranceModelType.prop({ required: true, type: Date, default: Date.now })
    public uploadedAt!: Date;
}


@EnduranceModelType.modelOptions({
    options: {
        allowMixed: EnduranceModelType.Severity.ALLOW
    }
})
class JobApplication extends EnduranceSchema {
    @EnduranceModelType.prop({ required: true, ref: 'Job' })
    public jobId!: Types.ObjectId;

    @EnduranceModelType.prop({ required: true, ref: 'Candidate' })
    public candidateId!: Types.ObjectId;

    @EnduranceModelType.prop({ required: true, enum: ApplicationStatus, default: ApplicationStatus.IN_PROGRESS })
    public status!: ApplicationStatus;

    @EnduranceModelType.prop({ required: true, type: Date, default: Date.now })
    public createdAt!: Date;

    @EnduranceModelType.prop({ required: true, type: Date, default: Date.now })
    public updatedAt!: Date;

    @EnduranceModelType.prop({ type: [ApplicationDocument], default: [] })
    public documents!: ApplicationDocument[];

    @EnduranceModelType.prop()
    public rejectionReason?: string;

    public static getModel() {
        return JobApplicationModel;
    }
}

const JobApplicationModel = EnduranceModelType.getModelForClass(JobApplication);
export default JobApplicationModel; 