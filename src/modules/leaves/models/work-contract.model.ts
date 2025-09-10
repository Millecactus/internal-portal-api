import { EnduranceSchema, EnduranceModelType, EnduranceDocumentType } from '@programisto/endurance-core';
import { Types } from 'mongoose';

// Types de contrats disponibles (copié du module work-contract)
export enum ContractType {
    CDI = 'CDI',
    CDD = 'CDD',
    APPRENTICESHIP = 'Contrat d\'apprentissage',
    PROFESSIONAL = 'Contrat pro',
    INTERNSHIP = 'Stage',
    FREELANCE = 'Freelance'
}

// Types de temps de travail (copié du module work-contract)
export enum WorkTimeType {
    HOURS_35 = '35h',
    HOURS_37_5 = '37.5h',
    DAYS_FORFAIT = 'Forfait jours'
}

// Modèle WorkContract simplifié pour le module leaves (sans dépendances)
@EnduranceModelType.modelOptions({
    schemaOptions: {
        collection: 'work_contracts',
        timestamps: true
    }
})
class WorkContract extends EnduranceSchema {
    @EnduranceModelType.prop({ required: true })
    public user!: Types.ObjectId;

    @EnduranceModelType.prop({
        type: String,
        enum: Object.values(ContractType),
        required: true
    })
    public contractType!: ContractType;

    @EnduranceModelType.prop({
        type: String,
        enum: Object.values(WorkTimeType),
        required: true
    })
    public weeklyHours!: WorkTimeType;

    @EnduranceModelType.prop({ required: true, default: false })
    public hasRTT!: boolean;

    @EnduranceModelType.prop({ required: true, default: false })
    public isActive!: boolean;

    public static getModel() {
        return WorkContractModel;
    }
}

const WorkContractModel = EnduranceModelType.getModelForClass(WorkContract);

export default WorkContractModel;
export type WorkContractDocument = EnduranceDocumentType<WorkContract>;
