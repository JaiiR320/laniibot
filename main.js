const { Client, IntentsBitField } = require("discord.js");
require('dotenv').config();


const client = new Client({
  intents: [
    IntentsBitField.Flags.Guilds,
    IntentsBitField.Flags.GuildMessages,
    IntentsBitField.Flags.MessageContent,
    IntentsBitField.Flags.GuildMembers,
  ],
});

// Set the prefix
let prefix = "!";
client.on("messageCreate", (message) => {  
  // Only process messages from threads
  if (!message.channel.isThread()) return;
  if (!message.content.startsWith(prefix) || message.author.bot) return;
  const args = message.content.slice(prefix.length).trim().split(/ +/g);
  const command = args.shift().toLowerCase();

  if (command === "addrole") {
    const role = message.mentions.roles.first();
    if (!role) {
      return message.reply("Please mention a role to add.");
    }
    const members = message.mentions.members;
    if (members.size === 0) {
      return message.reply("Please mention at least one user.");
    }

    if (!message.guild.roles.cache.find(r => r.name === role.name)) {
      return message.reply(`Could not find role ${role.name}`);
    }

    members.forEach((member) => {
      try{
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
      const membersWithRole = message.guild.members.cache.filter(member => member.roles.cache.has(role.id));
      if (membersWithRole.size === 0) {
        return message.reply(`No members have the role ${role.name}`);
      }
  
      membersWithRole.forEach((member) => {
        member.roles.remove(role);
      });
      message.reply(`Removed role ${role} from ${membersWithRole.size} members`);
    }
  }

});

client.login(process.env.DISCORD_TOKEN);
