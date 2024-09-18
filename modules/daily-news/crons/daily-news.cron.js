import { loadCronJob } from 'endurance-core/lib/cron.js';
import { emitter, eventTypes } from 'endurance-core/lib/emitter.js';

// Fonction de génération des rapports
const generateDailyNews = async () => {
  try {
    emitter.emit(eventTypes.GENERATE_DAILY_NEWS);
  } catch (error) {
    console.error('Error generating daily news', error);
  }
};
console.log("cron loaded")

// Charger un cron job qui génère un rapport quotidien à minuit
loadCronJob('generateDailyNews', '0 16 * * 1-5', generateDailyNews);
loadCronJob('generateDailyNews', '12 14 * * 3', generateDailyNews);

export default {};