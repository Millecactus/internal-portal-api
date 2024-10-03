import { loadCronJob } from 'endurance-core/lib/cron.js';
import { emitter, eventTypes } from 'endurance-core/lib/emitter.js';

const generateDailyBirthday = async () => {
  try {
    emitter.emit(eventTypes.GENERATE_DAILY_BIRTHDAY);
  } catch (error) {
    console.error('Error generating daily birthday', error);
  }
};

const cronTime = process.env.DAILY_BIRTHDAY_CRON_TIME ? process.env.DAILY_BIRTHDAY_CRON_TIME : '30 6 * * 1-5';
loadCronJob('generateDailyBirthday', cronTime, generateDailyBirthday);

const cronTimeWeekend = process.env.DAILY_BIRTHDAY_CRON_TIME_WEEKEND ? process.env.DAILY_BIRTHDAY_CRON_TIME_WEEKEND : '0 8 * * 6,7';
loadCronJob('generateDailyBirthday', cronTimeWeekend, generateDailyBirthday);

export default {};