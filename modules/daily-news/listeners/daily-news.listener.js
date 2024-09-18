import listener from 'endurance-core/lib/listener.js';
import { emitter, eventTypes } from 'endurance-core/lib/emitter.js';

import dotenv from 'dotenv';
dotenv.config();
import axios from 'axios';
import fetch from 'node-fetch';

// Fonction pour récupérer les actualités via NewsAPI avec des dates dynamiques
async function fetchNews() {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const formatDate = (date) => {
    return date.toISOString().split('T')[0];
  };

  const from = formatDate(yesterday);
  const to = formatDate(today);
  const sources = process.env.DAILY_NEWS_NEWSAPI_SOURCES.replace(/;/g, ',');
  const url = `https://newsapi.org/v2/top-headlines?q=&from=${from}&to=${to}&sortBy=popularity&apiKey=${process.env.DAILY_NEWS_NEWSAPI_KEY}&language=en&sources=${sources}`;
  console.log(url);
  try {
    const response = await axios.get(url);
    const articles = response.data.articles.slice(0, 10);
    return articles;
  } catch (error) {
    console.error("Error processing request:", error);
    return [];
  }
}

// Fonction pour formater les actualités en un message Discord
function formatNewsForDiscord(articles) {
  if (articles.length === 0) {
    return "No news to display.";
  }

  let message = "## 📢 **Latest tech news of the day:**\n\n\n";
  articles.forEach((article, index) => {
    const cleanTitle = article.title.replace(/\n/g, ' ').replace(/\*\*/g, '');
    message += `### ${index + 1}. **[${cleanTitle}](${article.url})**\n`;
    if (article.description) {
      message += `> ${article.description}\n`;
    }
    message += `> *Source: ${article.source.name}*\n`;
    message += "\n";
  });
  message += "## 💡 Anything else we missed? Feel free to share your fovorite news of the day!"

  return message;
}

async function sendNewsToDiscord(formattedNews) {
  const maxMessageLength = 2000;
  const discordWebhooks = process.env.DAILY_NEWS_DISCORD_WEBHOOKS;

  if (discordWebhooks) {
    const discordWebhooksArray = discordWebhooks.split(";");

    let currentMessage = "";
    const lines = formattedNews.split("\n");

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

async function generateDailyNews() {
  const articles = await fetchNews();
  const formattedNews = formatNewsForDiscord(articles);

  try {
    await sendNewsToDiscord(formattedNews);
  } catch (error) {
    console.error('Erreur lors de l\'envoi à Discord:', error);
  }
}

listener.createListener(eventTypes.GENERATE_DAILY_NEWS, () => {
  generateDailyNews();
});


export default listener;