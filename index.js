import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const API_KEY = process.env.ROBLOX_API_KEY;
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;

const NEW_GROUP_ID = process.env.NEW_GROUP_ID;
const OLD_GROUP_IDS = process.env.OLD_GROUP_IDS.split(",");

const CHECK_INTERVAL = 60000;

const seenUsers = new Set();

async function getPendingRequests() {
    try {
        const response = await axios.get(
            `https://apis.roblox.com/cloud/v2/groups/${NEW_GROUP_ID}/join-requests`,
            {
                headers: {
                    "x-api-key": API_KEY
                }
            }
        );

        return response.data.groupJoinRequests || [];
    } catch (err) {
        console.error("Failed to fetch join requests:", err.response?.data || err.message);
        return [];
    }
}

async function getUserGroups(userId) {
    try {
        const response = await axios.get(
            `https://groups.roblox.com/v2/users/${userId}/groups/roles`
        );

        return response.data.data || [];
    } catch (err) {
        console.error("Failed to fetch user groups:", err.message);
        return [];
    }
}

async function sendDiscordAlert(user, matchingGroups) {
    const embed = {
        title: "⚠️ Pending Group Alert",
        color: 16711680,
        fields: [
            {
                name: "User",
                value: `${user.username} (${user.userId})`
            },
            {
                name: "Detected Groups",
                value: matchingGroups.join("\n")
            }
        ],
        timestamp: new Date().toISOString()
    };

    await axios.post(DISCORD_WEBHOOK_URL, {
        embeds: [embed]
    });
}

async function checkRequests() {
    console.log("Checking pending requests...");

    const requests = await getPendingRequests();

    for (const req of requests) {
        const userId = req.user?.id;
        const username = req.user?.name;

        if (!userId || seenUsers.has(userId)) continue;

        const groups = await getUserGroups(userId);

        const matches = groups.filter(group =>
            OLD_GROUP_IDS.includes(group.group.id.toString())
        );

        if (matches.length > 0) {
            const formatted = matches.map(group =>
                `${group.group.name} | Rank: ${group.role.name} (${group.role.rank})`
            );

            await sendDiscordAlert(
                {
                    userId,
                    username
                },
                formatted
            );

            console.log(`Alert sent for ${username}`);

            seenUsers.add(userId);
        }
    }
}

console.log("Bot started.");

checkRequests();

setInterval(checkRequests, CHECK_INTERVAL);
