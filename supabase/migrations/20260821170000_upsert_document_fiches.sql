-- Chargement de fiches rédigées à partir d'un document source.
--
-- `upsert_corpus_entries` sert l'observatoire : une source unique, tout en
-- visibilité publique. Les documents transmis par les directions — decks de
-- stratégie, séances de conseil d'administration, projections financières —
-- ne se rangent pas ainsi. Deux différences de fond :
--
--   1. **Chaque document est sa propre source.** Savoir qu'une réponse vient
--      de la séance du 30 juillet et non du plan stratégique change ce qu'on
--      en fait, et permet de retirer un document sans toucher aux autres.
--
--   2. **La visibilité se décide fiche par fiche, pas document par
--      document.** Une même présentation porte la mission de l'agence, qui se
--      dit à tout le monde, et un arbitrage budgétaire non tranché, qui ne se
--      dit pas. Trancher au niveau du document obligerait à choisir entre
--      taire ce qui est communicable et publier ce qui ne l'est pas.
--
-- Comme partout ailleurs, le vecteur est remis à NULL quand le texte change :
-- un embedding calculé sur un contenu obsolète donnerait une recherche fausse.
-- Rejouer ce chargement sur des fiches inchangées ne coûte donc aucun appel
-- d'embedding.

create or replace function upsert_document_fiches(
  source_id text,
  source_name text,
  source_description text,
  payload jsonb
) returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  insert into knowledge_sources (id, name, type, description)
  values (source_id, source_name, 'manual', source_description)
  on conflict (id) do update set name = excluded.name, description = excluded.description;

  insert into documents (id, title, filename, "mimeType", "sourceType", "sourceId",
                         visibility, status, "updatedAt")
  select t.entry->>'id',
         t.entry->>'title',
         (t.entry->>'id') || '.md',
         'text/markdown',
         'MANUAL',
         source_id,
         coalesce(t.entry->>'visibility', 'PUBLIC')::"Visibility",
         'PENDING',
         now()
  from jsonb_array_elements(payload) as t(entry)
  on conflict (id) do update set
    title = excluded.title,
    -- La visibilité est réévaluée à chaque chargement : c'est le seul moyen
    -- de reclasser en ADMIN une fiche qu'on avait d'abord crue publique.
    visibility = excluded.visibility,
    "sourceId" = excluded."sourceId",
    "updatedAt" = now();

  insert into document_chunks (id, "documentId", content, section, metadata)
  select (t.entry->>'id') || '-chunk',
         t.entry->>'id',
         t.entry->>'content',
         nullif(upper(trim(coalesce(t.entry->>'region', ''))), ''),
         jsonb_build_object(
           'corpusSource', source_id,
           'corpusType', 'fiche_document',
           'region', t.entry->'region'
         ) || coalesce(t.entry->'metadata', '{}'::jsonb)
  from jsonb_array_elements(payload) as t(entry)
  on conflict (id) do update set
    content = excluded.content,
    section = excluded.section,
    metadata = excluded.metadata,
    embedding = case
      when document_chunks.content is distinct from excluded.content then null
      else document_chunks.embedding
    end;

  return jsonb_array_length(payload);
end;
$function$;
