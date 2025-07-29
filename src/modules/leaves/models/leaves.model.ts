import { EnduranceSchema, EnduranceModelType, ObjectId } from '@programisto/endurance-core';

enum LeaveType {
    PAID = 'PAID',           // Congés payés
    RTT = 'RTT',             // RTT
    EXCEPTIONAL = 'EXCEPTIONAL', // Congés exceptionnels
    UNPAID = 'UNPAID',       // Congés sans solde
    SICK = 'SICK'            // Maladie
}

enum LeaveStatus {
    PENDING = 'PENDING',     // En attente
    APPROVED = 'APPROVED',   // Approuvé
    REJECTED = 'REJECTED',   // Rejeté
    CANCELLED = 'CANCELLED'  // Annulé
}

@EnduranceModelType.modelOptions({
    options: {
        allowMixed: EnduranceModelType.Severity.ALLOW
    }
})
class Leave extends EnduranceSchema {
    @EnduranceModelType.prop({ required: true })
    public userId!: ObjectId;

    @EnduranceModelType.prop({ required: true })
    public startDate!: Date;

    @EnduranceModelType.prop({ required: true })
    public endDate!: Date;

    @EnduranceModelType.prop({ required: true, enum: LeaveType })
    public type!: LeaveType;

    @EnduranceModelType.prop({ required: true, enum: LeaveStatus, default: LeaveStatus.PENDING })
    public status!: LeaveStatus;

    @EnduranceModelType.prop()
    public comment?: string;

    @EnduranceModelType.prop()
    public approvedBy?: ObjectId;

    @EnduranceModelType.prop()
    public approvedAt?: Date;

    @EnduranceModelType.prop()
    public rejectionReason?: string;

    public static getModel() {
        return LeaveModel;
    }
}

const LeaveModel = EnduranceModelType.getModelForClass(Leave);
export default LeaveModel;
