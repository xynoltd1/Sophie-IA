# Règles métier

Les règles sont contrôlées par l'application. **Le modèle de langage ne les invente
jamais** et ne les évalue jamais : il peut seulement appeler un outil qui les applique.

## Moteur de règles

Forme retenue : `DÉCLENCHEUR + CONDITIONS + ACTIONS`.

| Déclencheur | Condition | Action |
|---|---|---|
| Urgence détectée | toujours | notifier le propriétaire immédiatement |
| Demande hors zone d'intervention | adresse hors périmètre | ne pas proposer de rendez-vous, prendre un message |
| Période de congés | date demandée avant le retour | ne proposer aucune date avant le retour |
| Information absente | tarif ou service inconnu | Sophie transmet la demande, elle n'invente pas |

## Rôles et permissions

Trois rôles en V1 : `OWNER`, `ADMIN`, `MEMBER`. L'architecture accepte l'ajout de
`RECEPTIONIST` sans changement de structure.

Référence applicative : `src/lib/auth/permissions.ts`. Référence réelle : les policies RLS.
En cas de divergence, **la base a raison** et le code applicatif doit être corrigé.

Une organisation conserve toujours au moins un `OWNER` actif : garanti par un trigger, pas
par l'interface.

## Vérités métier

Ces informations ne proviennent **que** des données, via des outils serveur :
disponibilité, tarif, service, zone d'intervention, identité du contact, rendez-vous.

Si l'information n'existe pas, la réponse correcte est : « je transmets votre demande au
professionnel ». Jamais une estimation.

## Cycle de vie d'un rendez-vous (Phase 3)

```
AVAILABLE → HELD → PENDING_APPROVAL → CONFIRMED
                 └────────────────→ REJECTED
CONFIRMED → CHANGE_PROPOSED → CONFIRMED
CONFIRMED → CANCELLED | COMPLETED | NO_SHOW
```

Un `hold` a une expiration. La prévention de la double réservation est assurée **en base**
(transaction, contrainte, verrou). Deux appels simultanés ne peuvent pas confirmer le même
créneau. **L'IA n'est jamais le verrou.**

Par défaut, Sophie ne fait que proposer : le rendez-vous naît en `PENDING_APPROVAL` et
attend la validation du professionnel.

## Pipeline commercial (Phase 2)

`Contact` (personne connue) et `Lead` (opportunité) sont deux choses distinctes. Un
contact peut avoir plusieurs leads dans le temps. Déduplication par téléphone normalisé.

| État interne | Libellé affiché |
|---|---|
| `NEW` | Nouveau |
| `QUALIFIED` | À traiter |
| `APPOINTMENT` | RDV / Devis |
| `CUSTOMER` | Client |
| `WON` | Terminé |
| `LOST` | Perdu |

## Modes dégradés

Une panne partielle ne détruit jamais le reste du parcours.

| Panne | Comportement |
|---|---|
| Agenda indisponible | Sophie ne propose aucun créneau ; elle recueille les souhaits du client et annonce une confirmation par le professionnel |
| Résumé indisponible | l'audio et la transcription restent affichés, avec « Résumé indisponible — Réessayer » |
| SMS indisponible | le rendez-vous est conservé ; « SMS non envoyé — Réessayer ». On n'annule jamais un rendez-vous parce qu'un SMS a échoué |
| Voice indisponible | repli téléphonique : transfert ou messagerie, jamais un silence |
| Google Calendar échoue à la confirmation | on n'affiche pas « confirmé » ; l'état reste explicite et l'erreur est visible |

## Enregistrement et rétention audio

| Règle | Valeur |
|---|---|
| Enregistrement activé | non par défaut ; choix explicite de l'entreprise |
| Activation possible | seulement après acceptation de la charte |
| Rétention de l'audio original | 30 jours maximum, plafond appliqué **en base** |
| Annonce à l'appelant | requise par défaut, texte personnalisable |
| Transcription et résumé | **non concernés** par la purge de l'audio |
| Preuve de suppression | `audio_retention_events`, consultable par l'entreprise |

La purge de l'audio ne supprime jamais la transcription, le résumé, le contact, le lead ni
le rendez-vous. Un appel dont l'audio a expiré reste un appel complet dans l'historique —
seul le lecteur disparaît, avec un message explicite indiquant que l'enregistrement a été
supprimé conformément à la durée de conservation, et non qu'il a été perdu.

Si l'enregistrement est désactivé pour une organisation, Sophie fonctionne normalement :
la transcription temps réel, le résumé et l'extraction ne dépendent pas de la conservation
du fichier audio.
