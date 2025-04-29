const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const supabase = require("../../db/client.ts");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("unmap")
    .setDescription("Unmap a player from a user")
    .addStringOption((option) =>
      option
        .setName("player")
        .setDescription("The player's ign to unmap")
        .setRequired(true)
    )
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("The user to unmap the player from")
        .setRequired(true)
    ),
  async execute(interaction) {
    // Defer the reply to give time for the operation
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const player = interaction.options.getString("player");
    const user = interaction.options.getUser("user");
    // Get the member object
    const member = await interaction.guild.members
      .fetch(user.id)
      .catch(() => null);

    if (!member) {
      console.error("Could not find that user in this server.");
      return interaction.editReply({
        content: "Could not find that user in this server.",
        flags: MessageFlags.Ephemeral,
      });
    }

    const { error } = await supabase
      .from("Players")
      .delete()
      .eq("playerName", player);

    if (error) {
      console.error("Error unmapping player from user.", error);
      return interaction.editReply({
        content: "Error unmapping player from user." + error.message,
        flags: MessageFlags.Ephemeral,
      });
    }

    return interaction.editReply({
      content: `Player ${player} unmapped from <@${user.id}>`,
      flags: MessageFlags.Ephemeral,
    });
  },
};
