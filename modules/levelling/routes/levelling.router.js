import routerBase from 'endurance-core/lib/router.js';
import { emitter, eventTypes } from 'endurance-core/lib/emitter.js';
import User from '../models/user.model.js';
import Quest from '../models/quest.model.js';
import fetch from 'node-fetch';
import crypto from 'crypto';
import { auth, accessControl } from 'endurance-core/lib/auth.js';

const router = routerBase();

router.get("/", accessControl.isAuthenticated(), async (req, res) => {

    try {
        const user = req.user;
        const userEmail = req.user.email; // Supposons que l'email de l'utilisateur est extrait de l'accessToken
        const fullUser = await User.findOne({ email: userEmail })
            .populate('completedQuests.quest')
            .populate('badges.badge')
            .exec();
        if (!fullUser) {
            return res.status(404).send('Utilisateur non trouvé');
        }
        res.json({
            email: fullUser.email,
            xpHistory: fullUser.xpHistory,
            completedQuests: fullUser.completedQuests,
            badges: fullUser.badges,
            level: fullUser.getLevel(),
            xpForNextLevel: fullUser.getXPforNextLevel()

        });
    } catch (error) {
        console.error('Error fetching user:', error);
        res.status(500).send('Internal Server Error');
    }
});

router.get("/available-quests", accessControl.isAuthenticated(), async (req, res) => {
    try {
        const userEmail = req.user.email; // Supposons que l'email de l'utilisateur est extrait de l'accessToken
        const user = await User.findOne({ email: userEmail })
            .populate('completedQuests.quest')
            .exec();

        if (!user) {
            return res.status(404).send('Utilisateur non trouvé');
        }

        const completedQuestIds = user.completedQuests.map(quest => quest.quest._id);

        const availableQuests = await Quest.find({ _id: { $nin: completedQuestIds }, status: 'open' }).exec();

        res.json(availableQuests);
    } catch (error) {
        console.error('Erreur lors de la récupération des quêtes disponibles:', error);
        res.status(500).send('Erreur interne du serveur');
    }
});



router.get("/complete-quest", async (req, res) => {
    try {
        const { discordId, questId } = req.query;

        if (!discordId || !questId) {
            return res.status(400).send('Missing discordId or questId parameter');
        }

        const user = await User.findOne({ discordId }).exec();
        if (!user) {
            return res.status(404).send('User not found');
        }

        const quest = await Quest.findById(questId).exec();
        if (!quest) {
            return res.status(404).send('Quest not found');
        }

        await user.completeQuest(quest._id);

        res.send(`Quest ${quest.name} completed for user with discordId ${discordId}`);
    } catch (error) {
        console.error('Error completing quest:', error);
        res.status(500).send('Error completing quest');
    }

});

router.get("/complete-quest-for-all", async (req, res) => {
    try {
        const { questId, excludeDiscordIds } = req.query;

        if (!questId) {
            return res.status(400).send('Missing questId parameter');
        }

        const quest = await Quest.findById(questId).exec();
        if (!quest) {
            return res.status(404).send('Quest not found');
        }

        const excludeIdsArray = excludeDiscordIds ? excludeDiscordIds.split(',') : [];

        const users = await User.find({ discordId: { $nin: excludeIdsArray } }).exec();

        for (const user of users) {
            await user.completeQuest(quest._id);
        }

        res.send(`Quest ${quest.name} completed for all users except those with discordIds: ${excludeIdsArray.join(', ')}`);
    } catch (error) {
        console.error('Error completing quest for all users:', error);
        res.status(500).send('Error completing quest for all users');
    }
});


router.get("/update-nicknames", async (req, res) => {
    try {
        const users = await User.find().exec();
        for (const user of users) {
            emitter.emit(eventTypes.LEVELLING_UPDATE_NICKNAME, user);
        }
        res.send('Nicknames updated for all users');
    } catch (error) {
        console.error('Error updating nicknames:', error);
        res.status(500).send('Error updating nicknames');
    }
});

router.get("/init-quest", async (req, res) => {
    try {
        const users = await User.find().exec();
        const quest = await Quest.findOne({ name: 'Welcome' }).exec();
        if (!quest) {
            throw new Error('Quest "Welcome" not found.');
        }
        for (const user of users) {
            await user.completeQuest(quest._id);
        }

        res.send('Quest initialized for all users');
    } catch (error) {
        console.error('Error initializing Quest:', error);
        res.status(500).send('Error initializing Quest');
    }
});
/*
router.get("/clean-xp", async (req, res) => {
    try {
        const users = await User.find().exec();

        for (const userData of users) {

            let user = userData.toObject();
            user.xpHistory = [];
            user.completedQuests = [];
            user.badges = [];
            delete user.xp;
            delete user.level;

            await User.updateOne({ _id: user._id }, user);

            await User.updateOne(
                { _id: user._id },
                { $unset: { xp: "" } },
                { strict: false }
            );

            await User.updateOne(
                { _id: user._id },
                { $unset: { level: "" } },
                { strict: false }
            );

        }

        res.send('XP history cleaned for all users');
    } catch (error) {
        console.error('Error cleaning XP history:', error);
        res.status(500).send('Error cleaning XP history');
    }
});
*/
router.get("/timesheet", async (req, res) => {
    try {
        const boondManagerKey = process.env.BOONDMANAGER_CLIENT_KEY;
        const userToken = process.env.BOONDMANAGER_USER_TOKEN; // Assuming the user token is passed in the request headers
        const clientToken = process.env.BOONDMANAGER_CLIENT_TOKEN;

        if (!userToken) {
            return res.status(400).send('User token is required.');
        }

        const header = {
            alg: "HS256",
            typ: "JWT"
        };

        const payload = {
            userToken: userToken,
            clientToken: clientToken,
            time: Math.floor(Date.now() / 1000),
            mode: "normal"
        };

        const base64Header = Buffer.from(JSON.stringify(header)).toString('base64');
        const base64Payload = Buffer.from(JSON.stringify(payload)).toString('base64');
        const signature = crypto
            .createHmac('sha256', boondManagerKey)
            .update(`${base64Header}.${base64Payload}`)
            .digest('base64');

        const jwt = `${base64Header}.${base64Payload}.${signature}`;

        const currentDate = new Date();
        const currentYear = currentDate.getFullYear();
        const currentMonth = String(currentDate.getMonth() + 1).padStart(2, '0'); // Months are 0-indexed

        const defaultStartMonth = `${currentYear}-${currentMonth}`;
        const defaultEndMonth = `${currentYear}-${currentMonth}`;

        const startMonth = req.query.startMonth || defaultStartMonth;
        const endMonth = req.query.endMonth || defaultEndMonth;


        const response = await fetch(`https://ui.boondmanager.com/api/times-reports?startMonth=${startMonth}&endMonth=${endMonth}`, {
            method: 'GET',
            headers: {
                'X-Jwt-Client-Boondmanager': jwt,
                'x-Debug-Boondmanager': true
            }
        });



        if (!response.ok) {
            const xDebugBoondmanager = response.headers.get('x-Debug-Boondmanager');
            console.log('x-Debug-Boondmanager header:', xDebugBoondmanager);
            console.error(`Error fetching times reports: ${response.status} - ${response.statusText}`);
            throw new Error('Error fetching times reports');
        }

        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('Error fetching times reports:', error);
        res.status(500).send('Error fetching times reports');
    }
});



export default router;
