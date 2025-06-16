const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const supabase = require("../../db/client.ts");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("init")
    .setDescription("Initialize the guild")
    .addStringOption((option) =>
      option
        .setName("guild")
        .setDescription("The guild to initialize")
        .setRequired(true)
    ),
  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const guildName = interaction.options.getString("guild");

    const url = `https://gameinfo.albiononline.com/api/gameinfo/search?q=${guildName}`;

    // get list of potential guilds
    const response = await fetch(url);
    const data = await response.json();
    const guildList = data.guilds;

    // find the guild
    const guild = guildList.find(
      (guild) => guild.Name.toLowerCase() === guildName.toLowerCase()
    );

    // if the guild is not found, return an error
    if (!guild) {
      return interaction.editReply({ content: "Guild not found." });
    }

    // get the discord server id
    const discordId = interaction.guildId;

    // check if the guild is already initialized
    const { data: guildData, error } = await supabase
      .from("guilds")
      .select("*")
      .eq("discord_id", discordId);

    if (error) {
      return interaction.editReply({ content: "Error initializing guild." });
    }

    if (guildData.length > 0) {
      return interaction.editReply({
        content: "This server already has a guild.",
      });
    }

    // initialize the guild
    const { error: guildError } = await supabase.from("guilds").insert({
      albion_guild_id: guild.Id,
      discord_id: interaction.guildId,
      albion_guild_name: guild.Name,
    });

    if (guildError) {
      return interaction.editReply({
        content: "Error initializing guild.",
      });
    }

    return interaction.editReply({ content: "Guild initialized." });
  },
};
