-- Incident de salon (22/08) : les 7 634 fiches « Scoring AIGF » — score,
-- rang, retenu/non retenu, vague de financement — étaient nées PUBLIC :
-- upsert_corpus_entries codait 'PUBLIC' en dur. SUTA a restitué des
-- décisions de sélection à un citoyen. Règle désormais dans l'ingestion
-- elle-même : une entrée de scoring naît ADMIN, quoi qu'en dise l'appelant ;
-- les autres respectent un éventuel entry->>'visibility', PUBLIC sinon.
-- Le conflit ne réécrit jamais la visibilité : la curation manuelle prime.
-- (Le même jour, les 7 634 fiches existantes ont été basculées en ADMIN.)

create or replace function public.upsert_corpus_entries(payload jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into knowledge_sources (id, name, type, description)
  values (
    'ansut-observatoire',
    'Observatoire ANSUT — service universel',
    'generated',
    'Corpus généré depuis la base de données de l''observatoire ANSUT : scoring AIGF, couverture opérateurs, population RGPH, synthèses régionales et doctrine métier.'
  )
  on conflict (id) do nothing;

  insert into documents (id, title, filename, "mimeType", "sourceType", "sourceId", visibility, status, "updatedAt")
  select t.entry->>'id', t.entry->>'title', (t.entry->>'id') || '.json',
         'application/json', 'MANUAL', 'ansut-observatoire',
         (case
            when t.entry->>'id' like 'scoring-%'
              or t.entry->>'type' = 'village_score'
              or t.entry->>'title' ~* 'scoring|non retenu|rang national|vague de financement'
            then 'ADMIN'
            else coalesce(t.entry->>'visibility', 'PUBLIC')
          end)::"Visibility",
         'PENDING', now()
  from jsonb_array_elements(payload) as t(entry)
  on conflict (id) do update set title = excluded.title, "updatedAt" = now();

  -- Le vecteur est remis à NULL si le texte a changé : un embedding calculé
  -- sur un contenu obsolète donnerait une recherche fausse.
  insert into document_chunks (id, "documentId", content, section, metadata)
  select (t.entry->>'id') || '-chunk', t.entry->>'id', t.entry->>'content', t.entry->>'region',
         jsonb_build_object(
           'corpusType', t.entry->'type',
           'corpusSource', t.entry->'source',
           'region', t.entry->'region',
           'departement', t.entry->'departement'
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
$$;
