import { EnduranceSchema, EnduranceModelType, ObjectId } from '@programisto/endurance-core';
import { Types } from 'mongoose';

enum AssetStatus {
    ORDERED = 'ORDERED',           // Commandé
    ACTIVE = 'ACTIVE',             // Actif
    ARCHIVED = 'ARCHIVED',         // Archivé
    INCIDENT = 'INCIDENT'          // Incident en cours
}

@EnduranceModelType.modelOptions({
    options: {
        allowMixed: EnduranceModelType.Severity.ALLOW
    }
})
class Asset extends EnduranceSchema {
    @EnduranceModelType.prop({ required: true })
    public name!: string;

    @EnduranceModelType.prop()
    public description?: string;

    @EnduranceModelType.prop()
    public serialNumber?: string;

    @EnduranceModelType.prop({ type: Types.ObjectId, ref: 'File' })
    public image?: ObjectId;

    @EnduranceModelType.prop({ type: Types.ObjectId, ref: 'User' })
    public assignedUser?: ObjectId;

    @EnduranceModelType.prop({ type: [Types.ObjectId], ref: 'Note', default: [] })
    public notes!: Types.ObjectId[];

    @EnduranceModelType.prop({ required: true, enum: AssetStatus, default: AssetStatus.ORDERED })
    public status!: AssetStatus;

    @EnduranceModelType.prop({ type: [String], default: [] })
    public categories!: string[];

    @EnduranceModelType.prop({ type: [Types.ObjectId], ref: 'File', default: [] })
    public documents!: Types.ObjectId[];

    public static getModel() {
        return AssetModel;
    }
}

const AssetModel = EnduranceModelType.getModelForClass(Asset);

export default AssetModel;
export { AssetStatus };
