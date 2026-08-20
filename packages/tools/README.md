# packages/tools

Outils SUTA appelables par le modèle via function calling (cahier des
charges, sections 17-18).

## `search_knowledge` (implémenté)

Enveloppe `searchDocuments` de `@suta/knowledge`. Entrée validée par zod :

```ts
{ query: string; limit?: number } // 1-10, défaut 5
```

Sortie : `{ results: [{ title, content, source, score }] }`.

### ⚠️ Décision de sécurité : pas de paramètre `visibility`

Le cahier des charges (section 17) esquisse un filtre `filters.visibility`
sur l'outil. **Ce paramètre n'est volontairement pas exposé au modèle** :
le laisser choisir la visibilité reviendrait à permettre à une simple
instruction dans la conversation (ou un contenu de document malveillant,
section 32) d'élargir l'accès à des informations non publiques. Pour le
MVP Salon, la recherche est donc toujours restreinte côté serveur à
`PUBLIC`/`DEMO` (section 19). Une fois l'authentification en place
(section 57), le niveau de visibilité proviendra du contexte serveur de
la session utilisateur, jamais de l'entrée de l'outil.

## Outils non activés (lots suivants)

`get_program`, `get_service`, `get_procedure`, `get_contact`,
`get_project_status`, `find_office`, `get_faq`, `get_event` — prévus par
le cahier des charges (section 18) mais non implémentés. Les outils
d'écriture (`create_request`, `schedule_appointment`, ...) ne doivent pas
être activés dans le MVP Salon.

## Intégration avec le RealtimeProvider

`packages/ai` ne dépend jamais de `packages/tools` (pas de couplage) :
c'est `apps/web/src/app/api/realtime/session/route.ts` qui compose les
deux, en convertissant `SUTA_TOOLS` en `RealtimeToolDescriptor[]`
(`describeTool`, JSON Schema généré par `z.toJSONSchema`) et en les
passant à `provider.createSession({ tools })`.

L'exécution réelle d'un appel d'outil pendant une conversation vocale
(réception d'un événement `function_call` du moteur Realtime, exécution,
retour du résultat) nécessite une session Realtime réelle et sera
implémentée avec le Lot 3, une fois Azure/OpenAI Realtime disponible. En
attendant, l'outil est testable directement :

```bash
curl -X POST http://localhost:3000/api/tools/search-knowledge \
  -H "Content-Type: application/json" \
  -d '{"query": "Comment bénéficier de ce programme ?"}'
```
