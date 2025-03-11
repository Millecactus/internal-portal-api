import routerBase from 'endurance-core/dist/router.js';
import { emitter, eventTypes } from 'endurance-core/dist/emitter.js';
import { auth } from 'endurance-core/dist/auth.js'


const router = routerBase();

router.get("/", auth.isAuthenticated(), async (req, res) => {
  emitter.emit(eventTypes.GENERATE_DAILY_BIRTHDAY);
  res.send('ok');
});

export default router;
