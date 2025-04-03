import { enduranceListener, enduranceEventTypes } from 'endurance-core';
import DiscordService from '../services/discord.service.js';

interface QuestCompletedPayload {
    firstname: string;
    lastname: string;
    questName: string;
    badgeName: string;
}

interface LevelUpPayload {
    userId: string;
    newLevel: number;
}

interface UpdateNicknamePayload {
    user: any;
}

enduranceListener.createListener(enduranceEventTypes.LEVELLING_QUEST_COMPLETED, (args: unknown) => {
    const payload = args as QuestCompletedPayload;
    const { firstname, lastname, questName, badgeName } = payload;
    DiscordService.sendQuestCompletedMessage({ firstname, lastname, questName, badgeName });
});

enduranceListener.createListener(enduranceEventTypes.LEVELLING_LEVEL_UP, (args: unknown) => {
    const payload = args as LevelUpPayload;
    const { userId, newLevel } = payload;
    DiscordService.sendLevelUpMessage({ userId, newLevel });
});

enduranceListener.createListener(enduranceEventTypes.LEVELLING_UPDATE_NICKNAME, (args: unknown) => {
    const payload = args as UpdateNicknamePayload;
    const { user } = payload;
    DiscordService.updateNickname(user);
});

export default enduranceListener;