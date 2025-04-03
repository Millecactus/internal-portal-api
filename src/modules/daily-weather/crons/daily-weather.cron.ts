import { enduranceCron, enduranceEmitter, enduranceEventTypes } from 'endurance-core';

const generateDailyWeather = async (): Promise<void> => {
  try {
    enduranceEmitter.emit(enduranceEventTypes.GENERATE_DAILY_WEATHER);
  } catch (error) {
    console.error('Error generating daily weather', error);
  }
};

const cronTime: string = process.env.DAILY_WEATHER_CRON_TIME ? process.env.DAILY_WEATHER_CRON_TIME : '0 7 * * 1-5';
enduranceCron.loadCronJob('generateDailyWeather', cronTime, generateDailyWeather);

export default {};