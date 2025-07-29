import { EnduranceRouter, enduranceEmitter, enduranceEventTypes, EnduranceAuthMiddleware, SecurityOptions } from '@programisto/endurance-core';

class DailyLootboxRouter extends EnduranceRouter {
  constructor() {
    super(EnduranceAuthMiddleware.getInstance());
  }

  setupRoutes(): void {
    const securityOptions: SecurityOptions = {
      requireAuth: false,
      permissions: []
    };

    this.get('/', securityOptions, async (req: any, res: any) => {
      enduranceEmitter.emit(enduranceEventTypes.GENERATE_DAILY_LOOTBOX_V2);
      res.send('ok');
    });
  }
}

const router = new DailyLootboxRouter();
export default router;
