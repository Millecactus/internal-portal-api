const router = require('endurance-core/lib/router')();
const env = require('dotenv');
env.config();
const axios = require('axios');
const fetch = require('node-fetch');

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

  const url = `https://newsapi.org/v2/top-headlines?q=tech&from=${from}&to=${to}&sortBy=popularity&apiKey=8566e72c34be4bbf8da1784f34ff0ae4`;

  try {
    const response = await axios.get(url);
    const articles = response.data.articles.slice(0, 10);
    return articles;
  } catch (error) {
    console.error("Erreur lors de la requête:", error);
    return [];
  }
}

// Fonction pour formater les actualités en un message Discord
function formatNewsForDiscord(articles) {
  if (articles.length === 0) {
    return "Aucune actualité à afficher.";
  }

  let message = "📢 **Dernières actualités technologiques :**\n\n";
  articles.forEach((article, index) => {
    message += `${index + 1}. **[${article.title}](${article.url})**\n`;
    message += `*Source :* ${article.source.name}\n`;
    message += `*Publié le :* ${new Date(article.publishedAt).toLocaleDateString()}\n`;
    if (article.description) {
      message += `> ${article.description}\n`;
    }
    message += "\n";
  });

  return message;
}

async function sendNewsToDiscord(formattedNews) {
  const maxMessageLength = 2000;
  
  // Découpe le message en parties de 2000 caractères maximum
  const messages = formattedNews.match(/[\s\S]{1,2000}/g);

  for (const message of messages) {
    /*await fetch('https://discord.com/api/webhooks/1285553278557622312/IG2kdnlbI30OYVC7YPBfXBrxtUip1FolAzE8hJa_DrWDIafsWFDpAgBsL81qvdOCw96X', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content: message,
      }),
    });*/
  }
}

router.get("/", async (req, res) => {
  const articles = await fetchNews();
  const formattedNews = formatNewsForDiscord(articles);

  try {
    await sendNewsToDiscord(formattedNews);
    res.status(200).json(formattedNews);
  } catch (error) {
    console.error('Erreur lors de l\'envoi à Discord:', error);
    res.status(500).json({ error: 'Erreur lors de l\'envoi à Discord', details: error.message });
  }
});

module.exports = router;
