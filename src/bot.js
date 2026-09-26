import { ChannelType, PermissionFlagsBits } from 'discord.js';

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

export function createRoleUpdateHandler({ config, isReady, getChannel, onError, onSent = () => {} }) {
  return async (oldMember, newMember) => {
    if (!isReady() || newMember.guild.id !== config.GUILD_ID) return;
    // Un état incomplet ne prouve pas un ajout : ne jamais le deviner via un fetch après coup.
    if (oldMember.partial || newMember.partial) return;
    const hadRole = oldMember.roles.cache.has(config.ROLE_ID);
    const hasRole = newMember.roles.cache.has(config.ROLE_ID);
    if (hadRole || !hasRole) return;
    try {
      const channel = await getChannel();
      await channel.send(createMessage(newMember.id, config.ROLE_ID));
      onSent(newMember.id);
    } catch (error) {
      onError(error);
    }
  };
}
