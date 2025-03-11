import { loadCronJob } from 'endurance-core/dist/cron.js';
import { emitter, eventTypes } from 'endurance-core/dist/emitter.js';

const generateDailyNews = async () => {
  try {
    emitter.emit(eventTypes.GENERATE_DAILY_NEWS);
  } catch (error) {
    console.error('Error generating daily news', error);
  }
};

const cronTime = process.env.DAILY_NEWS_CRON_TIME ? process.env.DAILY_NEWS_CRON_TIME : '0 14 * * 1-5';
loadCronJob('generateDailyNews', cronTime, generateDailyNews);

export default {};