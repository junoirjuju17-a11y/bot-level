import { mkdirSync, readFileSync, writeFileSync, renameSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

export const GRADE_NAMES = ['Pâte à Brioche', 'Petit Briochon', 'Briochon Confirmé', 'Briochon Actif', 'Briochon Premium', 'Briochon VIP', 'Légende de la Corp'];
export const DEFAULT_MESSAGE = '🎉 Félicitations {membre} !\n\nTu viens de passer au grade {grade} !';
function validateAdditionalRoles(ids) {
  if (!Array.isArray(ids) || ids.some(id => typeof id !== 'string' || !/^[1-9]\d{16,19}$/.test(id)) || new Set(ids).size !== ids.length) {
    throw new Error('Liste des grades supplémentaires invalide.');
  }
  return [...ids];
}
export function validateTemplate(template) {
  if (typeof template !== 'string' || !template.trim()) throw new Error('Le message ne doit pas être vide.');
  if (!template.includes('{membre}')) throw new Error('Ajoute {membre} dans le message pour mentionner la personne.');
  if (/\{(?!membre\}|grade\})[^{}]*\}/u.test(template)) throw new Error('Variables disponibles : {membre} et {grade}.');
  const expanded = template.replaceAll('{membre}', `<@${'9'.repeat(20)}>`).replaceAll('{grade}', `<@&${'9'.repeat(20)}>`);
  if (expanded.length > 2000) throw new Error('Message trop long après remplacement des mentions (2000 caractères maximum).');
  return template;
}

export function openSettings(config, directory = process.env.DATA_DIR || new URL('../data/', import.meta.url)) {
  const root = directory instanceof URL ? directory : resolve(directory);
  const path = root instanceof URL ? new URL(`settings-${config.GUILD_ID}.json`, root) : resolve(root, `settings-${config.GUILD_ID}.json`);
  let state = { channelId: config.CHANNEL_ID || null, template: DEFAULT_MESSAGE, additionalRoleIds: [] };
  try {
    const saved = JSON.parse(readFileSync(path, 'utf8'));
    if (saved.version !== 1 || (saved.channelId !== null && !/^[1-9]\d{16,19}$/.test(saved.channelId ?? ''))) throw new Error('Format de configuration sauvegardée invalide.');
    state = { channelId: saved.channelId, template: validateTemplate(saved.template), additionalRoleIds: validateAdditionalRoles(saved.additionalRoleIds ?? []) };
  } catch (error) {
    if (error.code !== 'ENOENT') throw new Error(`Impossible de lire les réglages : ${error.message}`);
  }
  return {
    get: () => structuredClone(state),
    update(patch) {
      const next = { ...state, ...patch };
      next.additionalRoleIds = validateAdditionalRoles(next.additionalRoleIds);
      validateTemplate(next.template);
      if (next.channelId !== null && !/^[1-9]\d{16,19}$/.test(next.channelId)) throw new Error('ID du canal invalide.');
      // Écriture synchrone courte : sérialise les modifications et remplace atomiquement le fichier.
      const target = path instanceof URL ? path : resolve(path);
      const temporary = target instanceof URL ? new URL(`${target.href}.tmp`) : `${target}.tmp`;
      mkdirSync(target instanceof URL ? new URL('.', target) : dirname(target), { recursive: true });
      writeFileSync(temporary, JSON.stringify({ version: 1, ...next }, null, 2), { mode: 0o600 });
      renameSync(temporary, target);
      state = next;
      return structuredClone(state);
    },
  };
}

export function resolveGrades(roles, additionalRoleIds = []) {
  const defaults = GRADE_NAMES.map(name => {
    const matches = [...roles.values()].filter(role => role.name.normalize('NFC').trim() === name);
    return matches.length === 1 ? matches[0].id : null;
  });
  // Les rôles ajoutés sont suivis par ID, même après renommage. Les rôles supprimés sont ignorés.
  return [...defaults, ...additionalRoleIds.filter(id => roles.has(id) && !defaults.includes(id))];
}

export function promotedGrade(oldMember, newMember, gradeIds) {
  const highest = member => gradeIds.reduce((rank, id, index) => id && member.roles.cache.has(id) ? index : rank, -1);
  const before = highest(oldMember);
  const after = highest(newMember);
  return after > before && !oldMember.roles.cache.has(gradeIds[after]) ? gradeIds[after] : null;
}
