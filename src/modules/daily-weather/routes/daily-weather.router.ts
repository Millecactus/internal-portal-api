import { EnduranceRouter, enduranceEmitter, enduranceEventTypes, EnduranceAuthMiddleware, SecurityOptions } from 'endurance-core';

class DailyWeatherRouter extends EnduranceRouter {
  constructor() {
    super(EnduranceAuthMiddleware.getInstance());
  }

  setupRoutes(): void {
    const securityOptions: SecurityOptions = {
      requireAuth: false,
      permissions: []
    };

    this.get('/', securityOptions, async (req: any, res: any) => {
      enduranceEmitter.emit(enduranceEventTypes.GENERATE_DAILY_WEATHER);
      res.send('ok');
    });
  }
}

const router = new DailyWeatherRouter();
export default router;
