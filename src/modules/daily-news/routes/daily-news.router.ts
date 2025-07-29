import { EnduranceRouter, enduranceEmitter, enduranceEventTypes, EnduranceAuthMiddleware, SecurityOptions } from '@programisto/endurance-core';

class DailyNewsRouter extends EnduranceRouter {
  constructor() {
    super(EnduranceAuthMiddleware.getInstance());
  }

  setupRoutes(): void {
    const securityOptions: SecurityOptions = {
      requireAuth: false,
      permissions: []
    };

    this.get('/', securityOptions, async (req: any, res: any) => {
      enduranceEmitter.emit(enduranceEventTypes.GENERATE_DAILY_NEWS);
      res.send('ok');
    });
  }
}

const router = new DailyNewsRouter();
export default router;
