import listener from 'endurance-core/dist/listener.js';
import { emitter, eventTypes } from 'endurance-core/dist/emitter.js';
import DiscordService from '../services/discord.service.js';

listener.createListener(eventTypes.LEVELLING_QUEST_COMPLETED, ({ firstname, lastname, questName, badgeName }) => {
    DiscordService.sendQuestCompletedMessage({ firstname, lastname, questName, badgeName });
});

listener.createListener(eventTypes.LEVELLING_LEVEL_UP, (userId, newLevel) => {
    DiscordService.sendLevelUpMessage(userId, newLevel);
});

listener.createListener(eventTypes.LEVELLING_UPDATE_NICKNAME, (user) => {
    DiscordService.updateNickname(user);
});

export default listener;