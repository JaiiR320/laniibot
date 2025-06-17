const { SlashCommandBuilder } = require("discord.js");
const logger = require("../../utils/logger");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Replies with Pong!"),
  async execute(interaction) {
    logger.debug("Ping", `Ping command used by ${interaction.user.tag}`);
    await interaction.reply("Pong!");
  },
};
