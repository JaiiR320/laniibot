const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const supabase = require("../../db/client.ts");
const logger = require("../../utils/logger");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("init")
    .setDescription("Initialize the guild")
    .addStringOption((option) =>
      option
        .setName("guild")
        .setDescription("The guild to initialize")
        .setRequired(true)
    )
    .addRoleOption((option) =>
      option
        .setName("member_role")
        .setDescription("The role to assign to guild members")
        .setRequired(true)
    )
    .addRoleOption((option) =>
      option
        .setName("keeper_role")
        .setDescription("The role for guild keepers who can run admin commands")
        .setRequired(true)
    ),
  async execute(interaction) {
    logger.info(
      "Init",
      `${interaction.user.tag} initializing guild in ${interaction.guild.name}`
    );
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const guildName = interaction.options.getString("guild");
    const memberRoleId = interaction.options.getRole("member_role").id;
    const keeperRoleId = interaction.options.getRole("keeper_role").id;

    const url = `https://gameinfo.albiononline.com/api/gameinfo/search?q=${guildName}`;
    logger.debug("Init", `Searching Albion API for guild: ${guildName}`);

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
      logger.warn("Init", `Guild not found: ${guildName}`);
      return interaction.editReply({ content: "Guild not found." });
    }

    logger.info("Init", `Found Albion guild: ${guild.Name}`);

    // get the discord server id
    const discordId = interaction.guildId;

    // check if the guild is already initialized
    const { data: guildData, error } = await supabase
      .from("guilds")
      .select("*")
      .eq("discord_id", discordId);

    if (error) {
      logger.error(
        "Init",
        "Database error while checking existing guild",
        error
      );
      return interaction.editReply({ content: "Error initializing guild." });
    }

    if (guildData.length > 0) {
      logger.info("Init", `Guild already exists in database: ${discordId}`);
      return interaction.editReply({
        content: "This server already has a guild.",
      });
    }

    // initialize the guild
    logger.info("Init", `Creating guild record for ${guild.Name}`);
    const { error: guildError } = await supabase.from("guilds").insert({
      albion_guild_id: guild.Id,
      discord_id: interaction.guildId,
      albion_guild_name: guild.Name,
      member_role_id: memberRoleId,
      keeper_role_id: keeperRoleId,
    });

    if (guildError) {
      logger.error("Init", "Failed to create guild record", guildError);
      return interaction.editReply({
        content: "Error initializing guild.",
      });
    }

    logger.info("Init", `Successfully initialized ${guild.Name}`);
    return interaction.editReply({ content: "Guild initialized." });
  },
};
