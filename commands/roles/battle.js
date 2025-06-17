const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const axios = require("axios");
const supabase = require("../../db/client.ts");
const logger = require("../../utils/logger");
const { isKeeper } = require("../../utils/permissions");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("battle")
    .setDescription("Add a role to guild members based on the battle board")
    .addStringOption((option) =>
      option
        .setName("boardurl")
        .setDescription("The battle board to use")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("guild")
        .setDescription("The guild to use")
        .setRequired(true)
    )
    .addRoleOption((option) =>
      option
        .setName("role")
        .setDescription("The role to add to the guild members")
        .setRequired(true)
    ),
  async execute(interaction) {
    logger.info("Battle", "Checking keeper permissions");
    const isUserKeeper = await isKeeper(
      interaction.guildId,
      interaction.user.id
    );

    if (!isUserKeeper) {
      logger.warn("Battle", "User does not have keeper role", {
        userId: interaction.user.id,
      });
      return interaction.reply({
        content: "You must have the keeper role to use this command.",
        flags: MessageFlags.Ephemeral,
      });
    }
    const boardUrl = interaction.options.getString("boardurl");
    const role = interaction.options.getRole("role");
    const guild = interaction.options.getString("guild");

    logger.info("Battle", `Command initiated by ${interaction.user.tag}`, {
      boardUrl,
      guild,
      role: role.name,
    });

    await interaction.reply({
      content: `Battle command initiated by <@${interaction.user.id}>\nBoard URL: ${boardUrl}\nGuild: ${guild}\nRole: ${role}`,
    });

    const battleIds = battleIDs(boardUrl);
    if (!battleIds) {
      logger.warn("Battle", "Invalid battle board URL", { boardUrl });
      return interaction.followUp({
        content: "Invalid URL.",
      });
    }

    const isEU = boardUrl.includes("eu.albionbattles.com");
    const players = await getPlayers(battleIds, guild, isEU);

    logger.info(
      "Battle",
      `Found ${players.length} players from guild ${guild}`,
      { players }
    );
    await interaction.followUp({
      content: `Found ${players.length} ${guild} players: ${players.join(
        ", "
      )}`,
    });

    const discordIds = await getDiscordIds(players);
    const haveIds = discordIds.filter((mapping) => mapping.id);
    const missingIds = players.filter(
      (player) => !discordIds.find((mapping) => mapping.username === player)
    );

    if (missingIds.length > 0) {
      logger.warn("Battle", `Players missing Discord IDs`, { missingIds });
      await interaction.followUp({
        content: `Players missing Discord IDs: ${missingIds.join(", ")}`,
      });
    }

    let skips = [];
    let completed = [];
    await Promise.all(
      haveIds.map(async (mapping) => {
        try {
          const member = await interaction.guild.members.fetch(mapping.id);
          try {
            await member.roles.add(role);
            completed.push(mapping.username);
            logger.debug("Battle", `Added role to player ${mapping.username}`);
          } catch (error) {
            logger.error(
              "Battle",
              `Failed to add role to player ${mapping.username}`,
              error
            );
            skips.push(mapping.username);
          }
        } catch (error) {
          logger.error(
            "Battle",
            `Failed to fetch member ${mapping.username}`,
            error
          );
          skips.push(mapping.username);
        }
      })
    );

    logger.info("Battle", "Role assignment completed", {
      completed: completed.length,
      skipped: skips.length + missingIds.length,
    });

    return interaction.followUp({
      content: `Finished adding ${
        completed.length
      } ${guild} players to the role ${role}\nSkipped ${
        skips.length + missingIds.length
      } players: ${[...skips, ...missingIds].join(", ")}`,
    });
  },
};

function battleIDs(url) {
  try {
    const urlObj = new URL(url);

    // Check for both domains
    if (
      !["albionbattles.com", "eu.albionbattles.com"].includes(urlObj.hostname)
    ) {
      logger.warn("Battle", "Invalid battle board domain", { url });
      return [];
    }

    if (urlObj.pathname.startsWith("/battles/")) {
      // Single battle URL
      const battleId = urlObj.pathname.split("/").pop();
      logger.debug("Battle", "Found single battle ID", { battleId });
      return [battleId];
    }

    if (urlObj.pathname === "/multilog") {
      // Multilog URL
      const ids = urlObj.searchParams.get("ids");
      if (!ids) {
        logger.warn("Battle", "No battle IDs in multilog URL");
        return [];
      }
      const battleIds = ids.split(",");
      logger.debug("Battle", "Found multiple battle IDs", { battleIds });
      return battleIds;
    }

    return [];
  } catch (error) {
    logger.error("Battle", "Error parsing battle board URL", error);
    return [];
  }
}

async function getPlayers(battleIds, guildName, isEU) {
  try {
    logger.debug("Battle", "Fetching players from battle board", {
      battleIds,
      guildName,
      isEU,
    });
    const response = await axios.get(
      `https://api${
        isEU ? "-eu" : ""
      }.albionbattles.com/battles/multilog/${battleIds.join(",")}`
    );
    // all players from board
    const players = response.data.players.players;
    const playerData = [];
    for (const player of players) {
      if (player.guildName === guildName) {
        playerData.push(player.name);
      }
    }
    return playerData;
  } catch (error) {
    logger.error("Battle", "Error fetching players from battle board", error);
    return [];
  }
}

async function getDiscordIds(players) {
  try {
    logger.debug("Battle", "Fetching Discord IDs for players", { players });
    const { data, error } = await supabase
      .from("players")
      .select("username, id")
      .in("username", players);

    if (error) {
      logger.error("Battle", "Error fetching Discord IDs from database", error);
      return [];
    }
    return data;
  } catch (error) {
    logger.error("Battle", "Unexpected error fetching Discord IDs", error);
    return [];
  }
}
