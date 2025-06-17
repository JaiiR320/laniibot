const supabase = require("../db/client.js");
const logger = require("./logger");

/**
 * Checks if a user has the keeper role for a specific guild
 * @param {string} guild - The Discord guild
 * @param {string} userId - The Discord user ID
 * @returns {Promise<boolean>} - Whether the user is a keeper
 */
async function isKeeper(guild, userId) {
  logger.info("Permissions", `Checking keeper role for user ${userId}`);

  try {
    // Get the guild's keeper role ID
    const { data: guildData, error } = await supabase
      .from("guilds")
      .select("keeper_role_id")
      .eq("discord_id", guild.id)
      .single();

    if (error || !guildData) {
      logger.error("Permissions", "Failed to get keeper role", error);
      return false;
    }

    // Get the guild member
    const member = await guild.members.fetch(userId);

    // Check if the member has the keeper role
    const hasKeeperRole = member.roles.cache.has(guildData.keeper_role_id);
    logger.info(
      "Permissions",
      `User ${userId} is ${hasKeeperRole ? "a keeper" : "not a keeper"}`
    );

    return hasKeeperRole;
  } catch (error) {
    logger.error("Permissions", "Error checking keeper status", error);
    return false;
  }
}

module.exports = {
  isKeeper,
};
