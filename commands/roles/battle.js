const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const axios = require("axios");
const supabase = require("../../db/client.ts");

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
    const boardUrl = interaction.options.getString("boardurl");
    const role = interaction.options.getRole("role");
    const guild = interaction.options.getString("guild");

    await interaction.reply({
      content: `Battle command initiated by <@${interaction.user.id}>\nBoard URL: ${boardUrl}\nGuild: ${guild}\nRole: ${role}`,
    });

    const battleIds = battleIDs(boardUrl);
    if (!battleIds) {
      return interaction.followUp({
        content: "Invalid URL.",
      });
    }
    const isEU = boardUrl.includes("eu.albionbattles.com");
    const players = await getPlayers(battleIds, guild, isEU);
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
          } catch (error) {
            skips.push(mapping.username);
          }
        } catch (error) {
          skips.push(mapping.username);
        }
      })
    );
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
      return [];
    }

    if (urlObj.pathname.startsWith("/battles/")) {
      // Single battle URL
      const battleId = urlObj.pathname.split("/").pop();
      return [battleId];
    }

    if (urlObj.pathname === "/multilog") {
      // Multilog URL
      const ids = urlObj.searchParams.get("ids");
      if (!ids) return [];
      return ids.split(",");
    }

    return [];
  } catch (error) {
    return [];
  }
}

async function getPlayers(battleIds, guildName, isEU) {
  try {
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
    console.error(error);
    return [];
  }
}

async function getDiscordIds(players) {
  const { data, error } = await supabase
    .from("players")
    .select("username, id")
    .in("username", players);
  if (error) {
    console.error(error);
    return [];
  }
  return data;
}
