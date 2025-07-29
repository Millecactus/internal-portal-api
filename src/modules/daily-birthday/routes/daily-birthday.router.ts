import { EnduranceRouter, enduranceEmitter, enduranceEventTypes, EnduranceAuthMiddleware, SecurityOptions } from '@programisto/endurance-core';

class DailyBirthdayRouter extends EnduranceRouter {
  constructor() {
    super(EnduranceAuthMiddleware.getInstance());
  }

  setupRoutes(): void {
    const securityOptions: SecurityOptions = {
      requireAuth: false,
      permissions: []
    };

    this.get('/', securityOptions, async (req: any, res: any) => {
      enduranceEmitter.emit(enduranceEventTypes.GENERATE_DAILY_BIRTHDAY);
      res.send('ok');
    });

  }

}

const router = new DailyBirthdayRouter();
export default router;