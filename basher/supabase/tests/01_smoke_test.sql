-- Teste de fumaça das regras principais. Rode após 00_supabase_shim.sql + migration.
\set ON_ERROR_STOP on
set client_min_messages = warning;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'a@x.com', '{"full_name":"Rafa Lima"}'),
  ('00000000-0000-0000-0000-00000000000b', 'b@x.com', '{"name":"Theo"}'),
  ('00000000-0000-0000-0000-00000000000c', 'c@x.com', '{}');

-- helper para "logar" como alguém
create or replace function pg_temp.login(u uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', u::text, false);
  perform set_config('request.jwt.claim.role', 'authenticated', false);
end $$;

-- ===== Usuário A: onboarding =====
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
set role authenticated;
select display_name from public.profiles where id = auth.uid();

-- menor de idade deve falhar
do $$ begin
  update public.profile_private set birthdate = current_date - interval '17 years' where id = auth.uid();
  raise exception 'FALHOU: aceitou menor';
exception when others then
  if sqlerrm <> 'UNDERAGE' then raise; end if;
end $$;

-- não pode se auto-verificar via update direto
do $$ begin
  update public.profile_private set age_verified_at = now() where id = auth.uid();
  raise exception 'FALHOU: autoverificação';
exception when insufficient_privilege then null;
end $$;

-- não pode virar Pro sozinho
do $$ begin
  update public.entitlements set pro_until = now() + interval '1 year' where user_id = auth.uid();
  if exists (select 1 from public.entitlements where user_id = auth.uid() and pro_until is not null) then
    raise exception 'FALHOU: virou pro';
  end if;
exception when insufficient_privilege then null;
end $$;

update public.profile_private set birthdate = '1995-05-10', accepted_terms_at = now(), sensitive_consent_at = now() where id = auth.uid();
update public.profiles set sex_position = 'versatile', bio = 'oi', tribes = '{urso}' where id = auth.uid();

do $$ begin
  perform public.complete_onboarding();
  raise exception 'FALHOU: onboard sem verificação';
exception when others then
  if sqlerrm <> 'AGE_VERIFICATION_REQUIRED' then raise; end if;
end $$;
select public.record_age_signal(18, 'apple_declared_age_range:SELF_DECLARED');
select public.complete_onboarding();
select public.update_my_location(-23.5530, -46.6533);  -- Frei Caneca

-- ===== Usuário B =====
select pg_temp.login('00000000-0000-0000-0000-00000000000b');
update public.profile_private set birthdate = '1990-01-01', accepted_terms_at = now(), sensitive_consent_at = now() where id = auth.uid();
update public.profiles set sex_position = 'top' where id = auth.uid();
select public.record_age_signal(25, 'test');
select public.complete_onboarding();
select public.update_my_location(-23.5531, -46.6534);  -- mesmo quarteirão → mesma célula

-- B vê A perto, com posição encaixada (não exata)
select display_name, age, sex_position, distance_m, approx_lat, approx_lng from public.nearby_profiles();

-- filtro Pro ignorado no grátis
select count(*) as com_filtro_pro_ignorado from public.nearby_profiles(null, null, '{"positions":["bottom"]}');

-- Explorar é Pro
do $$ begin
  perform * from public.nearby_profiles(-22.9, -43.2);
  raise exception 'FALHOU: explorar sem pro';
exception when others then if sqlerrm <> 'PRO_REQUIRED' then raise; end if;
end $$;

-- conversa
select public.get_or_create_direct('00000000-0000-0000-0000-00000000000a') as conv \gset
insert into public.messages (conversation_id, sender_id, body) values (:'conv', auth.uid(), 'E aí, tudo bem?');
-- não pode forjar remetente
do $$ begin
  insert into public.messages (conversation_id, sender_id, body)
  select id, '00000000-0000-0000-0000-00000000000a', 'fake' from public.conversations limit 1;
  raise exception 'FALHOU: forjou remetente';
exception when insufficient_privilege then null;
end $$;

-- B pede álbum de A (ainda não existe álbum) → não permitido
do $$ begin
  perform public.request_album('00000000-0000-0000-0000-00000000000a');
  raise exception 'FALHOU: pediu álbum inexistente';
exception when others then if sqlerrm <> 'ALBUM_REQUEST_NOT_ALLOWED' then raise; end if;
end $$;

-- ===== A cria álbum e B pede =====
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
insert into public.albums (owner_id, title) values (auth.uid(), 'Noite') returning id as album \gset
insert into public.album_items (album_id, owner_id, path) values (:'album', auth.uid(), auth.uid() || '/' || :'album' || '/1.jpg');
select * from public.my_conversations();
select public.get_profile('00000000-0000-0000-0000-00000000000b')->>'display_name' as visto;

select pg_temp.login('00000000-0000-0000-0000-00000000000b');
select public.get_profile('00000000-0000-0000-0000-00000000000a')->>'can_request_album' as pode_pedir;
select public.request_album('00000000-0000-0000-0000-00000000000a') is not null as pediu;
-- B ainda não vê itens
select count(*) as itens_antes from public.album_items;

-- ===== A aceita compartilhando (cota) =====
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select public.my_album_requests();
select public.share_album(:'album', '00000000-0000-0000-0000-00000000000b', 24) is not null as compartilhou;
select public.my_status();

select pg_temp.login('00000000-0000-0000-0000-00000000000b');
select count(*) as itens_depois from public.album_items;
insert into storage.objects (bucket_id, name) values ('albums', '00000000-0000-0000-0000-00000000000b/x/y.jpg');
reset role;
insert into storage.objects (bucket_id, name) values ('albums', '00000000-0000-0000-0000-00000000000a/' || :'album' || '/1.jpg');
set role authenticated;
select count(*) as objetos_visiveis_b from storage.objects where bucket_id = 'albums';

-- B não pode subir no álbum de A
do $$ begin
  insert into storage.objects (bucket_id, name) values ('albums', '00000000-0000-0000-0000-00000000000a/zzz/hack.jpg');
  raise exception 'FALHOU: upload na pasta alheia';
exception when insufficient_privilege then null;
end $$;

-- ===== Cota de 20/mês =====
reset role;
-- cria usuários extras para A mandar álbuns
insert into auth.users (id) select gen_random_uuid() from generate_series(1, 21);
update public.profiles set onboarded = true where display_name = '' and id not in ('00000000-0000-0000-0000-00000000000c');
set role authenticated;
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
do $$
declare u uuid; n int := 0;
begin
  for u in select id from public.profiles where id not in ('00000000-0000-0000-0000-00000000000a','00000000-0000-0000-0000-00000000000b','00000000-0000-0000-0000-00000000000c') loop
    begin
      perform public.share_album((select id from public.albums where owner_id = auth.uid() limit 1), u);
      n := n + 1;
    exception when others then
      if sqlerrm <> 'ALBUM_QUOTA_EXCEEDED' then raise; end if;
      raise notice 'cota atingida após % envios extras (1 já usado com B)', n;
      if n <> 19 then raise exception 'FALHOU: cota errada %', n; end if;
      return;
    end;
  end loop;
  raise exception 'FALHOU: cota não aplicada';
end $$;

-- servidor concede pacote +10 → volta a enviar
reset role;
update public.entitlements set album_credits = album_credits + 10 where user_id = '00000000-0000-0000-0000-00000000000a';
set role authenticated;
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select public.share_album((select id from public.albums where owner_id = auth.uid() limit 1),
                          (select id from public.profiles where id not in (select recipient_id from public.album_shares) and id <> auth.uid() and onboarded limit 1)) is not null as enviou_com_credito;
select (public.my_status()->>'album_credits')::int as creditos_restantes;

-- ===== Grupo pago =====
do $$ begin
  perform public.create_group('Rolê Augusta', array['00000000-0000-0000-0000-00000000000b']::uuid[]);
  raise exception 'FALHOU: grupo sem crédito';
exception when others then if sqlerrm <> 'GROUP_CREDIT_REQUIRED' then raise; end if;
end $$;
reset role;
update public.entitlements set group_credits = 1 where user_id = '00000000-0000-0000-0000-00000000000a';
set role authenticated;
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select public.create_group('Rolê Augusta', array['00000000-0000-0000-0000-00000000000b']::uuid[]) is not null as grupo_criado;
select title, member_count, is_group from public.my_conversations() where is_group;

-- Pro cria grupo grátis
reset role;
update public.entitlements set pro_until = now() + interval '30 days' where user_id = '00000000-0000-0000-0000-00000000000a';
set role authenticated;
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select public.create_group('Pro group') is not null as grupo_pro;
update public.profile_private set incognito = true where id = auth.uid();
select count(*) as explorar_rio from public.nearby_profiles(-22.9, -43.2);

-- ===== Agora / feed / stories =====
insert into public.posts (author_id, kind, body) values (auth.uid(), 'now', 'No bar da Frei Caneca, quem cola?');
insert into public.posts (author_id, kind, body) values (auth.uid(), 'now', 'Mudei: agora na Augusta');
select count(*) as agora_ativos_de_a from public.posts where author_id = auth.uid() and kind = 'now';
insert into public.stories (author_id, media_url) values (auth.uid(), 'https://x/y.jpg');

select pg_temp.login('00000000-0000-0000-0000-00000000000b');
select body, author_name, distance_m from public.nearby_posts('now');
select public.stories_tray();
select public.send_tap('00000000-0000-0000-0000-00000000000a', 'fire');
select public.my_viewers()->>'locked' as viewers_locked;

-- ===== Bloqueio esconde tudo =====
select public.report_user('00000000-0000-0000-0000-00000000000a', 'spam', 'teste', true);
select count(*) as a_visivel_para_b from public.profiles where id = '00000000-0000-0000-0000-00000000000a';
select count(*) as a_no_perto from public.nearby_profiles() where id = '00000000-0000-0000-0000-00000000000a';
select public.get_profile('00000000-0000-0000-0000-00000000000a') is null as perfil_oculto;
select count(*) as itens_album_apos_bloqueio from public.album_items;

reset role;
select 'TODOS OS TESTES PASSARAM' as resultado;

-- ===== grant_entitlement: só service_role =====
set role authenticated;
select pg_temp.login('00000000-0000-0000-0000-00000000000b');
do $$ begin
  perform public.grant_entitlement('00000000-0000-0000-0000-00000000000b', 'pro', 1, now() + interval '30 days');
  raise exception 'FALHOU: usuário se deu Pro';
exception when insufficient_privilege then null;
end $$;
select public.my_blocked() is not null as lista_bloqueados_ok;
reset role;
set role service_role;
select (public.grant_entitlement('00000000-0000-0000-0000-00000000000b', 'album_pack', 1)->>'album_credits')::int as creditos_b;
select (public.grant_entitlement('00000000-0000-0000-0000-00000000000b', 'group', 2)->>'group_credits')::int as grupos_b;
select (public.grant_entitlement('00000000-0000-0000-0000-00000000000b', 'pro', 1, now() + interval '30 days', 'br.com.basher.app.pro.monthly', '1000')->>'pro_until') is not null as pro_b;
select (public.grant_entitlement('00000000-0000-0000-0000-00000000000b', 'album_pack', -5)->>'album_credits')::int as creditos_apos_reembolso;
reset role;
select 'GRANTS OK' as resultado;
