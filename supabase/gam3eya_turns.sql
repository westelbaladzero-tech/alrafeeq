-- ============================================================
-- نظام تتبع أدوار الجمعية — الرفيق الأمين
-- ينفّذ: 10 سبتمبر 2026
-- المبدأ: كل دور مرتبط بتسوية مؤكدة، ومنع تكرار الدور على مستوى قاعدة البيانات
-- ============================================================

-- 1) جدول أدوار الجمعية
create table if not exists public.gam3eya_turns (
  id uuid primary key default gen_random_uuid(),
  friendship_id uuid not null references public.friendships(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  settlement_id uuid references public.settlements(id) on delete set null,
  taken_at timestamptz not null default now(),
  -- منع تكرار الدور: نفس الشخص ما ياخذ دورين في نفس الجمعية
  unique(friendship_id, user_id)
);

-- فهارس
create index if not exists gam3eya_turns_friendship_idx
  on public.gam3eya_turns(friendship_id);
create index if not exists gam3eya_turns_user_idx
  on public.gam3eya_turns(user_id);

-- RLS: المستخدم يرى أدواره في جمعياته فقط
alter table public.gam3eya_turns enable row level security;

create policy "قراءة أدوار جمعيتي" on public.gam3eya_turns
  for select to authenticated using (
    friendship_id in (
      select id from public.friendships
      where user_a = auth.uid() or user_b = auth.uid()
    )
  );

-- 2) دالة ذرّية لتسجيل الدور وتحديث العداد
-- تُستدعى فقط من داخل route تأكيد التسوية (service_role)
create or replace function public.record_gam3eya_turn(
  p_friendship_id uuid,
  p_user_id uuid,
  p_settlement_id uuid
) returns boolean as $$
begin
  -- إدراج الدور — يفشل تلقائياً لو نفس المستخدم أخذ دوره (UNIQUE constraint)
  insert into public.gam3eya_turns (friendship_id, user_id, settlement_id)
  values (p_friendship_id, p_user_id, p_settlement_id);

  -- تحديث عداد الجمعية المشتق من جدول الأدوار
  update public.friendships
  set gam3eya_completed = (
    select count(*) from public.gam3eya_turns
    where friendship_id = p_friendship_id
  )
  where id = p_friendship_id;

  return true;
exception
  when unique_violation then
    -- الشخص أخذ دوره أصلاً — لا تكرار
    return false;
end;
$$ language plpgsql security definer;

-- 3) قفل صلاحيات الـ RPC: فقط service_role
revoke execute on function public.record_gam3eya_turn
  from anon, authenticated;

-- 4) عمود صريح لنوع التسوية (بدل الاعتماد على نص حر بالوصف)
alter table public.settlements
  add column if not exists category text default 'debt'
  check (category in ('debt', 'installment', 'gam3eya'));

-- 5) تريغر: سجّل دور الجمعية تلقائياً عند تأكيد التسوية
-- يشتغل AFTER UPDATE لما status ينتقل لـ "confirmed"
-- يفحص category = 'gam3eya' (عمود صريح، مو نص حر)
create or replace function public.handle_gam3eya_turn_on_settlement()
returns trigger as $$
declare
  v_relationship_type text;
  v_gam3eya_total int;
begin
  -- فقط عند الانتقال إلى "confirmed"
  if NEW.status = 'confirmed' and (OLD.status is distinct from 'confirmed') then
    -- اجلب بيانات الصداقة
    select relationship_type, gam3eya_total
    into v_relationship_type, v_gam3eya_total
    from public.friendships
    where id = NEW.friendship_id;

    -- هل هي جمعية فعّالة؟ (relationship_type = association AND فيه عدد أدوار)
    if v_relationship_type = 'association' and v_gam3eya_total is not null then
      -- هل التسوية مرتبطة بجمعية؟ (فحص بنيوي — عمود صريح)
      if NEW.category = 'gam3eya' then
        -- سجّل الدور — to_user هو اللي استلم (أخذ دوره)
        -- الـ RPC نفسه يمنع التكرار (UNIQUE constraint)
        perform public.record_gam3eya_turn(
          NEW.friendship_id,
          NEW.to_user,
          NEW.id
        );
      end if;
    end if;
  end if;

  return NEW;
end;
$$ language plpgsql security definer;

-- ربط التريغر بجدول التسويات
drop trigger if exists gam3eya_turn_trigger on public.settlements;
create trigger gam3eya_turn_trigger
  after update on public.settlements
  for each row execute function public.handle_gam3eya_turn_on_settlement();
