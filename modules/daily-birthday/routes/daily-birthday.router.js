import routerBase from 'endurance-core/lib/router.js';
import { emitter, eventTypes } from 'endurance-core/lib/emitter.js';
import { auth } from 'endurance-core/lib/auth.js'


const router = routerBase();

router.get("/", auth.isAuthenticated(), async (req, res) => {
  emitter.emit(eventTypes.GENERATE_DAILY_BIRTHDAY);
  res.send('ok');
});

export default router;
