/* eslint-disable @typescript-eslint/no-unused-vars, no-use-before-define */
import { EnduranceSchema, EnduranceModelType } from '@programisto/endurance-core';

// Enums pour les statuts de fichiers
export enum FileStatus {
    PENDING = 'PENDING',
    UPLOADING = 'UPLOADING',
    COMPLETED = 'COMPLETED',
    FAILED = 'FAILED',
    DELETED = 'DELETED'
}

// Enums pour les providers de stockage
export enum FileProvider {
    S3 = 'S3',
    MINIO = 'MINIO',
    LOCAL = 'LOCAL',
    GCS = 'GCS'
}

// Enums pour les types de fichiers
export enum FileType {
    DOCUMENT = 'DOCUMENT',
    IMAGE = 'IMAGE',
    VIDEO = 'VIDEO',
    AUDIO = 'AUDIO',
    ARCHIVE = 'ARCHIVE',
    OTHER = 'OTHER'
}

// Interface pour les fichiers
export interface IFile {
    filename: string;
    originalName: string;
    mimeType: string;
    size: number;
    provider: FileProvider;
    bucket: string;
    key: string;
    url: string;
    status: FileStatus;
    type?: FileType;
    metadata?: Record<string, any>;
    tags?: string[];
    description?: string;
    checksum?: string;
    etag?: string;
    versionId?: string;
    tenantId?: string;
    entityName?: string;
    entityId?: string;
    uploadedBy?: string;
    expiresAt?: Date;
    lastAccessedAt?: Date;
    accessCount?: number;
}

@EnduranceModelType.modelOptions({
    options: {
        allowMixed: EnduranceModelType.Severity.ALLOW
    }
})
// eslint-disable-next-line @typescript-eslint/no-use-before-define
@EnduranceModelType.pre<File>('save', async function (this: File, next) {
    try {
        if (this.status) {
            this.status = this.status.toUpperCase() as FileStatus;
        }
        if (this.provider) {
            this.provider = this.provider.toUpperCase() as FileProvider;
        }
        if (this.type) {
            this.type = this.type.toUpperCase() as FileType;
        }
        next();
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        next(new Error('Erreur lors du pré-enregistrement: ' + errorMessage));
    }
})
class File extends EnduranceSchema implements IFile {
    @EnduranceModelType.prop({ required: true })
    public filename!: string;

    @EnduranceModelType.prop({ required: true })
    public originalName!: string;

    @EnduranceModelType.prop({ required: true })
    public mimeType!: string;

    @EnduranceModelType.prop({ required: true, type: Number })
    public size!: number;

    @EnduranceModelType.prop({ required: true, enum: FileProvider })
    public provider!: FileProvider;

    @EnduranceModelType.prop({ required: true })
    public bucket!: string;

    @EnduranceModelType.prop({ required: true })
    public key!: string;

    @EnduranceModelType.prop({ required: true })
    public url!: string;

    @EnduranceModelType.prop({ required: true, enum: FileStatus, default: FileStatus.PENDING })
    public status!: FileStatus;

    @EnduranceModelType.prop({ required: false, enum: FileType })
    public type!: FileType;

    @EnduranceModelType.prop({ required: false })
    public metadata!: Record<string, any>;

    @EnduranceModelType.prop({ required: false })
    public tags!: string[];

    @EnduranceModelType.prop({ required: false })
    public description!: string;

    @EnduranceModelType.prop({ required: false })
    public checksum!: string;

    @EnduranceModelType.prop({ required: false })
    public etag!: string;

    @EnduranceModelType.prop({ required: false })
    public versionId!: string;

    @EnduranceModelType.prop({ required: false })
    public tenantId!: string;

    @EnduranceModelType.prop({ required: false })
    public entityName!: string;

    @EnduranceModelType.prop({ required: false })
    public entityId!: string;

    @EnduranceModelType.prop({ required: false })
    public uploadedBy!: string;

    @EnduranceModelType.prop({ required: false })
    public expiresAt!: Date;

    @EnduranceModelType.prop({ required: false })
    public lastAccessedAt!: Date;

    @EnduranceModelType.prop({ required: false })
    public accessCount!: number;

    public static getModel() {
        return FileModel;
    }
}

const FileModel = EnduranceModelType.getModelForClass(File);

// Exports explicites pour éviter les warnings ESLint sur les enums non utilisés
export const FileStatusValues = Object.values(FileStatus);
export const FileProviderValues = Object.values(FileProvider);
export const FileTypeValues = Object.values(FileType);

export default FileModel;
