import { EnduranceSchema, EnduranceModelType, EnduranceDocumentType } from '@programisto/endurance-core';
import { Types } from 'mongoose';
import User from './user.model.js';

// Types de contrats disponibles
export enum ContractType {
    CDI = 'CDI',
    CDD = 'CDD',
    APPRENTICESHIP = 'Contrat d\'apprentissage',
    PROFESSIONAL = 'Contrat pro',
    INTERNSHIP = 'Stage',
    FREELANCE = 'Freelance'
}

// Types de temps de travail
export enum WorkTimeType {
    HOURS_35 = '35h',
    HOURS_37_5 = '37.5h',
    DAYS_FORFAIT = 'Forfait jours'
}

@EnduranceModelType.modelOptions({
    schemaOptions: {
        collection: 'work_contracts',
        timestamps: true,
        toObject: { virtuals: true },
        toJSON: { virtuals: true },
        _id: true,
        validateBeforeSave: false,
        strict: false
    }
})
@EnduranceModelType.pre<WorkContract>('save', async function (this: EnduranceDocumentType<WorkContract>, next) {
    if (this.isActive) {
        // Pour un nouveau document, this._id peut ne pas être encore défini
        const contractId = this._id;
        const isValid = await WorkContract.validateSingleActiveContract(this.user, contractId);
        if (!isValid) {
            const error = new Error('Un utilisateur ne peut avoir qu\'un seul contrat actif à la fois');
            return next(error);
        }
    }
    next();
})
@EnduranceModelType.pre<WorkContract>('save', function (this: WorkContract, next) {
    if (this.weeklyHours === WorkTimeType.HOURS_37_5 || this.weeklyHours === WorkTimeType.DAYS_FORFAIT) {
        this.hasRTT = true;
    } else {
        this.hasRTT = false;
    }
    next();
})

// Middleware pre-save pour calculer automatiquement les coûts si annualSalary est fourni
@EnduranceModelType.pre<WorkContract>('save', function (this: WorkContract, next) {
    if (this.annualSalary && (this.contractType === ContractType.CDI || this.contractType === ContractType.CDD)) {
        // Ne calculer les coûts que s'ils ne sont pas déjà fournis
        if (!this.monthlyCost) {
            this.monthlyCost = this.annualSalary / 12;
        }

        if (!this.dailyCost) {
            this.dailyCost = this.annualSalary / 218; // 218 jours ouvrés par an
        }

        // Le annualCost reste le coût total employeur (salaire + charges)
        // Si annualCost n'est pas fourni, on peut l'estimer avec un coefficient
        if (!this.annualCost) {
            // Coefficient moyen employeur en France : ~1.4 (salaire + charges)
            this.annualCost = this.annualSalary * 1.4;
        }
    }
    next();
})
class WorkContract extends EnduranceSchema {
    @EnduranceModelType.prop({ ref: () => User, required: true })
    public user!: Types.ObjectId;

    @EnduranceModelType.prop({
        type: String,
        enum: Object.values(ContractType),
        required: true
    })
    public contractType!: ContractType;

    @EnduranceModelType.prop({ required: true })
    public startDate!: Date;

    @EnduranceModelType.prop({ required: false })
    public endDate?: Date;

    @EnduranceModelType.prop({ required: true, default: false })
    public isActive!: boolean;

    @EnduranceModelType.prop({ required: true })
    public annualCost!: number;

    @EnduranceModelType.prop({ required: true })
    public monthlyCost!: number;

    @EnduranceModelType.prop({ required: true })
    public dailyCost!: number;

    @EnduranceModelType.prop({ required: false })
    public annualSalary?: number;

    @EnduranceModelType.prop({ required: false, default: 0.0078 })
    public annualSalaryToDailyCostCoefficient!: number;

    @EnduranceModelType.prop({
        type: String,
        enum: Object.values(WorkTimeType),
        required: true
    })
    public weeklyHours!: WorkTimeType;

    @EnduranceModelType.prop({ required: true, default: false })
    public hasRTT!: boolean;

    @EnduranceModelType.prop({ type: [Types.ObjectId], ref: 'ContractDocument', default: [] })
    public documents!: Types.ObjectId[];

    @EnduranceModelType.prop({ required: false })
    public notes?: string;

    // Méthode virtuelle pour calculer si le contrat est actif basé sur les dates
    public get isCurrentlyActive(): boolean {
        const now = new Date();
        const isInPeriod = this.startDate <= now && (!this.endDate || this.endDate >= now);
        return this.isActive && isInPeriod;
    }

    // Méthode pour clôturer le contrat
    public closeContract(endDate?: Date): void {
        this.isActive = false;
        if (endDate) {
            this.endDate = endDate;
        } else {
            this.endDate = new Date();
        }
    }

    // Méthode pour calculer le CJM à partir du salaire annuel
    public calculateCJMFromSalary(): number | null {
        if (!this.annualSalary) {
            return null;
        }
        return this.annualSalary * this.annualSalaryToDailyCostCoefficient;
    }

    // Méthode pour calculer le coût journalier à partir du salaire annuel
    public calculateDailyCostFromSalary(): number | null {
        if (!this.annualSalary) {
            return null;
        }
        // Calcul basé sur 218 jours ouvrés par an (365 - 104 weekends - 11 jours fériés - 25 CP - 7 RTT)
        return this.annualSalary / 218;
    }

    // Méthode pour calculer le coût mensuel à partir du salaire annuel
    public calculateMonthlyCostFromSalary(): number | null {
        if (!this.annualSalary) {
            return null;
        }
        return this.annualSalary / 12;
    }

    // Méthode statique pour valider qu'un utilisateur n'a qu'un seul contrat actif
    public static async validateSingleActiveContract(userId: Types.ObjectId, excludeContractId?: Types.ObjectId): Promise<boolean> {
        const query: any = { user: userId, isActive: true };
        if (excludeContractId) {
            query._id = { $ne: excludeContractId };
        }

        const activeContracts = await WorkContractModel.countDocuments(query);
        return activeContracts === 0;
    }

    public static getModel() {
        return WorkContractModel;
    }
}

const WorkContractModel = EnduranceModelType.getModelForClass(WorkContract);

export default WorkContractModel;
export type WorkContractDocument = EnduranceDocumentType<WorkContract>;
