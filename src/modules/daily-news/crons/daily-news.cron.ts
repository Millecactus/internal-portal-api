import { enduranceCron, enduranceEmitter, enduranceEventTypes } from 'endurance-core';

const generateDailyNews = async (): Promise<void> => {
  try {
    enduranceEmitter.emit(enduranceEventTypes.GENERATE_DAILY_NEWS);
  } catch (error) {
    console.error('Error generating daily news', error);
  }
};

const cronTime: string = process.env.DAILY_NEWS_CRON_TIME ? process.env.DAILY_NEWS_CRON_TIME : '0 14 * * 1-5';
enduranceCron.loadCronJob('generateDailyNews', cronTime, generateDailyNews);

const cronTimeWeekend: string = process.env.DAILY_NEWS_CRON_TIME_WEEKEND ? process.env.DAILY_NEWS_CRON_TIME_WEEKEND : '0 10 * * 6,7';
enduranceCron.loadCronJob('generateDailyNews', cronTimeWeekend, generateDailyNews);

export default {};