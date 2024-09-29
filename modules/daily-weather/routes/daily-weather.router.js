import routerBase from 'endurance-core/lib/router.js';
import { emitter, eventTypes } from 'endurance-core/lib/emitter.js';

const router = routerBase();

router.get("/", async (req, res) => {
  emitter.emit(eventTypes.GENERATE_DAILY_WEATHER);
  res.send('ok');
});

export default router;
