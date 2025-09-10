import { EnduranceSchema, EnduranceModelType, ObjectId } from '@programisto/endurance-core';
import WorkContractModel, { ContractType, WorkTimeType } from './work-contract.model.js';
import { Types } from 'mongoose';

enum LeaveType {
    PAID = 'PAID',           // Congés payés
    RTT = 'RTT',             // RTT
    EXCEPTIONAL = 'EXCEPTIONAL', // Congés exceptionnels
    UNPAID = 'UNPAID',       // Congés sans solde
    SICK = 'SICK',           // Maladie
    NONE = 'NONE'            // Aucun congé disponible
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

    @EnduranceModelType.prop({ type: [Types.ObjectId], ref: 'ContractDocument', default: [] })
    public documents!: Types.ObjectId[];

    public static getModel() {
        return LeaveModel;
    }
}


const LeaveModel = EnduranceModelType.getModelForClass(Leave);


// Ajouter la méthode statique au modèle
(LeaveModel as any).getAvailableLeaveTypes = async function (userId: ObjectId): Promise<LeaveType[]> {
    try {
        // Récupérer le contrat actif de l'utilisateur
        const activeContract = await WorkContractModel.findOne({
            user: userId,
            isActive: true
        }).exec();

        if (!activeContract) {
            // Si pas de contrat actif, retourner NONE
            return [LeaveType.NONE];
        }

        const { contractType, weeklyHours, hasRTT } = activeContract;

        // Logique selon le type de contrat
        switch (contractType) {
            case ContractType.INTERNSHIP:
                return [LeaveType.UNPAID, LeaveType.SICK];

            case ContractType.FREELANCE:
                return [LeaveType.UNPAID];

            case ContractType.CDI:
            case ContractType.CDD:
            case ContractType.APPRENTICESHIP:
            case ContractType.PROFESSIONAL:
                // Si CDI 37.5h avec RTT
                if (weeklyHours === WorkTimeType.HOURS_37_5 && hasRTT) {
                    return [LeaveType.PAID, LeaveType.RTT, LeaveType.EXCEPTIONAL, LeaveType.UNPAID, LeaveType.SICK];
                }
                // Sinon (CDI 35h, CDD, apprentissage, contrat pro)
                return [LeaveType.PAID, LeaveType.EXCEPTIONAL, LeaveType.UNPAID, LeaveType.SICK];

            default:
                return [LeaveType.NONE];
        }
    } catch (error) {
        console.error('Erreur lors de la récupération des options de congés:', error);
        return [LeaveType.NONE]; // Fallback
    }
};

export default LeaveModel;
