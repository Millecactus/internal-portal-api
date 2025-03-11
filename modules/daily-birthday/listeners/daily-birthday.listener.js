import listener from 'endurance-core/dist/listener.js';
import { emitter, eventTypes } from 'endurance-core/dist/emitter.js';

import dotenv from 'dotenv';
dotenv.config();
import axios from 'axios';
import fetch from 'node-fetch';


// Fonction pour récupérer la météo via OpenWeather avec des dates dynamiques
async function fetchBirthdays() {
  try {
    const usersWithBirthdayToday = await User.getUsersWithBirthdayToday();
    return usersWithBirthdayToday;
  } catch (error) {
    console.error('Erreur lors de la récupération des anniversaires', error);
    return [];
  }
};

async function sendBirthdaysToDiscord(birthdayUsers) {
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

function formatBirthdayMessage(birthdayUser) {
  const { firstname, lastname } = birthdayUser;
  return `🎉 Happy Birthday ${firstname} ${lastname}! 🥳 We wish you a fantastic day filled with joy and happiness! 🎂`;
}

async function generateDailyBirthday() {
  const birthdays = await fetchBirthdays();

  try {
    await sendBirthdaysToDiscord(birthdays);
  } catch (error) {
    console.error('Erreur lors de l\'envoi à Discord:', error);
  }
}

listener.createListener(eventTypes.GENERATE_DAILY_BIRTHDAY, () => {
  generateDailyBirthday();
});


export default listener;