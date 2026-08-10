-- biwflazhday.online — migration 03
-- Every string on the personal card becomes editable from the admin panel.
-- Safe to run twice.

insert into public.site_content (key, value_th, field_type, section, sort_order) values
  ('card.hint',         'แตะซองเพื่อเปิดการ์ด',              'text',     'card', 10),
  ('card.to',           'เรียน',                           'text',     'card', 20),
  ('card.save',         'บันทึกการ์ด',                      'text',     'card', 30),
  ('card.home',         'รายละเอียดงาน',                    'text',     'card', 40),
  ('card.rsvp_heading', 'ตอบรับคำเชิญ',                     'text',     'card', 50),
  ('card.deadline',     'กรุณาตอบรับภายในวันที่ 7 พฤศจิกายน 2569', 'text', 'card', 60),
  ('card.question',     'จะมาร่วมงานหรือไม่',                 'text',     'card', 70),
  ('card.yes',          'มาร่วมงาน',                        'text',     'card', 80),
  ('card.no',           'ไม่สะดวก',                         'text',     'card', 90),
  ('card.note_label',   'ข้อความถึงบ่าวสาว',                  'text',     'card', 100),
  ('card.submit',       'ส่งคำตอบ',                         'text',     'card', 110)
on conflict (key) do nothing;
