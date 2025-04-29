const { SlashCommandBuilder, MessageFlags } = require("discord.js");

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
    // Defer the reply to give time for the operation
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const user = interaction.options.getUser("user");
    const role = interaction.options.getRole("role");

    // Get the member object
    const member = await interaction.guild.members
      .fetch(user.id)
      .catch(() => null);

    if (!member) {
      return interaction.editReply({
        content: "Could not find that user in this server.",
      });
    }

    if (!role) {
      return interaction.editReply({ content: "Please provide a valid role." });
    }

    try {
      // Check if the bot has permission to manage roles
      if (!interaction.guild.members.me.permissions.has("ManageRoles")) {
        return interaction.editReply({
          content:
            "I don't have permission to manage roles. Please check my permissions.",
        });
      }

      // Check if the bot's highest role is higher than the role being assigned
      if (
        interaction.guild.members.me.roles.highest.position <= role.position
      ) {
        return interaction.editReply({
          content: `I can't assign this role because it's higher than or equal to my highest role. (My highest role position: ${interaction.guild.members.me.roles.highest.position}, Role to assign position: ${role.position})`,
        });
      }

      // Add the role to the member
      await member.roles.add(role);

      return interaction.editReply({
        content: `Successfully added the role ${role} to ${user}.`,
      });
    } catch (error) {
      console.error("Error adding role:", error);
      return interaction.editReply({
        content: `Failed to add role: ${error.message}`,
      });
    }
  },
};
