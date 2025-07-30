import { EnduranceSchema, EnduranceModelType, ObjectId } from '@programisto/endurance-core';

enum EventType {
    InPerson = 'InPerson',
    Online = 'Online'
}

@EnduranceModelType.modelOptions({
    options: {
        allowMixed: EnduranceModelType.Severity.ALLOW
    }
})
class Event extends EnduranceSchema {
    @EnduranceModelType.prop({ required: true })
    public name!: string;

    @EnduranceModelType.prop({ required: true })
    public description!: string;

    @EnduranceModelType.prop({ required: true, enum: EventType })
    public type!: EventType;

    @EnduranceModelType.prop({ required: false })
    public location?: string;

    @EnduranceModelType.prop({ required: true })
    public date!: Date;

    @EnduranceModelType.prop({ required: false })
    public link!: string;

    @EnduranceModelType.prop()
    public maxParticipants?: number;

    @EnduranceModelType.prop({ type: [String], default: [] })
    public registeredUsers!: string[];

    @EnduranceModelType.prop({ required: false })
    public imageUrl?: string;

    public static getModel() {
        return EventModel;
    }
}

const EventModel = EnduranceModelType.getModelForClass(Event);
export default EventModel;
