const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const supabase = require("../../db/client.ts");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("register")
    .setDescription("Register a user to the guild")
    .addStringOption((option) =>
      option
        .setName("player")
        .setDescription("The player's ign to register")
        .setRequired(true)
    )
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("The user to register")
        .setRequired(false)
    ),
  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const player = interaction.options.getString("player");
    const user = interaction.options.getUser("user");
    const discordId = user ? user.id : interaction.user.id;

    const { error } = await supabase.from("players").insert({
      username: player,
      id: discordId,
    });

    if (error) {
      return interaction.editReply({ content: "Error registering player." });
    }

    return interaction.editReply({ content: "Player registered." });
  },
};
