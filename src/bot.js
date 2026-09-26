import { ChannelType, PermissionFlagsBits } from 'discord.js';
import { promotedGrade } from './settings.js';

// Personnalisez le texte ici. Les mentions sont limitées aux IDs explicitement autorisés.
export function createMessage(userId, roleId) {
  return {
    content: `🎉 Félicitations <@${userId}> !\n\nTu viens d'obtenir le rôle <@&${roleId}>.`,
    allowedMentions: { parse: [], users: [userId], roles: [roleId] },
  };
}

export function validateChannel(channel, guildId, botMember) {
  if (!channel) throw new Error('CHANNEL_ID : aucun canal trouvé.');
  if (channel.guildId !== guildId) throw new Error('Le canal doit appartenir au serveur GUILD_ID.');
  if (![ChannelType.GuildText, ChannelType.GuildAnnouncement].includes(channel.type) || !channel.isSendable()) {
    throw new Error('CHANNEL_ID doit désigner un salon textuel ou un salon d’annonces où envoyer des messages (pas un forum, fil ou salon vocal).');
  }
  const permissions = channel.permissionsFor(botMember);
  if (!permissions?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages])) {
    throw new Error('Le bot doit avoir les permissions Voir le salon et Envoyer des messages dans le canal configuré.');
  }
  return channel;
}

export function createRoleUpdateHandler({ config, isReady, getChannel, onError, onSent = () => {}, settings, getGradeIds }) {
  return async (oldMember, newMember) => {
    if (!isReady() || newMember.guild.id !== config.GUILD_ID) return;
    // Un état incomplet ne prouve pas un ajout : ne jamais le deviner via un fetch après coup.
    if (oldMember.partial || newMember.partial) return;
    const roleId = getGradeIds ? promotedGrade(oldMember, newMember, getGradeIds())
      : (!oldMember.roles.cache.has(config.ROLE_ID) && newMember.roles.cache.has(config.ROLE_ID) ? config.ROLE_ID : null);
    if (!roleId) return;
    try {
      const current = settings?.get();
      const message = current ? {
        content: current.template.replaceAll('{membre}', `<@${newMember.id}>`).replaceAll('{grade}', `<@&${roleId}>`),
        allowedMentions: { parse: [], users: [newMember.id], roles: [] },
      } : createMessage(newMember.id, roleId);
      const channel = await getChannel(current?.channelId);
      await channel.send(message);
      onSent(newMember.id, roleId);
    } catch (error) {
      onError(error);
    }
  };
}
