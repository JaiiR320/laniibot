const { GuildMember } = require("discord.js");

const developerId = "151003631204696064";

function validUser(user) {
  if (!user) return false;

  const isAdmin = user.permissions.has("Administrator");
  const hasKeeperRole = user.roles.cache.some((role) =>
    getKeeperRoles(user.guild.id).includes(role.id)
  );
  const isDeveloper = user.id === developerId;

  return isAdmin || hasKeeperRole || isDeveloper;
}

function getKeeperRoles(id) {
  return ["1234567890"];
}

module.exports = { validUser };
