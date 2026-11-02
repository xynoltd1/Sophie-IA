# Vérifier la version 0.13.0

Cette version ajoute beaucoup de code qui n'a jamais tourné contre un vrai service. Les
étapes ci-dessous sont dans l'ordre d'exécution, et chacune peut être faite seule.

## 1. Les migrations, dans l'ordre

Dans Supabase → SQL Editor, appliquer dans cet ordre exact :

1. `supabase/migrations/20261102100000_0025_summary_pipeline.sql`
2. `supabase/migrations/20261102110000_0026_appointment_workflow.sql`
3. `supabase/migrations/20261102120000_0027_platform_admin.sql`
4. `supabase/migrations/20261102130000_0028_conversations.sql`

Copier depuis les fichiers, pas depuis une conversation : une guillemet typographique
transformée en route a déjà coûté une heure à ce projet.

### Contrôle

```sql
select
  (select count(*) from information_schema.tables where table_schema = 'public'
     and table_name in ('outbound_messages','notifications','plans','subscriptions',
                        'usage_records','provider_errors','conversations',
                        'conversation_messages')) as tables_creees,
  (select count(*) from information_schema.columns where table_schema = 'public'
     and table_name = 'calls'
     and column_name in ('summary_attempts','summary_error','summary_source',
                         'summary_generated_at')) as colonnes_resume,
  (select count(*) from public.plans) as offres;
```

Attendu : **8**, **4**, et **3**.

## 2. Le premier administrateur de plateforme

L'espace `/admin` est écrit mais inaccessible tant qu'aucun profil ne porte le drapeau.

```sql
update public.profiles
set is_platform_admin = true
where id = (select id from auth.users where email = 'VOTRE_ADRESSE' limit 1);
```

Puis ouvrir `/admin`. Si la redirection renvoie vers `/app`, le drapeau n'est pas posé.

## 3. Le résumé

Sans `AI_API_KEY`, la fiche d'appel affiche un résumé **simulé** qui dit qu'il l'est. C'est
le comportement attendu, pas une panne.

Avec une clé, sur Vercel :

```
AI_PROVIDER=mistral
AI_API_KEY=...
AI_BASE_URL=https://api.mistral.ai/v1
AI_MODEL=mistral-small-latest
```

Puis, sur un appel déjà transcrit, cliquer sur « Réessayer » sous le résumé. Trois phrases
doivent apparaître, suivies du bloc « Ce que Sophie a retenu ».

## 4. Le workflow du rendez-vous

Sur un rendez-vous « À valider » :

- **Accepter** → l'événement doit apparaître dans Google Agenda.
- **Proposer un autre horaire** → le rendez-vous passe en attente ; sans compte SMS, le
  message reste en file et l'écran le dit.
- **Refuser** avec un motif → le motif est enregistré et part dans le message.

Pour tester la page de réponse du client sans SMS, récupérer le jeton :

```sql
select proposal_token from public.appointments
where status = 'CHANGE_PROPOSED' order by updated_at desc limit 1;
```

puis ouvrir `https://zelicall.com/rdv/<jeton>`.

## 5. Les réglages

Ouvrir `/app/reglages` : services, horaires, absences, consommation, intégrations. Modifier
un service, puis vérifier que Sophie le propose au prochain appel.

L'écran **Intégrations** affiche ce qui manque réellement dans la configuration du serveur.
C'est le plus rapide pour savoir où on en est.

## 6. Ce qui ne peut pas être vérifié aujourd'hui

| Fonction | Ce qu'il faut |
|---|---|
| SMS envoyé et reçu | un compte opérateur et un numéro expéditeur |
| Appel sur un vrai numéro | un numéro de téléphone |
| Résumé réel | une clé de fournisseur d'IA |
| Agenda chez un client | la validation de l'application Google |

Aucune de ces quatre lignes ne dépend du code.
