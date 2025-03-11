import { loadCronJob } from 'endurance-core/dist/cron.js';
import { emitter, eventTypes } from 'endurance-core/dist/emitter.js';

const generateDailyWeather = async () => {
  try {
    emitter.emit(eventTypes.GENERATE_DAILY_WEATHER);
  } catch (error) {
    console.error('Error generating daily weather', error);
  }
};

const cronTime = process.env.DAILY_WEATHER_CRON_TIME ? process.env.DAILY_WEATHER_CRON_TIME : '0 7 * * 1-5';
loadCronJob('generateDailyWeather', cronTime, generateDailyWeather);

export default {};