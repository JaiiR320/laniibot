const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const logger = require("../../utils/logger");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("removerole")
    .setDescription("Remove a role from a user")
    .addRoleOption((option) =>
      option
        .setName("role")
        .setDescription("The role to remove from the user")
        .setRequired(true)
    )
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("The user to remove the role from")
        .setRequired(true)
    ),
  async execute(interaction) {
    logger.info("RemoveRole", `Command initiated by ${interaction.user.tag}`, {
      targetUser: interaction.options.getUser("user").tag,
      role: interaction.options.getRole("role").name,
    });

    // Defer the reply to give time for the operation
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const user = interaction.options.getUser("user");
    const role = interaction.options.getRole("role");

    // Get the member object
    const member = await interaction.guild.members
      .fetch(user.id)
      .catch(() => null);

    if (!member) {
      logger.warn("RemoveRole", `User not found in server`, {
        userId: user.id,
      });
      return interaction.editReply({
        content: "Could not find that user in this server.",
      });
    }

    if (!role) {
      logger.warn("RemoveRole", "Invalid role provided");
      return interaction.editReply({ content: "Please provide a valid role." });
    }

    try {
      // Check if the bot has permission to manage roles
      if (!interaction.guild.members.me.permissions.has("ManageRoles")) {
        logger.warn("RemoveRole", "Bot lacks ManageRoles permission");
        return interaction.editReply({
          content:
            "I don't have permission to manage roles. Please check my permissions.",
        });
      }

      // Check if the bot's highest role is higher than the role being removed
      if (
        interaction.guild.members.me.roles.highest.position <= role.position
      ) {
        logger.warn("RemoveRole", "Role position too high", {
          botRolePosition: interaction.guild.members.me.roles.highest.position,
          targetRolePosition: role.position,
        });
        return interaction.editReply({
          content: `I can't remove this role because it's higher than or equal to my highest role. (My highest role position: ${interaction.guild.members.me.roles.highest.position}, Role to remove position: ${role.position})`,
        });
      }

      // Remove the role from the member
      await member.roles.remove(role);
      logger.info(
        "RemoveRole",
        `Successfully removed role ${role.name} from user ${user.tag}`
      );

      return interaction.editReply({
        content: `Successfully removed the role ${role} from ${user}.`,
      });
    } catch (error) {
      logger.error("RemoveRole", "Error removing role", error);
      return interaction.editReply({
        content: `Failed to remove role: ${error.message}`,
      });
    }
  },
};
