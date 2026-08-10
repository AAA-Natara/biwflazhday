update public.site_content
set value_th = 'แตะเพื่อเปิดการ์ด', updated_at = now()
where key = 'card.hint' and value_th = 'แตะซองเพื่อเปิดการ์ด';
