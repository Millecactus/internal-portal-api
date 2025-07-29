import { EnduranceSchema, EnduranceModelType, ObjectId, } from '@programisto/endurance-core';

enum CooptationStatus {
    Sent = 'Sent',
    Processing = 'Processing',
    KO = 'KO',
    Hired = 'Hired'
}

@EnduranceModelType.modelOptions({
    options: {
        allowMixed: EnduranceModelType.Severity.ALLOW
    }
})
class Cooptation extends EnduranceSchema {

    @EnduranceModelType.prop({ required: true })
    public cooptationUserId!: ObjectId;

    @EnduranceModelType.prop({ required: true })
    public lastname!: string;

    @EnduranceModelType.prop({ required: true })
    public firstname!: string;

    @EnduranceModelType.prop({ required: true })
    public email!: string;

    @EnduranceModelType.prop({ required: true })
    public phone!: string;

    @EnduranceModelType.prop({ required: true })
    public linkedinUrl!: string;

    @EnduranceModelType.prop({ required: true })
    public note!: string;

    @EnduranceModelType.prop({ required: true, enum: CooptationStatus, default: CooptationStatus.Sent })
    public status!: CooptationStatus;

    public static getModel() {
        return CooptationModel;
    }
}

const CooptationModel = EnduranceModelType.getModelForClass(Cooptation);
export default CooptationModel;
