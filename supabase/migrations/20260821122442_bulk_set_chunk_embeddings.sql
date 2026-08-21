-- Écriture en masse des vecteurs pgvector : une seule requête par lot,
-- au lieu d'un aller-retour par fragment (8 739 fragments au total).
create or replace function set_chunk_embeddings(payload jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  update document_chunks c
  set embedding = (p->>'embedding')::vector
  from jsonb_array_elements(payload) as p
  where c.id = p->>'id';
  get diagnostics n = row_count;

  update documents d
  set status = 'INDEXED', "indexedAt" = now()
  where d.status <> 'INDEXED'
    and not exists (
      select 1 from document_chunks c
      where c."documentId" = d.id and c.embedding is null
    );

  return n;
end;
$$;
