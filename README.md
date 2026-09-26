# Bot Discord — annonces de grades

Bot JavaScript avec Node.js 22.12 minimum (Node.js 24 LTS recommandé), discord.js 14.27.0 et dotenv 18.0.4.

## Grades surveillés

Les rôles existants sont identifiés par leur nom exact, sans le `@` de la mention, dans cet ordre :

1. Pâte à Brioche
2. Petit Briochon
3. Briochon Confirmé
4. Briochon Actif
5. Briochon Premium
6. Briochon VIP
7. Légende de la Corp

Le bot ne crée ni n’attribue les rôles. Chaque nom doit être unique. Un nom absent ou en double est signalé au démarrage et ce palier est ignoré. Les rôles ajoutés ou renommés sont pris en compte via le cache Discord.

Sur `guildMemberUpdate`, il compare le plus haut grade avant et après : une annonce est envoyée seulement si un nouveau grade supérieur vient d’être ajouté. Le premier grade est aussi annoncé. Une rétrogradation, un retrait, un autre rôle ajouté, une mise à jour de profil ou le démarrage ne produit aucune annonce. Plusieurs grades ajoutés dans une seule mise à jour produisent une seule annonce, pour le plus haut. Après un retrait, une nouvelle attribution qui constitue une progression sera annoncée à nouveau.

## Commandes staff

Les commandes sont enregistrées automatiquement dans le serveur au démarrage. Elles sont réservées aux membres ayant **Gérer le serveur** ou **Administrateur**, avec un contrôle effectué aussi à chaque exécution. Un rôle simplement nommé Staff ne suffit pas. Le bot lui-même n’a pas besoin de Gérer le serveur.

- `/grade-canal canal:#annonces` : choisit un salon textuel ou d’annonces. Le bot vérifie ses permissions avant de sauvegarder.
- `/grade-message texte:🎉 Bravo {membre}, tu passes au grade {grade} !` : personnalise le message.
- `/grade-ajouter role:@NouveauGrade` : ajoute un rôle existant à la fin de la liste, comme **palier le plus élevé**, après les sept grades initiaux et les ajouts précédents. Réservé au même staff. Les doublons, @everyone et rôles gérés par une intégration sont refusés. Cela ne crée pas de rôle et ne l’attribue à personne. Aucune annonce rétroactive n’est envoyée aux membres qui le possèdent déjà.

Les rôles ajoutés sont sauvegardés par ID avec les autres réglages : ils restent surveillés après renommage et redémarrage. Les anciens fichiers de configuration sont automatiquement compatibles. Un rôle supprimé du serveur est ignoré. Sur Railway, utiliser le volume persistant décrit ci-dessous pour conserver aussi cette liste après redéploiement.

`{membre}` est obligatoire et devient une véritable mention de la personne. `{grade}` devient la mention du rôle, sans notifier tous ses membres. Les autres mentions, dont @everyone et @here, ne déclenchent pas de notifications. Les préférences Discord du membre peuvent limiter ses notifications. Écrire `\n` dans le texte pour un retour à la ligne. Le texte final doit tenir dans 2000 caractères. Les confirmations des commandes sont privées (éphémères).

Message par défaut :

```text
🎉 Félicitations {membre} !

Tu viens de passer au grade {grade} !
```

## Configuration Discord étape par étape

1. Ouvrir https://discord.com/developers/applications et choisir **New Application**.
2. Ouvrir **Bot**, créer le bot si nécessaire, puis **Reset Token** pour obtenir son token. Le conserver uniquement dans `.env` ou les variables privées de l’hébergeur.
3. Dans **Bot → Privileged Gateway Intents**, activer **Server Members Intent** et enregistrer. Le code utilise Guilds et GuildMembers. Message Content et Presence ne sont pas nécessaires.
4. Dans **OAuth2 → URL Generator**, choisir **bot** et **applications.commands**. Ouvrir le lien généré, choisir le serveur et autoriser le bot. Utiliser Guild Install si demandé.
5. Donner au bot **View Channels** et **Send Messages**, y compris dans les dérogations du salon cible. Administrateur et Gérer les rôles ne sont pas nécessaires.
6. Dans Discord, activer **Paramètres utilisateur → Avancés → Mode développeur**. Clic droit sur le serveur → **Copier l’identifiant du serveur** : c’est GUILD_ID.
7. Dans **Paramètres du serveur → Rôles**, vérifier les sept noms ci-dessus. Le menu du rôle permet de copier son ID, mais ROLE_ID n’est plus utilisé par le mode multi-grades.
8. Clic droit sur le canal → **Copier l’identifiant du salon** pour CHANNEL_ID, ou choisir le canal directement avec `/grade-canal`.
9. Créer le fichier `.env` depuis `.env.example` et renseigner les valeurs privées.

