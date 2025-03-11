import routerBase from 'endurance-core/dist/router.js';
import { emitter, eventTypes } from 'endurance-core/dist/emitter.js';

const router = routerBase();

router.get("/", async (req, res) => {
  emitter.emit(eventTypes.GENERATE_DAILY_LOOTBOX);
  res.send('ok');
});

export default router;
