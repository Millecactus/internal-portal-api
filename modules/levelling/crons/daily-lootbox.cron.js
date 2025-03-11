import { loadCronJob, unloadCronJob } from 'endurance-core/dist/cron.js';
import { emitter, eventTypes } from 'endurance-core/dist/emitter.js';

const generateDailyLootbox = async () => {
  try {
    emitter.emit(eventTypes.GENERATE_DAILY_LOOTBOX);
  } catch (error) {
    console.error('Error generating daily lootbox', error);
  }
};

const cronTime = process.env.DAILY_LOOTBOX_CRON_TIME ? process.env.DAILY_LOOTBOX_CRON_TIME : '0 7-16 * * 1-5';
loadCronJob('generateDailyLootbox', cronTime, generateDailyLootbox);

const generateDailyLootboxV2 = async () => {
  try {
    emitter.emit(eventTypes.GENERATE_DAILY_LOOTBOX_V2);
  } catch (error) {
    console.error('Erreur lors de la génération de la boîte de butin quotidienne V2', error);
  }
};

const startDailyLootbox = async () => {
  try {
    emitter.emit(eventTypes.START_DAILY_LOOTBOX);
  } catch (error) {
    console.error('Error starting daily lootbox', error);
  }
};


const cronTimeV2 = '0 6 * * 1-5'; // S'exécute à 6h du matin du lundi au vendredi
loadCronJob('generateDailyLootboxV2', cronTimeV2, generateDailyLootboxV2);

const registerCronJobs = (cronTime) => {
  loadCronJob('startDailyLootbox', cronTime, startDailyLootbox);
}

const unregisterCronJobs = () => {
  unloadCronJob('startDailyLootbox');
}

export { registerCronJobs, unregisterCronJobs };