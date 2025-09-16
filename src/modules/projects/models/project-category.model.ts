import { EnduranceSchema, EnduranceModelType, EnduranceDocumentType } from '@programisto/endurance-core';

@EnduranceModelType.modelOptions({
    schemaOptions: {
        collection: 'project_categories',
        timestamps: true,
        toObject: { virtuals: true },
        toJSON: { virtuals: true },
        _id: true,
        validateBeforeSave: false,
        strict: false
    }
})
class ProjectCategory extends EnduranceSchema {
    @EnduranceModelType.prop({ required: true, unique: true })
    public name!: string;

    @EnduranceModelType.prop()
    public description?: string;

    @EnduranceModelType.prop()
    public color?: string; // Couleur hexadécimale pour l'affichage

    @EnduranceModelType.prop({ default: true })
    public isActive!: boolean;

    public static getModel() {
        return ProjectCategoryModel;
    }
}

const ProjectCategoryModel = EnduranceModelType.getModelForClass(ProjectCategory);
export default ProjectCategoryModel;
export type ProjectCategoryDocument = EnduranceDocumentType<ProjectCategory>;
