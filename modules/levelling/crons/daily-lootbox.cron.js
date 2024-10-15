import { loadCronJob } from 'endurance-core/lib/cron.js';
import { emitter, eventTypes } from 'endurance-core/lib/emitter.js';

const generateDailyLootbox = async () => {
  try {
    emitter.emit(eventTypes.GENERATE_DAILY_LOOTBOX);
  } catch (error) {
    console.error('Error generating daily lootbox', error);
  }
};

const cronTime = process.env.DAILY_LOOTBOX_CRON_TIME ? process.env.DAILY_LOOTBOX_CRON_TIME : '0 7-16 * * 1-5';
loadCronJob('generateDailyLootbox', cronTime, generateDailyLootbox);

export default {};