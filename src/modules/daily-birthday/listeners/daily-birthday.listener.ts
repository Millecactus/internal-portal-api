import { enduranceListener, enduranceEventTypes } from '@programisto/endurance-core';
import fetch from 'node-fetch';
import { User } from 'discord.js';

// Fonction pour récupérer les anniversaires des utilisateurs
async function fetchBirthdays(): Promise<any[]> {
  try {
    // Remplacer par la méthode correcte pour récupérer les utilisateurs ayant un anniversaire aujourd'hui
    const usersWithBirthdayToday = await (User as any).getUsersWithBirthdayToday();
    return usersWithBirthdayToday;
  } catch (error) {
    console.error('Erreur lors de la récupération des anniversaires', error);
    return [];
  }
}

async function sendBirthdaysToDiscord(birthdayUsers: any[]): Promise<void> {
  const discordWebhooks = process.env.DAILY_BIRTHDAY_DISCORD_WEBHOOKS;

  if (discordWebhooks && birthdayUsers.length > 0) {
    const discordWebhooksArray = discordWebhooks.split(";");

    for (const user of birthdayUsers) {
      const message = formatBirthdayMessage(user);
      for (const webhook of discordWebhooksArray) {
        try {
          await fetch(webhook, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ content: message }),
          });
        } catch (error) {
          console.error('Erreur lors de l\'envoi du message à Discord:', error);
        }
      }
    }
  }
}

function formatBirthdayMessage(birthdayUser: any): string {
  const { firstname, lastname } = birthdayUser;
  return `🎉 Happy Birthday ${firstname} ${lastname}! 🥳 We wish you a fantastic day filled with joy and happiness! 🎂`;
}

async function generateDailyBirthday(): Promise<void> {
  const birthdays = await fetchBirthdays();

  try {
    await sendBirthdaysToDiscord(birthdays);
  } catch (error) {
    console.error('Erreur lors de l\'envoi à Discord:', error);
  }
}

enduranceListener.createListener(enduranceEventTypes.GENERATE_DAILY_BIRTHDAY, () => {
  generateDailyBirthday();
});

export default enduranceListener;