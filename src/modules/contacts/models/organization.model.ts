import { EnduranceSchema, EnduranceModelType } from '@programisto/endurance-core';
import { Types } from 'mongoose';

@EnduranceModelType.modelOptions({
    options: {
        allowMixed: EnduranceModelType.Severity.ALLOW
    }
})
class Organization extends EnduranceSchema {
    @EnduranceModelType.prop({ required: true })
    public name!: string;

    @EnduranceModelType.prop()
    public description?: string;

    @EnduranceModelType.prop()
    public website?: string;

    @EnduranceModelType.prop()
    public email?: string;

    @EnduranceModelType.prop()
    public phone?: string;

    @EnduranceModelType.prop()
    public address?: string;

    @EnduranceModelType.prop()
    public city?: string;

    @EnduranceModelType.prop()
    public postalCode?: string;

    @EnduranceModelType.prop()
    public country?: string;

    @EnduranceModelType.prop()
    public industry?: string;

    @EnduranceModelType.prop()
    public size?: string;

    @EnduranceModelType.prop()
    public siret?: string;

    @EnduranceModelType.prop()
    public siren?: string;

    @EnduranceModelType.prop()
    public vatNumber?: string;

    @EnduranceModelType.prop()
    public legalForm?: string;

    @EnduranceModelType.prop()
    public capital?: string;

    @EnduranceModelType.prop()
    public registrationDate?: Date;

    @EnduranceModelType.prop({ type: [Types.ObjectId], ref: 'Contact', default: [] })
    public contacts!: Types.ObjectId[];

    public static getModel() {
        return OrganizationModel;
    }
}

const OrganizationModel = EnduranceModelType.getModelForClass(Organization);
export default OrganizationModel;
