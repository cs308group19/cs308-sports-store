-- Pin the search_path of the access token hook (Supabase advisor 0011).
-- Every object the function touches is already schema-qualified.
alter function public.custom_access_token_hook(jsonb) set search_path = '';
