# Mesure de la fréquentation

**Version 0.17.0** · Écrit le 2026-11-04

---

## Le choix de départ

Mesurer la fréquentation d'un site demande normalement un outil tiers — et un outil tiers
pose un cookie, donc une bannière de consentement, donc une obligation de plus avant de
vendre, et une mesure faussée par les refus.

La mesure est donc **maison, côté serveur, sans cookie et sans traceur**.

## Ce qui est stocké

Table `site_events` (migration 0033).

| Colonne | Contenu |
|---|---|
| `occurred_at` | horodatage |
| `event_name` | `PAGE_VIEW`, `CTA_CLICK`, `SIGNUP_STARTED`, `SIGNUP_DONE` |
| `path` | le chemin, sans la requête |
| `referrer_host` | **le domaine seul** du site d'où vient la visite |
| `utm_*` | source, support, campagne |
| `session_hash` | empreinte, voir plus bas |
| `classification` | `HUMAN`, `BOT` ou `UNKNOWN` |
| `reason` | pourquoi cette classification |
| `environment` | seule la production est comptée |

## Ce qui n'est pas stocké

**Ni adresse IP, ni agent utilisateur.** Les deux servent à classer et à regrouper, puis
disparaissent : ils entrent dans un hachage et n'en ressortent pas. Un test vérifie que
l'insertion ne contient ni l'un ni l'autre.

**Pas l'adresse de provenance complète.** Une adresse de provenance peut contenir une
requête de recherche, un identifiant de campagne nominatif, parfois un jeton. Seul le
domaine est conservé.

## L'empreinte de session

`sha256(date du jour + graine secrète + IP + agent utilisateur + langue)`, tronqué.

Elle regroupe les pages vues d'une même visite, et rien de plus. **Elle change chaque
jour** : le même navigateur produit demain une empreinte totalement différente.

**Ce que cela coûte** : le visiteur unique sur plusieurs jours n'existe pas. Quelqu'un qui
revient trois jours de suite compte comme trois visites. C'est une sous-estimation de la
fidélité et une surestimation de l'audience nouvelle. L'écran l'écrit.

**Ce que cela évite** : un identifiant persistant, donc un traceur, donc le consentement.

## Les trois classifications

`HUMAN`, `BOT`, `UNKNOWN`. **Trois, et non deux**, parce qu'aucune détection de robots
n'est sûre : un robot bien écrit envoie exactement les mêmes requêtes qu'un navigateur.
`UNKNOWN` porte l'incertitude au lieu de la cacher dans l'une des deux certitudes.

Les couches, dans l'ordre :

1. **Agents déclarés** — une centaine de fragments : moteurs, réseaux sociaux, outils de
   référencement, robots d'IA, services de surveillance. Ceux-là s'annoncent.
2. **Outils d'automatisation** — curl, requests, Playwright, Puppeteer, Selenium.
3. **`navigator.webdriver`** — un vrai navigateur dit `false`.
4. **Agent absent ou inhabituel** → `UNKNOWN`, jamais `BOT` : certains navigateurs très
   restrictifs retirent l'agent.
5. **Page jamais affichée, écran de largeur nulle** → `UNKNOWN`.
6. **Chemin privé** → l'événement est refusé à la source. `/app` et `/admin` ne sont pas
   le site public ; les compter ensemble rendrait les deux chiffres faux.
7. **Hors production** → enregistré avec son environnement, et exclu de toutes les
   lectures.
8. **Déduplication** → une contrainte d'unicité en base sur session + événement + chemin +
   minute. En base et non dans le code, parce que deux requêtes simultanées passeraient
   une vérification applicative.

## Ce que la méthode ne peut pas faire

- **Elle ne garantit rien.** Un robot sérieux passe pour un humain, et c'est inévitable.
- **Elle sous-estime.** Les bloqueurs de publicité refusent la requête de mesure. Les
  chiffres sont un plancher.
- **Elle ne suit personne.** Pas de parcours sur plusieurs jours, pas d'entonnoir de
  conversion dans le temps.

**Aucun robot n'est bloqué.** Les exclure du comptage est une décision de mesure, pas de
sécurité. Googlebot doit parcourir le site — c'est l'objet même du référencement.

## Où cela se lit

`/admin/seo` : visites humaines, trafic incertain, robots identifiés, sources, pages,
courbe quotidienne, et le pourcentage d'événements écartés.

## Consentement

En l'état — pas de cookie, pas de stockage navigateur, pas d'identifiant persistant, pas
de transfert à un tiers — cette mesure relève de la statistique strictement nécessaire,
pour laquelle les autorités françaises et belges admettent une exemption de consentement.

**Ce raisonnement n'a pas été validé par un juriste.** Il figure au point L5 de
`docs/LEGAL_COMPLIANCE.md`. Ajouter un outil tiers, un cookie ou un identifiant persistant
le rendrait caduc immédiatement.
