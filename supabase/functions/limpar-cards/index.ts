// Apaga da nuvem os cards que não foram salvos de novo nos últimos 30 dias.
// Roda uma vez por dia (pg_cron). Só apaga o que já venceu, então chamar a mais não faz mal.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

Deno.serve(async () => {
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  });
  let files = 0;
  try {
    for (let round = 0; round < 20; round++) {
      const { data, error } = await supabase.rpc('expired_card_files');
      if (error) throw error;
      const names = (data || []).map((r: { name: string }) => r.name);
      if (!names.length) break;
      for (let i = 0; i < names.length; i += 100) {
        const { error: e } = await supabase.storage.from('cards').remove(names.slice(i, i + 100));
        if (e) throw e;
      }
      files += names.length;
      if (names.length < 1000) break;
    }
    const cutoff = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
    const { count, error } = await supabase.from('saved_cards').delete({ count: 'exact' }).lt('updated_at', cutoff);
    if (error) throw error;
    return Response.json({ ok: true, files, cards: count ?? 0 });
  } catch (err) {
    console.error(err);
    return Response.json({ ok: false, error: String((err as Error).message || err) }, { status: 500 });
  }
});