PowerShell :

```powershell
Copy-Item .env.example .env
notepad .env
```

macOS/Linux :

```sh
cp .env.example .env
```

```dotenv
DISCORD_TOKEN=
GUILD_ID=
ROLE_ID=
CHANNEL_ID=
# Facultatif : dossier de sauvegarde persistant
# DATA_DIR=/data
```

DISCORD_TOKEN et GUILD_ID sont obligatoires. CHANNEL_ID initialise le canal si aucun réglage sauvegardé n’existe ; il peut rester vide jusqu’à `/grade-canal`. ROLE_ID est conservé pour compatibilité du fichier mais n’est plus utilisé pour la détection. Le token doit être brut, sans préfixe `Bot `. Les variables de l’hébergeur ont priorité sur `.env`.

10. Dans le dossier du dépôt `bot-level`, installer les dépendances :

```sh
npm install
```

11. Vérifier puis démarrer :

```sh
npm run check
npm test
npm start
```

Attendre `[Prêt]` puis exécuter les commandes staff. Le bot reste connecté même si aucun canal valide n’est configuré, pour permettre sa correction via `/grade-canal`. Les tentatives d’annonce sans canal valide sont journalisées et ne sont pas rattrapées. Garder une seule instance active pour éviter les doublons. `Ctrl+C` arrête le bot.

12. Tester : donner un premier grade à un membre sans grade, puis un grade supérieur ; vérifier une annonce à chaque fois. Ajouter un rôle sans rapport, retirer un grade ou rétrograder : aucune annonce. Redémarrer avec des membres déjà gradés : aucune annonce. Vérifier qu’un membre sans permission staff ne peut pas modifier la configuration. Changer le canal et le texte puis vérifier une nouvelle progression.

## Sauvegarde et Railway

Le canal et le texte sont enregistrés dans `data/settings-GUILD_ID.json`, ignoré par Git. Les modifications sont sauvegardées avant confirmation et réutilisées au redémarrage. Une configuration sauvegardée a priorité sur CHANNEL_ID. Si le fichier est corrompu, le bot échoue explicitement plutôt que d’effacer les réglages.

**Sur Railway, ajouter un volume persistant monté sur `/data` et définir `DATA_DIR=/data` dans les variables du service.** Sans volume, les réglages peuvent être perdus lors d’un redéploiement ou remplacement du conteneur. Ajouter également DISCORD_TOKEN et GUILD_ID dans les variables privées. La commande de démarrage est `npm start`. Mettre une seule réplique. Aucun token ne doit être publié sur GitHub.

## Limites et dépannage

- Commandes absentes : vérifier le scope applications.commands, l’installation sur le bon serveur, les permissions du membre et les journaux d’enregistrement des commandes ; relancer le bot.
- Aucun grade détecté : vérifier les noms exacts et uniques et Server Members Intent. Le bot charge les membres avant d’annoncer qu’il est prêt.
- Canal refusé : utiliser un salon textuel ou d’annonces du serveur configuré ; vérifier Voir le salon et Envoyer des messages.
- Erreur d’enregistrement : vérifier que DATA_DIR est accessible en écriture.
- Token invalide / code 4004 : remplacer le token dans les variables privées. Code 4014 : activer Server Members Intent.
- Le bot observe seulement les événements reçus après initialisation ; les changements pendant un arrêt ou une coupure non récupérable peuvent être manqués. Il ne conserve pas d’historique des promotions et ne reconstruit pas les états anciens inconnus.
- Discord.js gère les reconnexions et limites de débit. La latence réseau peut retarder l’annonce. Les erreurs d’envoi sont journalisées sans réessai applicatif aveugle.

## Structure

`src/index.js` : connexion et événements ; `src/bot.js` : annonces et permissions du canal ; `src/config.js` : environnement et erreurs ; `src/settings.js` : grades et sauvegarde ; `src/commands.js` : commandes staff ; `test/` : tests simulés sans token. `.env.example`, `.gitignore`, `package.json` et `package-lock.json` complètent le projet.

Les tests vérifient les progressions, exclusions, permissions staff, sauvegardes, mentions et erreurs. La connexion réelle nécessite votre token et votre serveur.

Documentation officielle : https://discord.js.org/docs/packages/discord.js/14.27.0 et https://discordjs.guide/legacy/slash-commands/permissions
