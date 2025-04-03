import { enduranceCron, enduranceEmitter, enduranceEventTypes } from 'endurance-core';

const generateDailyBirthday = async (): Promise<void> => {
  try {
    enduranceEmitter.emit(enduranceEventTypes.GENERATE_DAILY_BIRTHDAY);
  } catch (error) {
    console.error('Error generating daily birthday', error);
  }
};

const cronTime: string = process.env.DAILY_BIRTHDAY_CRON_TIME ? process.env.DAILY_BIRTHDAY_CRON_TIME : '30 6 * * 1-5';
enduranceCron.loadCronJob('generateDailyBirthday', cronTime, generateDailyBirthday);

const cronTimeWeekend: string = process.env.DAILY_BIRTHDAY_CRON_TIME_WEEKEND ? process.env.DAILY_BIRTHDAY_CRON_TIME_WEEKEND : '0 8 * * 6,7';
enduranceCron.loadCronJob('generateDailyBirthday', cronTimeWeekend, generateDailyBirthday);

export default {};