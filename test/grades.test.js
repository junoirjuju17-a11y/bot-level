import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PermissionsBitField, PermissionFlagsBits } from 'discord.js';
import { openSettings, GRADE_NAMES, resolveGrades, promotedGrade, validateTemplate } from '../src/settings.js';
import { createCommandHandler, commands } from '../src/commands.js';
import { createRoleUpdateHandler } from '../src/bot.js';

const config = { GUILD_ID: '123456789012345678' };
const ids = GRADE_NAMES.map((_, i) => String(234567890123456780n + BigInt(i)));
const member = ranks => ({ id: '456789012345678901', guild: { id: config.GUILD_ID }, roles: { cache: new Map(ranks.map(i => [ids[i], {}])) } });

test('sept grades dans l’ordre et noms ambigus ignorés', () => {
  const roles = new Map(GRADE_NAMES.map((name, i) => [ids[i], { id: ids[i], name }]));
  assert.deepEqual(resolveGrades(roles), ids);
  roles.set('duplicate', { id: 'duplicate', name: GRADE_NAMES[0] });
  assert.equal(resolveGrades(roles)[0], null);
  assert.equal(resolveGrades(new Map()).filter(Boolean).length, 0);
});

test('annonce seulement le plus haut nouveau palier, jamais une rétrogradation', () => {
  assert.equal(promotedGrade(member([]), member([0]), ids), ids[0]);
  assert.equal(promotedGrade(member([0]), member([0, 1]), ids), ids[1]);
  assert.equal(promotedGrade(member([1]), member([2]), ids), ids[2]);
  assert.equal(promotedGrade(member([0]), member([1, 2, 3]), ids), ids[3]);
  assert.equal(promotedGrade(member([3]), member([1]), ids), null);
  assert.equal(promotedGrade(member([3]), member([0, 3]), ids), null);
  assert.equal(promotedGrade(member([3]), member([]), ids), null);
  assert.equal(promotedGrade(member([3]), member([3]), ids), null);
});

