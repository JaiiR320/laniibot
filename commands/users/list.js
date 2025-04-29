const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("players")
    .setDescription("List all registered players in this server"),

  async execute(interaction) {
    try {
      // Check if user has permission to use this command
      const serverId = interaction.guildId;
      const userRoles = interaction.member.roles.cache.map(role => role.id);
      
      const hasPermission = await hasAllowedRole(serverId, userRoles);
      
      if (!hasPermission) {
        return await interaction.reply({
          content: "You don't have permission to use this command.",
          ephemeral: true
        });
      }
      
      // Get all players for this server
      const players = await getServerPlayers(serverId);
      
      if (players.length === 0) {
        return await interaction.reply({
          content: "No players have registered yet in this server.",
          ephemeral: true
        });
      }
      
      // Create an embed to display the players
      const embed = new EmbedBuilder()
        .setTitle(`Registered Players in ${interaction.guild.name}`)
        .setColor(0x0099FF)
        .setDescription(`Total players: ${players.length}`)
        .setTimestamp();
      
      // Add players to the embed
      const playerList = players.map(player => 
        `<@${player.discord_id}> - **${player.player_name}**`
      ).join('\n');
      
      embed.addFields({ name: 'Players', value: playerList });
      
      return await interaction.reply({
        embeds: [embed],
        ephemeral: true
      });
    } catch (error) {
      console.error("Error in players command:", error);
      return await interaction.reply({
        content: "There was an error retrieving the player list. Please try again later.",
        ephemeral: true
      });
    }
  },
}; 