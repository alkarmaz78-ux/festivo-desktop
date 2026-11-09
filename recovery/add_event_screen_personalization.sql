alter table public.settings
  add column if not exists display_title text not null default 'FESTIVO';

alter table public.settings
  add column if not exists display_theme text not null default 'birthday';

alter table public.settings
  drop constraint if exists settings_display_theme_check;

alter table public.settings
  add constraint settings_display_theme_check
  check (display_theme = any (array[
    'birthday',
    'wedding',
    'corporate',
    'newyear',
    'anniversary'
  ]));