test('réglages persistants, priorité sur env et aucune perte sur erreur', () => {
  const dir = mkdtempSync(join(tmpdir(), 'grade-test-'));
  try {
    const settings = openSettings(config, dir);
    settings.update({ template: 'Bravo {membre} : {grade}' });
    assert.equal(openSettings(config, dir).get().channelId, null);
    settings.update({ channelId: ids[0] });
    assert.deepEqual(openSettings({ ...config, CHANNEL_ID: ids[1] }, dir).get(), settings.get());
    assert.throws(() => settings.update({ template: 'Sans mention' }), /membre/);
    assert.equal(settings.get().template, 'Bravo {membre} : {grade}');
    writeFileSync(join(dir, `settings-${config.GUILD_ID}.json`), '{');
    assert.throws(() => openSettings(config, dir), /Impossible de lire/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('limites du texte après expansion et variables inconnues', () => {
  assert.throws(() => validateTemplate('x'.repeat(1980) + '{membre}'), /trop long/);
  assert.throws(() => validateTemplate('{membre} {inconnu}'), /Variables/);
  assert.equal(validateTemplate('Salut {membre}'), 'Salut {membre}');
});

function interaction(name, staff = true) {
  const replies = [];
  return { replies, commandName: name, guildId: config.GUILD_ID,
    memberPermissions: new PermissionsBitField(staff ? [PermissionFlagsBits.ManageGuild] : []),
    isChatInputCommand: () => true,
    options: { getChannel: () => ({ id: ids[0] }), getString: () => 'Bravo {membre}\\nGrade {grade}' },
    async reply(value) { replies.push(value); },
    async deferReply(value) { this.deferred = true; replies.push(value); },
    async editReply(value) { replies.push(value); },
  };
}

test('commandes staff : contrôle côté serveur, validation puis sauvegarde', async () => {
  const patches = []; const checked = []; const errors = [];
  const handler = createCommandHandler({ config, settings: { update: patch => patches.push(patch) },
    checkChannel: async id => checked.push(id), onError: error => errors.push(error) });
  await handler(interaction('grade-canal', false));
  assert.equal(patches.length, 0);
  const wrong = interaction('grade-canal'); wrong.guildId = 'other'; await handler(wrong);
  assert.equal(patches.length, 0);
  await handler(interaction('grade-canal'));
  assert.deepEqual(checked, [ids[0]]);
  assert.deepEqual(patches[0], { channelId: ids[0] });
  await handler(interaction('grade-message'));
  assert.deepEqual(patches[1], { template: 'Bravo {membre}\nGrade {grade}' });
  assert.deepEqual(errors, []);
  assert.ok(commands.every(command => command.default_member_permissions === String(PermissionFlagsBits.ManageGuild)));
});

test('canal refusé : aucune modification des réglages', async () => {
  const errors = [];
  const handler = createCommandHandler({ config, settings: { update: () => assert.fail('Modification interdite') },
    checkChannel: async () => { throw new Error('Permissions'); }, onError: error => errors.push(error) });
  await handler(interaction('grade-canal'));
  assert.equal(errors.length, 1);
});

test('promotion : canal et message configurés, seul le membre est notifié', async () => {
  const messages = [];
  const handler = createRoleUpdateHandler({ config, isReady: () => true, getGradeIds: () => ids,
    settings: { get: () => ({ channelId: ids[6], template: 'Bravo {membre} pour {grade} @everyone' }) },
    getChannel: async id => { assert.equal(id, ids[6]); return { send: async message => messages.push(message) }; },
    onError: assert.fail });
  await handler(member([0]), member([1, 2]));
  assert.equal(messages.length, 1);
  assert.equal(messages[0].content, `Bravo <@456789012345678901> pour <@&${ids[2]}> @everyone`);
  assert.deepEqual(messages[0].allowedMentions, { parse: [], users: ['456789012345678901'], roles: [] });
});

test('ajout staff persistant, doublons refusés et promotion vers le nouveau grade', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'grade-add-'));
  try {
    const settings = openSettings(config, dir);
    const id = '987654321098765432';
    const roles = new Map(GRADE_NAMES.map((name, i) => [ids[i], { id: ids[i], name }]));
    roles.set(id, { id, name: 'Nouveau grade', managed: false });
    const handler = createCommandHandler({ config, settings, onError: assert.fail });
    const make = (selected = id, staff = true) => {
      const value = interaction('grade-ajouter', staff);
      value.options.getRole = () => ({ id: selected });
      value.guild = { roles: { fetch: async () => roles } };
      return value;
    };
    await handler(make(id, false));
    assert.deepEqual(settings.get().additionalRoleIds, []);
    await handler(make());
    await handler(make());
    await handler(make(ids[0]));
    assert.deepEqual(settings.get().additionalRoleIds, [id]);
    const loaded = openSettings(config, dir);
    assert.deepEqual(loaded.get().additionalRoleIds, [id]);
    roles.get(id).name = 'Renommé';
    const grades = resolveGrades(roles, loaded.get().additionalRoleIds);
    assert.equal(grades.at(-1), id);
    const next = member([6]); next.roles.cache.set(id, {});
    assert.equal(promotedGrade(member([6]), next, grades), id);
    assert.equal(promotedGrade(next, next, grades), null);
    roles.delete(id);
    assert.deepEqual(resolveGrades(roles, [id]), ids);
    loaded.get().additionalRoleIds.push(ids[0]);
    assert.deepEqual(loaded.get().additionalRoleIds, [id]);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('migration des réglages et validation des rôles sauvegardés', () => {
  const dir = mkdtempSync(join(tmpdir(), 'grade-migrate-'));
  try {
    writeFileSync(join(dir, `settings-${config.GUILD_ID}.json`), JSON.stringify({ version: 1, channelId: null, template: 'Bravo {membre}' }));
    const settings = openSettings(config, dir);
    assert.deepEqual(settings.get().additionalRoleIds, []);
    assert.equal(settings.get().template, 'Bravo {membre}');
    assert.throws(() => settings.update({ additionalRoleIds: ['invalid'] }), /invalide/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('ajout refuse everyone, rôles gérés et rôles supprimés', async () => {
  for (const role of [null, { id: config.GUILD_ID }, { id: ids[0], managed: true }]) {
    const value = interaction('grade-ajouter');
    value.options.getRole = () => ({ id: role?.id ?? ids[0] });
    value.guild = { roles: { fetch: async () => new Map(role ? [[role.id, role]] : []) } };
    await createCommandHandler({ config, settings: { update: () => assert.fail('Ne doit pas sauvegarder') }, onError: assert.fail })(value);
    assert.match(value.replies.at(-1), /Choisis un rôle/);
  }
});
