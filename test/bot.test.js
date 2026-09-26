import test from 'node:test';
import assert from 'node:assert/strict';
import { ChannelType, PermissionFlagsBits, PermissionsBitField } from 'discord.js';
import { createMessage, createRoleUpdateHandler, validateChannel } from '../src/bot.js';
import { readConfig, describeError } from '../src/config.js';

const config = { DISCORD_TOKEN: 'fake-test-token', GUILD_ID: '123456789012345678', ROLE_ID: '234567890123456789', CHANNEL_ID: '345678901234567890' };
const member = (roles = [], guildId = config.GUILD_ID, partial = false) => ({
  id: '456789012345678901', guild: { id: guildId }, partial,
  roles: { cache: new Map(roles.map(id => [id, {}])) },
});

for (const [name, before, after, ready, expected] of [
  ['ajout du rôle surveillé', [], [config.ROLE_ID], true, 1],
  ['démarrage', [], [config.ROLE_ID], false, 0],
  ['rôle déjà présent', [config.ROLE_ID], [config.ROLE_ID], true, 0],
  ['ajout d’un autre rôle', [], ['999999999999999999'], true, 0],
  ['retrait du rôle surveillé', [config.ROLE_ID], [], true, 0],
  ['mise à jour du profil sans changement de rôle', [], [], true, 0],
]) {
  test(name, async () => {
    const messages = [];
    let fetches = 0;
    const handler = createRoleUpdateHandler({
      config, isReady: () => ready,
      getChannel: async () => { fetches++; return { send: async message => messages.push(message) }; },
      onError: error => assert.fail(error.message),
    });
    await handler(member(before), member(after));
    assert.equal(messages.length, expected);
    assert.equal(fetches, expected);
    if (expected) assert.deepEqual(messages[0], createMessage(member().id, config.ROLE_ID));
  });
}

test('ignore un autre serveur et les membres partiels', async () => {
  const handler = createRoleUpdateHandler({ config, isReady: () => true,
    getChannel: async () => assert.fail('Aucun envoi attendu'), onError: assert.fail });
  await handler(member(), member([config.ROLE_ID], '999999999999999999'));
  await handler(member([], config.GUILD_ID, true), member([config.ROLE_ID]));
});

test('ajout, autre mise à jour, retrait, nouvel ajout : exactement deux messages', async () => {
  let count = 0;
  const handler = createRoleUpdateHandler({ config, isReady: () => true,
    getChannel: async () => ({ send: async () => count++ }), onError: assert.fail });
  await handler(member(), member([config.ROLE_ID]));
  await handler(member([config.ROLE_ID]), member([config.ROLE_ID, '999999999999999999']));
  await handler(member([config.ROLE_ID]), member());
  await handler(member(), member([config.ROLE_ID]));
  assert.equal(count, 2);
});

test('erreurs de récupération et d’envoi capturées sans réessai aveugle', async () => {
  for (const failFetch of [true, false]) {
    const errors = [];
    const error = new Error('Missing Access');
    const handler = createRoleUpdateHandler({ config, isReady: () => true,
      getChannel: async () => {
        if (failFetch) throw error;
        return { send: async () => { throw error; } };
      }, onError: err => errors.push(err) });
    await handler(member(), member([config.ROLE_ID]));
    assert.deepEqual(errors, [error]);
  }
});

test('configuration : absences, espaces, IDs invalides et @everyone', () => {
  assert.throws(() => readConfig({}), /Variables manquantes/);
  assert.throws(() => readConfig({ ...config, CHANNEL_ID: 'abc' }), /CHANNEL_ID/);
  assert.throws(() => readConfig({ ...config, ROLE_ID: config.GUILD_ID }), /@everyone/);
  assert.deepEqual(readConfig({ ...config, GUILD_ID: ` ${config.GUILD_ID} ` }), config);
});

test('validation du canal et des permissions effectives', () => {
  const channel = {
    guildId: config.GUILD_ID, type: ChannelType.GuildText, isSendable: () => true,
    permissionsFor: () => new PermissionsBitField([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]),
  };
  assert.equal(validateChannel(channel, config.GUILD_ID, {}), channel);
  assert.throws(() => validateChannel(null, config.GUILD_ID, {}), /aucun canal/);
  assert.throws(() => validateChannel({ ...channel, guildId: 'other' }, config.GUILD_ID, {}), /appartenir/);
  assert.throws(() => validateChannel({ ...channel, type: ChannelType.GuildForum }, config.GUILD_ID, {}), /textuel/);
  assert.throws(() => validateChannel({ ...channel, permissionsFor: () => new PermissionsBitField() }, config.GUILD_ID, {}), /permissions/);
});

test('mentions explicitement limitées au membre et au rôle', () => {
  const message = createMessage(member().id, config.ROLE_ID);
  assert.ok(message.content.includes(`<@${member().id}>`));
  assert.ok(message.content.includes(`<@&${config.ROLE_ID}>`));
  assert.deepEqual(message.allowedMentions, { parse: [], users: [member().id], roles: [config.ROLE_ID] });
});

test('les erreurs ne divulguent pas le token', () => {
  assert.equal(describeError(new Error('Token secret invalide'), 'secret'), 'Token [TOKEN MASQUÉ] invalide');
  assert.match(describeError({ code: 4014 }), /Server Members Intent/);
});
