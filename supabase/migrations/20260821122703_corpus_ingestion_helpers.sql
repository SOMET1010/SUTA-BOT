-- Bucket privé recevant le corpus JSONL brut (dépôt par glisser-déposer
-- depuis le Dashboard : le corpus fait 10 Mo, trop volumineux pour être
-- inséré ligne à ligne via l'API SQL).
insert into storage.buckets (id, name, public)
values ('corpus', 'corpus', false)
on conflict (id) do nothing;

-- Upsert idempotent d'un lot d'entrées du corpus (les identifiants du corpus
-- sont stables : une régénération future se réingère sans doublon).
create or replace function upsert_corpus_entries(payload jsonb)
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
         'application/json', 'MANUAL', 'ansut-observatoire', 'PUBLIC', 'PENDING', now()
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
