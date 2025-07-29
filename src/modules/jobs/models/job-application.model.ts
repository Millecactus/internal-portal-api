import { EnduranceSchema, EnduranceModelType, ObjectId } from '@programisto/endurance-core';
import { Types } from 'mongoose';

export enum ApplicationStatus {
    IN_PROGRESS = 'IN_PROGRESS',
    ACCEPTED = 'ACCEPTED',
    REJECTED = 'REJECTED'
}

export enum ApplicationStep {
    TO_CONTACT = 'TO_CONTACT',
    PREQUALIFICATION_PLANNED = 'PREQUALIFICATION_PLANNED',
    PREQUALIFICATION_DONE = 'PREQUALIFICATION_DONE',
    TECHNICAL_INTERVIEW_PLANNED = 'TECHNICAL_INTERVIEW_PLANNED',
    TECHNICAL_INTERVIEW_DONE = 'TECHNICAL_INTERVIEW_DONE',
    MANAGER_INTERVIEW_PLANNED = 'MANAGER_INTERVIEW_PLANNED',
    MANAGER_INTERVIEW_DONE = 'MANAGER_INTERVIEW_DONE',
    OFFER_SENT = 'OFFER_SENT',
    OFFER_VALIDATED = 'OFFER_VALIDATED',
    PROFILE_ON_MISSION = 'PROFILE_ON_MISSION',
    FREELANCE_ON_MISSION = 'FREELANCE_ON_MISSION'
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

class PrequalificationInfo {
    @EnduranceModelType.prop()
    public currentSalary?: number;

    @EnduranceModelType.prop()
    public expectedSalary?: number;

    @EnduranceModelType.prop()
    public notes?: string;

    @EnduranceModelType.prop()
    public date?: Date;
}

class TechnicalInterviewInfo {
    @EnduranceModelType.prop()
    public notes?: string;

    @EnduranceModelType.prop()
    public date?: Date;

    @EnduranceModelType.prop()
    public score?: number;
}

class ManagerInterviewInfo {
    @EnduranceModelType.prop()
    public notes?: string;

    @EnduranceModelType.prop()
    public date?: Date;

    @EnduranceModelType.prop()
    public score?: number;
}

class OfferInfo {
    @EnduranceModelType.prop()
    public amount?: number;

    @EnduranceModelType.prop()
    public sentDate?: Date;

    @EnduranceModelType.prop()
    public validationDate?: Date;
}

class MissionInfo {
    @EnduranceModelType.prop()
    public startDate?: Date;

    @EnduranceModelType.prop()
    public endDate?: Date;

    @EnduranceModelType.prop()
    public notes?: string;
}

@EnduranceModelType.modelOptions({
    options: {
        allowMixed: EnduranceModelType.Severity.ALLOW
    },
    schemaOptions: {
        collection: 'jobapplications',
        timestamps: true,
        toObject: { virtuals: true },
        toJSON: { virtuals: true },
        _id: true,
        validateBeforeSave: false,
        strict: false
    }

})
class JobApplication extends EnduranceSchema {
    @EnduranceModelType.prop({ required: true, ref: 'Job' })
    public jobId!: Types.ObjectId;

    @EnduranceModelType.prop({ required: true, ref: 'Candidate' })
    public candidateId!: Types.ObjectId;

    @EnduranceModelType.prop({ required: true, enum: ApplicationStatus, default: ApplicationStatus.IN_PROGRESS })
    public status!: ApplicationStatus;

    @EnduranceModelType.prop({ required: true, enum: ApplicationStep, default: ApplicationStep.TO_CONTACT })
    public step!: ApplicationStep;

    @EnduranceModelType.prop({ required: true, type: Date, default: Date.now })
    public createdAt!: Date;

    @EnduranceModelType.prop({ required: true, type: Date, default: Date.now })
    public updatedAt!: Date;

    @EnduranceModelType.prop({ type: String })
    public message?: string;

    @EnduranceModelType.prop({ required: false, type: [ApplicationDocument], default: [] })
    public documents!: ApplicationDocument[];

    @EnduranceModelType.prop()
    public rejectionReason?: string;

    @EnduranceModelType.prop()
    public prequalificationInfo?: PrequalificationInfo;

    @EnduranceModelType.prop()
    public technicalInterviewInfo?: TechnicalInterviewInfo;

    @EnduranceModelType.prop()
    public managerInterviewInfo?: ManagerInterviewInfo;

    @EnduranceModelType.prop()
    public offerInfo?: OfferInfo;

    @EnduranceModelType.prop()
    public missionInfo?: MissionInfo;

    public static getModel() {
        return JobApplicationModel;
    }
}

const JobApplicationModel = EnduranceModelType.getModelForClass(JobApplication);
export default JobApplicationModel; 