import listener from 'endurance-core/dist/listener.js';
import { emitter, eventTypes } from 'endurance-core/dist/emitter.js';

import dotenv from 'dotenv';
dotenv.config();
import axios from 'axios';
import fetch from 'node-fetch';

// Fonction pour récupérer la météo via OpenWeather avec des dates dynamiques
async function fetchWeather() {
  const weatherLocationsToFetchString = process.env.DAILY_WEATHER_LIST;
  let weatherLocationsToFetch;

  try {
    weatherLocationsToFetch = JSON.parse(weatherLocationsToFetchString);
  } catch (error) {
    console.error("Erreur lors du parsing de DAILY_WEATHER_LIST:", error);
    return [];
  }

  if (Array.isArray(weatherLocationsToFetch)) {
    let weatherResults = [];
    for (let weatherLocationToFetch of weatherLocationsToFetch) {
      try {
        const response = await axios.get(`https://api.openweathermap.org/data/2.5/weather?cnt=1&units=metric&lang=en&lat=${weatherLocationToFetch.latitude}&lon=${weatherLocationToFetch.longitude}&appid=${process.env.DAILY_WEATHER_OPENWEATHER_KEY}`);
        const weatherResult = response.data;
        weatherResult.city = weatherLocationToFetch.city;
        weatherResult.emoji = weatherLocationToFetch.emoji;
        weatherResults.push(weatherResult);
      } catch (error) {
        console.error(`Erreur lors de la récupération de la météo pour ${weatherLocationToFetch.city}:`, error);
      }
    }
    return weatherResults;
  } else {
    console.error("DAILY_WEATHER_LIST n'est pas un tableau.");
    return [];
  }
}

// Fonction pour formater les actualités en un message Discord
function formatWeatherForDiscord(weathers) {
  if (weathers.length === 0) {
    return "No weather data to display.";
  }

  let message = "## ☀️ **Hi everyone! Here is the weather for today:**\n\n";
  message += "---------------------------------------------------------------\n";
  weathers.forEach((weather) => {
    message += `### ${weather.emoji} **${weather.city}**\n`;
    message += `- **Conditions :** ${weather.weather[0].description}\n`;
    message += `- **Temperature :** ${weather.main.temp}°C (Feels like: ${weather.main.feels_like}°C) - **Humidity :** ${weather.main.humidity}% - **Wind :** ${weather.wind.speed} m/s\n`;
  });
  message += "## 🚀 **Have a nice day!**";
  console.log(message);
  return message;
}


async function sendWeatherToDiscord(formattedWeather) {
  const maxMessageLength = 2000;
  const discordWebhooks = process.env.DAILY_WEATHER_DISCORD_WEBHOOKS;

  if (discordWebhooks) {
    const discordWebhooksArray = discordWebhooks.split(";");

    let currentMessage = "";
    const lines = formattedWeather.split("\n");

    for (const line of lines) {
      if ((currentMessage + line).length > maxMessageLength) {
        for (const discordWebhook of discordWebhooksArray) {
          await fetch(discordWebhook, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              content: currentMessage,
            }),
          });
        }
        console.log(currentMessage);
        currentMessage = "";
      }
      currentMessage += line + "\n";
    }

    if (currentMessage.length > 0) {
      for (const discordWebhook of discordWebhooksArray) {
        await fetch(discordWebhook, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            content: currentMessage,
          }),
        });
      }
      console.log(currentMessage);
    }
  }
}

async function generateDailyWeather() {
  const weathers = await fetchWeather();
  const formattedWeather = formatWeatherForDiscord(weathers);

  try {
    await sendWeatherToDiscord(formattedWeather);
  } catch (error) {
    console.error('Erreur lors de l\'envoi à Discord:', error);
  }
}

listener.createListener(eventTypes.GENERATE_DAILY_WEATHER, () => {
  generateDailyWeather();
});


export default listener;