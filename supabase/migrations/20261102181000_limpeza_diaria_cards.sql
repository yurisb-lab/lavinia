create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

-- Todo dia às 03:17 (Brasília) apaga os cards que venceram (30 dias sem salvar de novo).
-- A função limpar-cards fica em supabase/functions/limpar-cards (sem verificação de JWT:
-- ela só apaga o que já venceu).
select cron.schedule(
  'limpar-cards',
  '17 6 * * *',
  $$ select net.http_post(
       url := 'https://ktbkvewvufcwouvefhzs.supabase.co/functions/v1/limpar-cards',
       headers := '{"Content-Type": "application/json"}'::jsonb,
       body := '{}'::jsonb,
       timeout_milliseconds := 60000
     ); $$
);
