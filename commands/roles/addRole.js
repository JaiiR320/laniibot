const { SlashCommandBuilder } = require("discord.js");
const logger = require("../../utils/logger");
const { UserSelectMenuBuilder, ActionRowBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("addrole")
    .setDescription("Add a role to a user")
    .addRoleOption((option) =>
      option
        .setName("role")
        .setDescription("The role to add to the user")
        .setRequired(true)
    )
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("The user to add the role to")
        .setRequired(true)
    ),
  async execute(interaction) {
    logger.info("AddRole", `Command initiated by ${interaction.user.tag}`, {
      targetUser: interaction.options.getUser("user").tag,
      role: interaction.options.getRole("role").name,
    });

    const userMenu = new UserSelectMenuBuilder()
      .setCustomId("user")
      .setMaxValues(25);
    const userRow = new ActionRowBuilder().setComponents(userMenu);

    const userList = [];

    const message = await interaction.channel.send({
      content: "Select the users to add the role to",
      components: [userRow],
    });

    const users = await message.awaitMessageComponent({
      time: 30000,
    });

    console.log(users);

    return;

    // Defer the reply to give time for the operation
    await interaction.deferReply();

    const user = interaction.options.getUser("user");
    const role = interaction.options.getRole("role");

    // Get the member object
    const member = await interaction.guild.members
      .fetch(user.id)
      .catch(() => null);

    if (!member) {
      logger.warn("AddRole", `User not found in server`, { userId: user.id });
      return interaction.editReply({
        content: "Could not find that user in this server.",
      });
    }

    if (!role) {
      logger.warn("AddRole", "Invalid role provided");
      return interaction.editReply({ content: "Please provide a valid role." });
    }

    try {
      // Check if the bot has permission to manage roles
      if (!interaction.guild.members.me.permissions.has("ManageRoles")) {
        logger.warn("AddRole", "Bot lacks ManageRoles permission");
        return interaction.editReply({
          content:
            "I don't have permission to manage roles. Please check my permissions.",
        });
      }

      // Check if the bot's highest role is higher than the role being assigned
      if (
        interaction.guild.members.me.roles.highest.position <= role.position
      ) {
        logger.warn("AddRole", "Role position too high", {
          botRolePosition: interaction.guild.members.me.roles.highest.position,
          targetRolePosition: role.position,
        });
        return interaction.editReply({
          content: `I can't assign this role because it's higher than or equal to my highest role. (My highest role position: ${interaction.guild.members.me.roles.highest.position}, Role to assign position: ${role.position})`,
        });
      }

      // Add the role to the member
      await member.roles.add(role);
      logger.info(
        "AddRole",
        `Successfully added role ${role.name} to user ${user.tag}`
      );

      return interaction.editReply({
        content: `Successfully added the role ${role} to ${user}.`,
        flags: [4096],
      });
    } catch (error) {
      logger.error("AddRole", "Error adding role", error);
      return interaction.editReply({
        content: `Failed to add role: ${error.message}`,
      });
    }
  },
};
