const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const axios = require("axios");
const supabase = require("../../db/client.js");
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
    const isUserKeeper = await isKeeper(interaction.guild, interaction.user.id);

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

    const players = await getPlayers(boardUrl, guild);

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

// Example URLS
// https://albionbb.com/battles/1218601711
// https://albionbb.com/battles/multi?ids=1219723845,1219734327,1219742952
// https://albionbattles.com/battles/1218601711
// https://albionbattles.com/multilog?ids=1218601711,1218599037
function battleIDs(url) {
  try {
    const path = url.split("/").pop();
    if (path.includes("multi")) {
      const ids = path.split("=")[1].split(",");
      return ids;
    }
    return [path];
  } catch (error) {
    logger.error("Battle", "Error parsing battle URL", error);
    return [];
  }
}

async function getPlayers(boardUrl, guildName) {
  const ids = battleIDs(boardUrl);
  logger.info("Battle", `Found ${ids.length} battle IDs: ${ids.join(", ")}`);
  if (boardUrl.includes("albionbb.com")) {
    return await getPlayersAlbionBB(ids, guildName);
  } else if (boardUrl.includes("albionbattles.com")) {
    return await getPlayersAlbionBattles(ids, guildName);
  } else {
    logger.warn("Battle", `Invalid battle board domain: ${boardUrl}`);
    return [];
  }
}

async function getPlayersAlbionBattles(ids, guildName) {
  try {
    const response = await fetch(
      `https://api.albionbattles.com/battles/multilog/${ids.join(",")}`
    );
    const data = await response.json();
    const players = data.players.players;
    const guildMembers = [];
    for (const player of players) {
      if (player.guildName === guildName) {
        guildMembers.push(player.name);
      }
    }
    return guildMembers;
  } catch (error) {
    logger.error("Battle", "Error fetching players from battle board", error);
    return [];
  }
}

async function getPlayersAlbionBB(ids, guildName) {
  try {
    const response = await fetch(
      `https://api.albionbb.com/us/battles/kills?ids=${ids.join(",")}`
    );
    const kills = await response.json();
    const guildMembers = new Set();
    kills.forEach((event) => {
      if (event.Killer.GuildName === guildName) {
        guildMembers.add(event.Killer.Name);
      } else if (event.Victim.GuildName === guildName) {
        guildMembers.add(event.Victim.Name);
      }
    });
    return Array.from(guildMembers);
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
