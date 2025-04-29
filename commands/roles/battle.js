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
        flags: MessageFlags.Ephemeral,
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
    const haveIds = discordIds.filter((mapping) => mapping.discordId);
    const missingIds = players.filter(
      (player) => !discordIds.find((mapping) => mapping.playerName === player)
    );

    if (missingIds.length > 0) {
      await interaction.followUp({
        content: `Players missing Discord IDs: ${missingIds.join(", ")}`,
        flags: MessageFlags.Ephemeral,
      });
    }
    let skips = [];
    let completed = [];
    haveIds.forEach(async (mapping) => {
      try {
        const member = await interaction.guild.members.fetch(mapping.discordId);
        console.log(member ? "true" : "false");
        try {
          await member.roles.add(role);
          completed.push(mapping.playerName);
        } catch (error) {
          skips.push(mapping.playerName);
        }
      } catch (error) {
        skips.push(mapping.playerName);
      }
    });
    console.log(completed);
    console.log(skips);
    return interaction.followUp({
      content: `Finished adding ${
        completed.length
      } ${guild} players to the role ${role}\nSkipped ${
        skips.length
      } players: ${skips.join(", ")}`,
      flags: MessageFlags.Ephemeral,
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
    .from("Players")
    .select("playerName, discordId")
    .in("playerName", players);
  if (error) {
    console.error(error);
    return [];
  }
  return data;
}
