import routerBase from 'endurance-core/lib/router.js';
import { emitter, eventTypes } from 'endurance-core/lib/emitter.js';
import User from '../models/user.model.js';
import Quest from '../models/quest.model.js';
import fetch from 'node-fetch';

import crypto from 'crypto';
import { Client, GatewayIntentBits } from 'discord.js';

const router = routerBase();
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });

client.login(process.env.DISCORD_APP_TOKEN);
router.get("/", async (req, res) => {
    try {
        const user = await User.findOne().exec();
        res.json(user);
    } catch (error) {
        console.error('Error fetching user:', error);
        res.status(500).send('Internal Server Error');
    }
});

router.get("/complete-quest", async (req, res) => {

});

router.get("/update-nicknames", async (req, res) => {
    try {
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

router.get("/clean-xp", async (req, res) => {
    try {
        const users = await User.find().exec();

        for (const userData of users) {

            let user = userData.toObject();
            user.xpHistory = [];
            user.completedQuests = [];
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



export default router;
