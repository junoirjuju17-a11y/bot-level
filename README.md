# Bot Discord — annonce d’un rôle ajouté

Projet JavaScript exécutable avec Node.js, discord.js **14.27.0** (version stable installée) et dotenv **18.0.4**. Un seul serveur, un rôle surveillé et un canal de destination sont configurés dans `.env`.

## Prérequis

- Installer [Node.js](https://nodejs.org/) **22.12.0 minimum**, de préférence Node.js 24 LTS, avec npm. Vérifier `node --version` et `npm --version` dans un nouveau terminal.
- Pouvoir ajouter une application au serveur et gérer les rôles des membres pour les essais.
- Garder le processus Node.js en cours d’exécution sur une machine connectée à Internet.

## 1. Créer l’application

Ouvrir le [Discord Developer Portal](https://discord.com/developers/applications), se connecter, cliquer sur **New Application**, choisir un nom puis valider.

## 2. Créer/configurer le bot

Ouvrir l’onglet **Bot** de l’application. Si le portail propose **Add Bot**, cliquer dessus ; sinon, l’utilisateur bot est déjà créé. Choisir son nom et son avatar si souhaité.

Dans **Token**, utiliser **Reset Token** pour générer/copier le token. Le conserver uniquement dans le fichier `.env` local. Ne pas l’envoyer dans un message, une capture d’écran ou Git. En cas de fuite, réinitialiser immédiatement le token dans le portail et mettre à jour `.env`.

## 3. Activer les Gateway Intents

Dans **Bot → Privileged Gateway Intents**, activer **Server Members Intent**, puis enregistrer. C’est indispensable pour recevoir les changements de rôles et charger les membres.

Le code utilise `GatewayIntentBits.Guilds` et `GatewayIntentBits.GuildMembers`. `Guilds` n’a pas de bouton privilégié à activer. **Message Content Intent** et **Presence Intent** ne sont pas nécessaires. Si Discord demande une approbation pour les intents privilégiés de votre application, suivre les indications du portail.

## 4. Inviter le bot

Dans **OAuth2 → URL Generator**, sélectionner le scope **bot**. Sélectionner les permissions décrites ci-dessous, copier l’URL générée, l’ouvrir, choisir le serveur et autoriser l’application. Le scope `applications.commands` n’est pas nécessaire : le bot n’a pas de commandes slash. Si le portail demande un contexte d’installation, choisir **Guild Install** / installation sur serveur.

## 5. Donner les permissions nécessaires

Dans **Bot Permissions**, sélectionner :

- **View Channels** / Voir les salons ;
- **Send Messages** / Envoyer des messages.

Vérifier aussi les dérogations de permissions dans le canal cible, notamment si le salon est privé. Le bot n’a besoin ni d’Administrateur, ni de Gérer les rôles, ni de Lire l’historique des messages. Il observe les rôles sans les attribuer et son rôle n’a pas besoin d’être au-dessus du rôle surveillé.

Le canal doit être un **salon textuel** ou **salon d’annonces** du serveur configuré. Les forums, fils, catégories et salons vocaux sont volontairement rejetés avec un message explicite.

Le texte affiche les mentions `<@USER_ID>` et `<@&ROLE_ID>`. Pour que la mention de rôle envoie également une notification à ses membres, le rôle doit être mentionnable, ou le bot doit avoir la permission **Mention @everyone, @here, and All Roles** dans ce canal. Cette permission supplémentaire est facultative et peut notifier tout le rôle. Les préférences de notification des utilisateurs restent applicables.

## 6. Récupérer l’ID du serveur

Dans Discord, ouvrir **Paramètres utilisateur → Avancés → Mode développeur** et l’activer. Faire un clic droit sur l’icône du serveur, puis **Copier l’identifiant du serveur**. Cela donne `GUILD_ID`.

## 7. Récupérer l’ID du rôle

Ouvrir **Paramètres du serveur → Rôles**, puis le menu contextuel du rôle surveillé et **Copier l’identifiant du rôle**. Cela donne `ROLE_ID`. Ne pas utiliser son nom, une mention, ni le rôle `@everyone`.

## 8. Récupérer l’ID du canal

Faire un clic droit sur le salon de destination, puis **Copier l’identifiant du salon**. Cela donne `CHANNEL_ID`. Ce salon et le rôle doivent appartenir à `GUILD_ID`.

## 9. Remplir `.env`

Un fichier `.env` vide est fourni localement. Après un clone Git, le créer depuis l’exemple :

PowerShell :

```powershell
Copy-Item .env.example .env
```

macOS/Linux :

```sh
cp .env.example .env
```

Ouvrir `.env` avec un éditeur et compléter les quatre valeurs après les signes `=` :

```dotenv
DISCORD_TOKEN=
GUILD_ID=
ROLE_ID=
CHANNEL_ID=
```

Mettre le token brut, sans préfixe `Bot `, et les IDs numériques sans `<@...>`. Aucun token réel n’est livré dans ce projet. Le fichier est chargé depuis la racine du projet et ignoré par Git, tout comme `node_modules`. Les variables déjà définies dans l’environnement du processus ont priorité sur `.env`. Redémarrer le bot après une modification.

## 10. Installer les dépendances

Dans le terminal, se placer dans le dossier `discord-role-bot`, puis exécuter :

```sh
npm install
```

`package-lock.json` fixe les versions installées. Pour réinstaller exactement l’arbre verrouillé, on peut utiliser `npm ci` à la place.

## 11. Vérifier et démarrer

```sh
npm run check
npm test
npm start
```

La console affiche d’abord `[Connexion] Connecté en tant que ...`, puis `[Prêt] Surveillance du rôle ...`. Attendre **[Prêt]** avant les essais. Aucun message Discord n’est envoyé pendant ce chargement. Pour arrêter le bot : `Ctrl+C`. Garder une seule instance du bot active, sinon chaque instance peut publier sa propre annonce.

## 12. Tester la détection dans Discord

1. Avant de démarrer, attribuer le rôle surveillé à un membre. Démarrer le bot et attendre `[Prêt]` : aucune annonce ne doit apparaître.
2. Attribuer ce rôle à un membre qui ne l’a pas : une seule annonce doit apparaître dans le canal configuré.
3. Ajouter un autre rôle au même membre : aucune nouvelle annonce.
4. Retirer le rôle surveillé : aucune annonce.
5. Ajouter uniquement un autre rôle à un membre qui n’a pas le rôle surveillé : aucune annonce.
6. Réattribuer le rôle surveillé après l’avoir retiré : une nouvelle annonce est attendue, car il s’agit d’un nouvel ajout réel.
7. Redémarrer le bot alors que des membres ont déjà le rôle : aucune annonce rétroactive.

Message publié :

```text
🎉 Félicitations @utilisateur !

Tu viens d'obtenir le rôle @rôle.
```

## Logique et personnalisation

Le gestionnaire `guildMemberUpdate` compare `oldMember.roles.cache.has(ROLE_ID)` et `newMember.roles.cache.has(ROLE_ID)`. Il envoie uniquement lorsque le premier vaut `false` et le second `true`, pour le serveur configuré et une fois l’initialisation terminée. Les changements de profil et les retraits n’envoient rien.

Modifier **`createMessage()` dans `src/bot.js`** pour changer le texte. Conserver les mentions `<@${userId}>` et `<@&${roleId}>` ainsi que `allowedMentions` pour limiter les mentions aux destinataires prévus.

Au démarrage, `guild.members.fetch()` charge le cache de référence avec un délai maximal de deux minutes. Les membres qui rejoignent ensuite sont mis en cache par discord.js via l’intent GuildMembers. Les états partiels sont ignorés : récupérer un membre après l’événement ne permettrait pas de reconstruire son ancien état. Aucun balayage du cache ne produit d’annonce.

L’envoi commence dès la réception d’un ajout confirmé. La latence réseau et les limites de débit Discord peuvent le retarder. Les ajouts pendant l’initialisation, un arrêt ou une coupure non récupérable peuvent être manqués ; aucun historique persistant ni rattrapage n’est prévu. Discord.js gère les reconnexions et les limites de débit. En cas d’échec d’envoi, une erreur est journalisée sans nouvelle tentative applicative aveugle pour éviter une double annonce après une réponse réseau incertaine.

## Dépannage

| Symptôme | Vérification |
| --- | --- |
| Variables manquantes | Remplir les quatre clés dans `.env`. |
| Token invalide / code 4004 | Copier un nouveau token de bot depuis le portail. |
| Intent refusé / code 4014 | Activer Server Members Intent et relancer. |
| Serveur ou rôle introuvable | Vérifier les IDs et l’appartenance du bot au serveur. |
| Canal introuvable / Missing Access | Vérifier CHANNEL_ID, le serveur et les permissions du salon privé. |
| Missing Permissions | Vérifier les permissions effectives du canal, y compris les dérogations. |
| Chargement des membres expiré | Vérifier l’intent, la connexion et l’état de Discord, puis relancer. |
| Mention de rôle visible sans notification | Vérifier si le rôle est mentionnable et les préférences de notification. |
| Annonces en double | Arrêter les autres processus utilisant le même bot. |
| `npm` introuvable | Installer Node.js avec npm puis ouvrir un nouveau terminal. |

## Fichiers et vérification automatisée

```text
discord-role-bot/
├── src/
│   ├── index.js       # Connexion, intents, événements et initialisation
│   ├── bot.js         # Détection, canal, permissions et message personnalisable
│   └── config.js      # Validation et erreurs sans exposition du token
├── test/bot.test.js   # Scénarios de rôles, configuration et erreurs simulées
├── .env              # Valeurs locales uniquement, ignorées par Git
├── .env.example
├── .gitignore
├── package.json
├── package-lock.json
└── README.md
```

Les tests utilisent le gestionnaire réellement enregistré par le bot, avec des membres et un canal simulés. Ils ne contactent pas Discord et n’exigent aucun token. Un essai réel nécessite votre token et votre serveur ; les étapes ci-dessus couvrent ce contrôle final.

Références officielles : [discord.js](https://discord.js.org/docs/packages/discord.js/14.27.0), [Gateway Intents Discord](https://docs.discord.com/developers/events/gateway#gateway-intents), [événements Gateway](https://docs.discord.com/developers/events/gateway-events#guild-member-update).
