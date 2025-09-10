import { EnduranceSchema, EnduranceModelType, EnduranceDocumentType } from '@programisto/endurance-core';
import { Types } from 'mongoose';

@EnduranceModelType.modelOptions({
    schemaOptions: {
        collection: 'user_contacts',
        timestamps: true,
        toObject: { virtuals: true },
        toJSON: { virtuals: true },
        _id: true,
        validateBeforeSave: false,
        strict: false
    }
})
class Contact extends EnduranceSchema {

    @EnduranceModelType.prop({ required: true, unique: true })
    email!: string;

    @EnduranceModelType.prop({ required: false })
    firstname?: string;

    @EnduranceModelType.prop({ required: false })
    lastname?: string;

    @EnduranceModelType.prop({ required: false, type: Types.ObjectId, ref: 'File' })
    profilePhoto?: Types.ObjectId;

    @EnduranceModelType.prop({ required: false })
    birthDate?: Date;

    @EnduranceModelType.prop({ required: false })
    phone?: string;

    @EnduranceModelType.prop({ required: false })
    discordId?: string;

    @EnduranceModelType.prop({ required: false })
    linkedin?: string;

    public static getModel() {
        return ContactModel;
    }
}

const ContactModel = EnduranceModelType.getModelForClass(Contact);
export default ContactModel;
export type ContactDocument = EnduranceDocumentType<Contact>;
