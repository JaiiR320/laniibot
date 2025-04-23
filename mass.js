const fs = require("fs");
const { Client, IntentsBitField } = require("discord.js");
require("dotenv").config();

// Create a new client instance
const client = new Client({
  intents: [
    IntentsBitField.Flags.Guilds,
    IntentsBitField.Flags.GuildMessages,
    IntentsBitField.Flags.MessageContent,
    IntentsBitField.Flags.GuildMembers,
  ],
});

// Set the prefix
const prefix = "^";

client.once("ready", () => {
  console.log(`Mass mapping bot is ready`);
});

client.on("messageCreate", async (message) => {
  if (!message.content.startsWith(prefix) || message.author.bot) return;
  
  // Check if user is an administrator or has any of the keeper roles
  const isAdmin = message.member.permissions.has("Administrator");
  const config = JSON.parse(fs.readFileSync("./config.json"));
  const hasKeeperRole = message.member.roles.cache.some((role) =>
    config.keeperIds.includes(role.id)
  );
  const isDeveloper = message.author.id === "151003631204696064";
  if (!isAdmin && !hasKeeperRole && !isDeveloper) {
    return message.reply("You don't have permission to use this command.");
  }
  
  const args = message.content.slice(prefix.length).trim().split(/ +/g);
  const command = args.shift().toLowerCase();

  if (command === "massmap") {
    // Check if a file was attached
    if (message.attachments.size === 0) {
      return message.reply("Please attach a text file with player names (one per line).");
    }

    const attachment = message.attachments.first();
    if (!attachment.name.endsWith('.txt')) {
      return message.reply("Please attach a .txt file.");
    }

    try {
      // Download the file
      const response = await fetch(attachment.url);
      const text = await response.text();
      const playerNames = text.split('\n').map(name => name.trim()).filter(name => name.length > 0);
      
      if (playerNames.length === 0) {
        return message.reply("No player names found in the file.");
      }

      // Load existing mappings
      let discordUsers = {};
      try {
        discordUsers = JSON.parse(fs.readFileSync("discordUsers.json"));
      } catch (error) {
        // File doesn't exist or is invalid, start with empty object
      }

      // Send initial message
      await message.channel.send(`Found ${playerNames.length} player names. Starting mapping process...`);
      
      // Process each player name one by one
      for (let i = 0; i < playerNames.length; i++) {
        const playerName = playerNames[i];
        
        // Skip if already mapped
        if (discordUsers[playerName]) {
          await message.channel.send(`**${playerName}** is already mapped to <@${discordUsers[playerName]}>. Skipping...`);
          continue;
        }
        
        // Ask for the Discord user
        const response = await message.channel.send(`[${i+1}/${playerNames.length}] Please mention the Discord user for **${playerName}** or type their username. Type 'skip' to skip this player.`);
        
        // Create a message collector
        const messageFilter = m => m.author.id === message.author.id;
        const messageCollector = response.channel.createMessageCollector({ 
          filter: messageFilter, 
          max: 1, 
          time: 60000 
        });
        
        // Wait for the user's response
        const collected = await new Promise((resolve) => {
          messageCollector.on('collect', m => {
            resolve(m);
          });
          
          messageCollector.on('end', collected => {
            if (collected.size === 0) {
              resolve(null);
            }
          });
        });
        
        if (!collected) {
          await message.channel.send(`No response received for **${playerName}**. Skipping...`);
          continue;
        }
        
        // Check if user wants to skip
        if (collected.content.toLowerCase() === 'skip') {
          await message.channel.send(`Skipped **${playerName}**.`);
          continue;
        }
        
        let discordId = null;
        
        // Check if a user was mentioned
        if (collected.mentions.users.size > 0) {
          discordId = collected.mentions.users.first().id;
        } else {
          // Try to find a user by username
          const username = collected.content.trim();
          const member = message.guild.members.cache.find(m => 
            m.user.username.toLowerCase() === username.toLowerCase() || 
            m.displayName.toLowerCase() === username.toLowerCase()
          );
          
          if (member) {
            discordId = member.id;
          }
        }
        
        if (discordId) {
          // Update the mapping
          discordUsers[playerName] = discordId;
          fs.writeFileSync("discordUsers.json", JSON.stringify(discordUsers, null, 2));
          await message.channel.send(`Mapped **${playerName}** to <@${discordId}>`);
        } else {
          await message.channel.send(`Could not find a Discord user matching "${collected.content}". Skipping...`);
        }
      }
      
      await message.channel.send("All players have been processed.");
      
    } catch (error) {
      console.error("Error processing file:", error);
      message.reply("An error occurred while processing the file.");
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
