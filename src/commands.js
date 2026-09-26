import { ChannelType, MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { validateTemplate } from './settings.js';

export const commands = [
  new SlashCommandBuilder().setName('grade-canal').setDescription('Choisir le canal des annonces de grades')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addChannelOption(option => option.setName('canal').setDescription('Canal de destination').setRequired(true)
      .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)),
  new SlashCommandBuilder().setName('grade-message').setDescription('Modifier le message : variables {membre} et {grade}')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption(option => option.setName('texte').setDescription('Inclure {membre} pour le ping, {grade} pour le grade ; \\n pour un retour à la ligne').setRequired(true).setMaxLength(2000)),
].map(command => command.toJSON());

export function createCommandHandler({ config, settings, checkChannel, onError }) {
  return async interaction => {
    if (!interaction.isChatInputCommand() || !commands.some(command => command.name === interaction.commandName)) return;
    try {
      if (interaction.guildId !== config.GUILD_ID || !interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
        await interaction.reply({ content: 'Commande réservée au staff avec la permission Gérer le serveur (ou Administrateur).', flags: MessageFlags.Ephemeral });
        return;
      }
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      if (interaction.commandName === 'grade-canal') {
        const chosen = interaction.options.getChannel('canal', true);
        await checkChannel(chosen.id);
        settings.update({ channelId: chosen.id });
        await interaction.editReply({ content: `Canal des annonces enregistré : <#${chosen.id}>.`, allowedMentions: { parse: [] } });
      } else {
        const template = validateTemplate(interaction.options.getString('texte', true).replaceAll('\\n', '\n'));
        settings.update({ template });
        await interaction.editReply({ content: 'Message enregistré. {membre} mentionnera la personne et {grade} affichera son nouveau grade.', allowedMentions: { parse: [] } });
      }
    } catch (error) {
      onError(error);
      try {
        const response = { content: 'Modification non confirmée : vérifie le canal et ses permissions, la présence de {membre}, la longueur du texte et les journaux du bot.', allowedMentions: { parse: [] } };
        if (interaction.deferred || interaction.replied) await interaction.editReply(response);
        else await interaction.reply({ ...response, flags: MessageFlags.Ephemeral });
      } catch (replyError) { onError(replyError); }
    }
  };
}
