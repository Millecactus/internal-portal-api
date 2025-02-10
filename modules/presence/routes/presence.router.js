import routerBase from 'endurance-core/lib/router.js';
import { emitter, eventTypes } from 'endurance-core/lib/emitter.js';
import Presence from '../models/presence.model.js';
import moment from 'moment';

const router = routerBase({requireDb: true});

router.get("/weekly-presence", async (req, res) => {  

    try {
        const { startDate } = req.query;
        const startMoment = startDate ? moment(startDate) : moment();
        const startOfWeek = startMoment.startOf('week').toDate();
        const endOfWeek = startMoment.endOf('week').toDate();

        const presences = await Presence.find({
            date: {
                $gte: startOfWeek,
                $lte: endOfWeek
            }
        }, null, { strictPopulate: false })
        .populate('user', 'firstname lastname') 
        .exec();

        res.json(presences);
    } catch (error) {
        console.error('Error fetching presence items for the specified week:', error);
        res.status(500).send('Internal Server Error');
    }
});
router.autoWire(Presence, 'Presence', {});

export default router;
