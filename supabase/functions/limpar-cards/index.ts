// Apaga da nuvem os cards que não foram salvos de novo nos últimos 30 dias
// e os posts da "Minha turma" com mais de 30 dias.
// Roda uma vez por dia (pg_cron). Só apaga o que já venceu, então chamar a mais não faz mal.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

type Supa = ReturnType<typeof createClient>;

// Apaga os arquivos que a função do banco listar (em rodadas de até 1000).
async function removeFiles(supabase: Supa, rpc: string, bucket: string) {
  let files = 0;
  for (let round = 0; round < 20; round++) {
    const { data, error } = await supabase.rpc(rpc);
    if (error) throw error;
    const names = (data || []).map((r: { name: string }) => r.name);
    if (!names.length) break;
    for (let i = 0; i < names.length; i += 100) {
      const { error: e } = await supabase.storage.from(bucket).remove(names.slice(i, i + 100));
      if (e) throw e;
    }
    files += names.length;
    if (names.length < 1000) break;
  }
  return files;
}

Deno.serve(async () => {
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  });
  try {
    const files = await removeFiles(supabase, 'expired_card_files', 'cards');
    const cutoff = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
    const { count, error } = await supabase.from('saved_cards').delete({ count: 'exact' }).lt('updated_at', cutoff);
    if (error) throw error;

    // Minha turma: primeiro os registros vencidos, depois os arquivos que ficaram sem post.
    const { data: groups, error: ge } = await supabase.rpc('clean_groups');
    if (ge) throw ge;
    const groupFiles = await removeFiles(supabase, 'expired_group_files', 'groups');

    return Response.json({ ok: true, files, cards: count ?? 0, groups, groupFiles });
  } catch (err) {
    console.error(err);
    return Response.json({ ok: false, error: String((err as Error).message || err) }, { status: 500 });
  }
});
