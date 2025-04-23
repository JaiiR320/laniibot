const { Client, IntentsBitField } = require("discord.js");
require("dotenv").config();
const fs = require("fs");
const axios = require("axios");
const config = require("./config.json");

const client = new Client({
  intents: [
    IntentsBitField.Flags.Guilds,
    IntentsBitField.Flags.GuildMessages,
    IntentsBitField.Flags.MessageContent,
    IntentsBitField.Flags.GuildMembers,
  ],
});

client.once("ready", () => {
  console.log(`Laniibot active`);
});

// Set the prefix
let prefix = "!";
client.on("messageCreate", async (message) => {
  if (!message.content.startsWith(prefix) || message.author.bot) return;
  
  // Check if user has any of the keeper roles
  const hasKeeperRole = message.member.roles.cache.some(role => 
    config.keeperIds.includes(role.id)
  );
  
  if (!hasKeeperRole) {
    return message.reply("You don't have permission to use this command.");
  }
  
  const args = message.content.slice(prefix.length).trim().split(/ +/g);
  const command = args.shift().toLowerCase();

  if (command === "ping") {
    message.reply(
      `Yes, I am still alive.\nStuck in a container... in the cloud...\n-# please help`
    );
  }

  if (command === "help") {
    message.reply(`
      \`\`\`md
# Commands
!help - get a list of commands
!ping - check if the bot is responding

## Configuration
!setkeeper <role> - add a role to the keeper roles
!removekeeper <role> - remove a role from the keeper roles
!getkeeper - get the list of keeper roles
!setguild <guild_name> - set the guild name to filter out users
!getguild - get the guild name to filter out users

## Player Management
!map <ign> <user> - map a player's ign to their discord id
!unmap <ign> - unmap a player's ign from their discord id

## Role Management
!battle <role> <battle_id> - add a role to all players in a battle
!addrole <role> <user> - add a role to a specific user
!removerole <role> <user> - remove a role from a specific user
\`\`\`
      `);
  }

  if (command === "setguild") {
    const guildName = args[0];
    if (!guildName) {
      return message.reply("Please provide a guild name.");
    }
    config.guildName = guildName;
    fs.writeFileSync("./config.json", JSON.stringify(config, null, 2));
    message.reply(`Guild name set to ${guildName}`);
  }

  if (command === "getguild") {
    message.reply(`Guild name is ${config.guildName}`);
  }

  if (command === "setkeeper") {
    const role = message.mentions.roles.first();
    if (!role) {
      return message.reply("Please provide a role.");
    }
    
    // Initialize keeperIds array if it doesn't exist
    if (!config.keeperIds) {
      config.keeperIds = [];
    }
    
    // Add the role if it's not already in the array
    if (!config.keeperIds.includes(role.id)) {
      config.keeperIds.push(role.id);
      fs.writeFileSync("./config.json", JSON.stringify(config, null, 2));
      message.reply(`Added <@&${role.id}> to keeper roles`);
    } else {
      message.reply(`<@&${role.id}> is already a keeper role`);
    }
  }

  if (command === "getkeeper") {
    if (!config.keeperIds || config.keeperIds.length === 0) {
      return message.reply("No keeper roles are set.");
    }
    
    const roleMentions = config.keeperIds.map(roleId => {
      const role = message.guild.roles.cache.get(roleId);
      return role ? `<@&${role.id}>` : `Unknown Role (${roleId})`;
    });
    
    message.reply(`Keeper roles: ${roleMentions.join(", ")}`);
  }

  if (command === "removekeeper") {
    const role = message.mentions.roles.first();
    if (!role) {
      return message.reply("Please provide a role to remove.");
    }
    
    if (!config.keeperIds || !config.keeperIds.includes(role.id)) {
      return message.reply(`<@&${role.id}> is not a keeper role`);
    }
    
    config.keeperIds = config.keeperIds.filter(id => id !== role.id);
    fs.writeFileSync("./config.json", JSON.stringify(config, null, 2));
    message.reply(`Removed <@&${role.id}> from keeper roles`);
  }

  if (command === "map") {
    if (args.length != 2) {
      return message.reply("Please provide a player name and a Discord ID.");
    }
    const ign = args[0];
    const member = message.mentions.members.first();
    if (!member) {
      return message.reply("Please mention a player.");
    }
    const discordID = member.id;

    const discordUsers = JSON.parse(fs.readFileSync("discordUsers.json"));
    discordUsers[ign] = discordID;
    fs.writeFileSync(
      "./discordUsers.json",
      JSON.stringify(discordUsers, null, 2)
    );
    message.reply(`Mapped ${ign} to <@${discordID}>`);
  }

  if (command === "unmap") {
    const ign = args[0];
    const discordUsers = JSON.parse(fs.readFileSync("discordUsers.json"));
    delete discordUsers[ign];
    fs.writeFileSync(
      "./discordUsers.json",
      JSON.stringify(discordUsers, null, 2)
    );
    message.reply(`Unmapped ${ign}`);
  }

  if (command === "battle") {
    const role = message.mentions.roles.first();
    if (!role) {
      return message.reply("Please mention a role to add.");
    }
    const url = args[1];
    if (!url) {
      return message.reply("Please provide a URL.");
    }
    const battleIds = battleIDs(url);
    if (!battleIds) {
      return message.reply("Invalid URL.");
    }
    const players = await getPlayers(battleIds);
    const guildPlayers = players.filter((player) => {
      return player.guildName === config.guildName;
    });

    if (guildPlayers.length === 0) {
      return message.reply(`No players from ${config.guildName} found in battle.`);
    }

    let noID = [];
    let added = [];
    const discordUsers = JSON.parse(fs.readFileSync("discordUsers.json"));
    for (const player of guildPlayers) {
      const discordID = discordUsers[player.name];
      const member = message.guild.members.cache.get(discordID);
      if (member) {
        member.roles.add(role);
        added.push(`<@${member.id}>`);
      } else {
        noID.push(player.name);
      }
    }

    if (added.length != 0)
      message.reply(`Added <@&${role.id}> to ${added.join(", ")}`);
    if (noID.length != 0) {
      message.reply(
        `Cannot add role to ${noID.join(
          ", "
        )}.\nUse the !map command to map a discord ID to a player`
      );
    }
  }

  if (command === "addrole") {
    const role = message.mentions.roles.first();
    if (!role) {
      return message.reply("Please mention a role to add.");
    }
    const members = message.mentions.members;
    if (members.size === 0) {
      return message.reply("Please mention at least one user.");
    }

    if (!message.guild.roles.cache.find((r) => r.name === role.name)) {
      return message.reply(`Could not find role ${role.name}`);
    }

    members.forEach((member) => {
      try {
        member.roles.add(role);
      } catch (error) {
        console.error(`Failed to add role to ${member.user.tag}:`, error);
      }
    });
    message.reply(`Added role ${role} to ${members.size} members`);
  }
  if (command === "removerole") {
    const role = message.mentions.roles.first();
    if (!role) {
      return message.reply("Please mention a role to remove.");
    }

    if (message.mentions.members.size > 0) {
      const members = message.mentions.members;
      members.forEach((member) => {
        member.roles.remove(role);
      });
      message.reply(`Removed role ${role} from ${members.size} members`);
    } else {
      const membersWithRole = message.guild.members.cache.filter((member) =>
        member.roles.cache.has(role.id)
      );
      if (membersWithRole.size === 0) {
        return message.reply(`No members have the role ${role.name}`);
      }

      membersWithRole.forEach((member) => {
        member.roles.remove(role);
      });
      message.reply(
        `Removed role ${role} from ${membersWithRole.size} members`
      );
    }
  }
});

client.login(process.env.DISCORD_TOKEN);

function battleIDs(url) {
  try {
    const urlObj = new URL(url);

    if (urlObj.hostname !== "albionbattles.com") {
      return false;
    }

    if (urlObj.pathname.startsWith("/battles/")) {
      // Single battle URL
      const battleId = urlObj.pathname.split("/").pop();
      return [battleId];
    }

    if (urlObj.pathname === "/multilog") {
      // Multilog URL
      const ids = urlObj.searchParams.get("ids");
      if (!ids) return false;
      return ids.split(",");
    }

    return false;
  } catch (error) {
    return false;
  }
}

async function getPlayers(battleIds) {
  try {
    const response = await axios.get(
      `https://api.albionbattles.com/battles/multilog/${battleIds.join(",")}`
    );
    const players = response.data.players.players;
    const playerData = [];
    for (const player of players) {
      const obj = {
        name: player.name,
        guildName: player.guildName,
      };
      playerData.push(obj);
    }
    return playerData;
  } catch (error) {
    console.error("Error fetching players", error);
    return [];
  }
}
