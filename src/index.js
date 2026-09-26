import dotenv from 'dotenv';
import { Client, Events, GatewayIntentBits } from 'discord.js';
import { readConfig, describeError } from './config.js';
import { createRoleUpdateHandler, validateChannel } from './bot.js';
import { openSettings, resolveGrades, GRADE_NAMES } from './settings.js';
import { commands, createCommandHandler } from './commands.js';

dotenv.config({ path: new URL('../.env', import.meta.url), quiet: true });

let client;
try {
  const config = readConfig();
  const settings = openSettings(config);
  client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });
  let initialized = false;
  const logError = error => console.error(`[Erreur] ${describeError(error, config.DISCORD_TOKEN)}`);
  const getChannel = async (channelId = settings.get().channelId) => {
    if (!channelId) throw new Error('Aucun canal configuré : utiliser /grade-canal.');
    const guild = client.guilds.cache.get(config.GUILD_ID);
    if (!guild?.available) throw new Error('Serveur configuré indisponible.');
    const [channel, me] = await Promise.all([
      guild.channels.fetch(channelId, { force: true }),
      guild.members.fetchMe(),
    ]);
    return validateChannel(channel, config.GUILD_ID, me);
  };
  client.on(Events.InteractionCreate, createCommandHandler({ config, settings, checkChannel: getChannel, onError: logError }));

  client.on(Events.GuildMemberUpdate, createRoleUpdateHandler({
    config,
    isReady: () => initialized && client.isReady(),
    getChannel,
    settings,
    getGradeIds: () => resolveGrades(client.guilds.cache.get(config.GUILD_ID).roles.cache),
    onError: logError,
    onSent: (userId, roleId) => console.log(`[Annonce] Grade ${roleId} atteint par ${userId}.`),
  }));

  client.once(Events.ClientReady, async readyClient => {
    console.log(`[Connexion] Connecté en tant que ${readyClient.user.tag}.`);
    try {
      const guild = readyClient.guilds.cache.get(config.GUILD_ID);
      if (!guild) throw new Error('GUILD_ID introuvable : invitez le bot sur ce serveur et vérifiez son ID.');
      await guild.roles.fetch();
      const gradeIds = resolveGrades(guild.roles.cache);
      gradeIds.forEach((id, index) => { if (!id) console.warn(`[Grades] Rôle absent ou nom en double : ${GRADE_NAMES[index]}. Ce palier sera ignoré.`); });
      // Crée/met à jour uniquement nos commandes, sans effacer les autres commandes du bot.
      for (const command of commands) await guild.commands.create(command);
      try { await getChannel(); } catch (error) { logError(error); }
      // Constitue uniquement le cache de référence, sans aucune annonce rétroactive.
      await guild.members.fetch({ time: 120_000 });
      initialized = true;
      console.log('[Prêt] Surveillance des sept grades. Configuration : /grade-canal et /grade-message.');
    } catch (error) {
      logError(error);
      process.exitCode = 1;
      client.destroy();
    }
  });

  client.on(Events.Error, logError);
  client.on(Events.ShardError, logError);
  client.on(Events.ShardDisconnect, event => {
    console.error(`[Gateway] Déconnexion (code ${event.code}).`);
    if ([4004, 4013, 4014].includes(event.code)) {
      logError({ code: event.code, message: 'Gateway Intents invalides : vérifiez la configuration.' });
      process.exitCode = 1;
      client.destroy();
    }
  });
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.once(signal, () => {
      initialized = false;
      console.log('[Arrêt] Déconnexion du bot.');
      client.destroy();
    });
  }
  await client.login(config.DISCORD_TOKEN);
} catch (error) {
  console.error(`[Démarrage impossible] ${describeError(error, process.env.DISCORD_TOKEN?.trim())}`);
  client?.destroy();
  process.exitCode = 1;
}
