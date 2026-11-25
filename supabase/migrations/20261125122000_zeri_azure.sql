-- Numëruesi mujor i shkronjave të dërguara te Azure Speech (zëri i intervistës), që kufiri falas i F0 të mos kalohet.
-- E PAAPLIKUAR: aplikohet vetëm me OK-në e Gentit, para ose bashkë me deploy-in e intervista-zeri.
-- Pa këtë migrim intervista-zeri e kapërcen Azure-n (numëruesi s'lexohet) dhe kalon te Gemini.
-- Ruan vetëm muajin dhe numrin: asnjë tekst, asnjë përdorues. Mund të ekzekutohet disa herë.

create table if not exists public.zeri_azure_muaji (
  muaji date primary key,
  shkronja integer not null default 0 check (shkronja >= 0)
);

-- RLS pa asnjë politikë: app-i (anon, authenticated) s'e lexon e s'e shkruan; vetëm çelësi sekret te Edge Function.
alter table public.zeri_azure_muaji enable row level security;
revoke all on table public.zeri_azure_muaji from public, anon, authenticated;

-- Rezervon atomikisht: shton vetëm nëse totali i muajit (UTC) mbetet nën kufi. Kthen true kur u rezervua.
create or replace function public.zeri_azure_rezervo(p_shkronja integer, p_kufiri integer)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_muaji date := date_trunc('month', now() at time zone 'utc')::date;
begin
  if p_shkronja is null or p_kufiri is null or p_shkronja <= 0 or p_shkronja > p_kufiri then
    return false;
  end if;
  insert into public.zeri_azure_muaji as m (muaji, shkronja)
  values (v_muaji, p_shkronja)
  on conflict (muaji) do update
    set shkronja = m.shkronja + excluded.shkronja
    where m.shkronja + excluded.shkronja <= p_kufiri;
  return found;
end;
$$;

revoke all on function public.zeri_azure_rezervo(integer, integer) from public, anon, authenticated;
grant execute on function public.zeri_azure_rezervo(integer, integer) to service_role;
grant select, insert, update on table public.zeri_azure_muaji to service_role;
