const {
  SlashCommandBuilder,
  MessageFlags,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const supabase = require("../../db/client.ts");
const logger = require("../../utils/logger");

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
    logger.info("Register", "Starting registration process");

    const player = interaction.options.getString("player");
    const user = interaction.options.getUser("user");
    const discordId = user ? user.id : interaction.user.id;
    const guildId = interaction.guildId;

    // Send initial non-ephemeral message
    await interaction.reply({
      content: `${interaction.user.tag} is attempting to register ${player}${
        user ? ` for ${user.tag}` : ""
      }`,
    });

    logger.debug(
      "Register",
      `Processing registration for player: ${player}, Discord ID: ${discordId}, Guild ID: ${guildId}`
    );

    const response = await fetch(
      `https://gameinfo.albiononline.com/api/gameinfo/search?q=${player}`
    );

    const data = await response.json();
    logger.debug("Register", `API Response for ${player}:`, data);

    if (!data.players || data.players.length === 0) {
      logger.warn("Register", `Player not found in Albion Online: ${player}`);
      await interaction.followUp({ content: "Player not found." });
      return;
    }

    const foundPlayer = data.players[0];
    logger.info(
      "Register",
      `Found player: ${foundPlayer.Name}, Guild: ${foundPlayer.GuildName}`
    );

    if (!foundPlayer.GuildName) {
      logger.warn("Register", `Player ${foundPlayer.Name} is not in a guild`);
      await interaction.followUp({ content: "Player is not in a guild." });
      return;
    }

    // Get the server's associated Albion guild and member role
    const { data: serverGuild, error: guildError } = await supabase
      .from("guilds")
      .select("albion_guild_name, member_role_id")
      .eq("discord_id", guildId)
      .single();

    if (guildError) {
      logger.error("Register", "Error fetching server guild", guildError);
      await interaction.followUp({ content: "Error checking guild." });
      return;
    }

    if (!serverGuild.member_role_id) {
      logger.error("Register", "No member role configured for guild", {
        guildId,
      });
      await interaction.followUp({
        content: "Error: No member role configured for this guild.",
      });
      return;
    }

    logger.debug(
      "Register",
      `Server's associated Albion guild: ${serverGuild.albion_guild_name}`
    );
    logger.debug(
      "Register",
      `Player's current guild: ${foundPlayer.GuildName}`
    );

    if (serverGuild.albion_guild_name !== foundPlayer.GuildName) {
      logger.warn("Register", `Guild mismatch for player ${foundPlayer.Name}`, {
        playerGuild: foundPlayer.GuildName,
        serverGuild: serverGuild.albion_guild_name,
      });
      await interaction.followUp({
        content: `Player's guild (${foundPlayer.GuildName}) does not match this server's associated guild (${serverGuild.albion_guild_name}).`,
      });
      return;
    }

    // Send confirmation message (ephemeral)
    const confirmButton = new ButtonBuilder()
      .setCustomId("confirm_registration")
      .setLabel("Confirm Registration")
      .setStyle(ButtonStyle.Success);

    const cancelButton = new ButtonBuilder()
      .setCustomId("cancel_registration")
      .setLabel("Cancel")
      .setStyle(ButtonStyle.Danger);

    const row = new ActionRowBuilder().addComponents(
      confirmButton,
      cancelButton
    );

    const message = await interaction.followUp({
      content: `Found player ${foundPlayer.Name} in guild ${foundPlayer.GuildName}. Click the button below to confirm registration.`,
      components: [row],
      ephemeral: true,
    });

    logger.debug("Register", "Waiting for user confirmation");

    try {
      const confirmation = await message.awaitMessageComponent({
        filter: (i) => i.user.id === interaction.user.id,
        time: 30000,
      });

      if (confirmation.customId === "cancel_registration") {
        logger.info(
          "Register",
          `Registration cancelled by user ${interaction.user.tag}`
        );
        await confirmation.update({
          content: "Registration cancelled.",
          components: [],
        });
        await interaction.followUp({
          content: `Registration cancelled by ${interaction.user.tag}`,
        });
        return;
      }

      logger.info(
        "Register",
        `User ${interaction.user.tag} confirmed registration`
      );
      await confirmation.update({
        content: "Processing registration...",
        components: [],
      });

      const { error } = await supabase.from("players").insert({
        username: player,
        id: discordId,
      });

      if (error) {
        logger.error(
          "Register",
          "Database error during player registration",
          error
        );
        if (error.code === "23505") {
          await interaction.followUp({ content: "Player already registered." });
          return;
        }
        await interaction.followUp({ content: "Error registering player." });
        return;
      }

      // Assign the member role
      try {
        const member = await interaction.guild.members.fetch(discordId);
        await member.roles.add(serverGuild.member_role_id);
        logger.info(
          "Register",
          `Successfully assigned member role to user ${discordId}`
        );
      } catch (roleError) {
        logger.error("Register", "Error assigning member role", roleError);
        await interaction.followUp({
          content:
            "Player registered but failed to assign member role. Please contact an administrator.",
        });
        return;
      }

      logger.info(
        "Register",
        `Successfully registered player ${player} with Discord ID ${discordId}`
      );
      await interaction.followUp({
        content: `✅ Successfully registered ${player}${
          user ? ` for ${user.tag}` : ""
        } and assigned member role.`,
      });
    } catch (error) {
      logger.error("Register", "Registration timed out or failed", error);
      await interaction.followUp({
        content: "Registration timed out or failed.",
        components: [],
      });
    }
  },
};
