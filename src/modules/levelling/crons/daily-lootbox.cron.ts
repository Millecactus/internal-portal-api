import { enduranceCron, enduranceEmitter, enduranceEventTypes } from 'endurance-core';

const generateDailyLootboxV2 = async (): Promise<void> => {
  try {
    enduranceEmitter.emit(enduranceEventTypes.GENERATE_DAILY_LOOTBOX_V2);
  } catch (error) {
    console.error('Erreur lors de la génération de la boîte de butin quotidienne V2', error);
  }
};

const startDailyLootbox = async (): Promise<void> => {
  try {
    enduranceEmitter.emit(enduranceEventTypes.START_DAILY_LOOTBOX);
  } catch (error) {
    console.error('Erreur lors du démarrage de la boîte de butin quotidienne', error);
  }
};

const cronTimeV2: string = '0 6 * * 1-5'; // S'exécute à 6h du matin du lundi au vendredi
enduranceCron.loadCronJob('generateDailyLootboxV2', cronTimeV2, generateDailyLootboxV2);

const registerCronJobs = (cronTime: string): void => {
  enduranceCron.loadCronJob('startDailyLootbox', cronTime, startDailyLootbox);
}


export { registerCronJobs };