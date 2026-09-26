export function readConfig(env = process.env) {
  const keys = ['DISCORD_TOKEN', 'GUILD_ID', 'ROLE_ID', 'CHANNEL_ID'];
  const config = Object.fromEntries(keys.map(key => [key, env[key]?.trim()]));
  const missing = ['DISCORD_TOKEN', 'GUILD_ID'].filter(key => !config[key]);
  if (missing.length) throw new Error(`Variables manquantes dans .env : ${missing.join(', ')}.`);
  for (const key of keys.slice(1)) {
    if (!config[key]) continue;
    if (!/^[1-9]\d{16,19}$/.test(config[key]) || BigInt(config[key]) > 18446744073709551615n) {
      throw new Error(`${key} doit être un ID Discord numérique valide (copié en mode développeur).`);
    }
  }
  if (config.ROLE_ID === config.GUILD_ID) throw new Error('ROLE_ID ne doit pas désigner @everyone.');
  return config;
}

// Ne journalise jamais les objets d'erreur complets : ils peuvent contenir des requêtes.
export function describeError(error, token = '') {
  const hints = {
    50001: 'Accès Discord refusé : vérifiez le serveur et la visibilité du canal.',
    50013: 'Permissions insuffisantes : vérifiez Voir le salon et Envoyer des messages.',
    10003: 'Canal introuvable : vérifiez CHANNEL_ID.',
    10004: 'Serveur introuvable : vérifiez GUILD_ID et l’invitation du bot.',
    10011: 'Rôle introuvable : vérifiez ROLE_ID.',
    4004: 'Authentification refusée : vérifiez DISCORD_TOKEN.',
    4014: 'Intent refusé : activez Server Members Intent dans le Developer Portal.',
    TokenInvalid: 'Token invalide : vérifiez DISCORD_TOKEN.',
  };
  const message = hints[error?.code] ?? error?.message ?? 'Erreur Discord inconnue.';
  return token ? String(message).split(token).join('[TOKEN MASQUÉ]') : String(message);
}
