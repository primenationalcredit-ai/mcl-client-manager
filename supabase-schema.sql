-- ═══════════════════════════════════════════════════════════════
-- MCL CLIENT MANAGER — Supabase Schema
-- Run this in: Supabase Dashboard → SQL Editor → New Query → Run
-- ═══════════════════════════════════════════════════════════════

-- 1. CLIENTS
create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text default '',
  phone text default '',
  status text default 'new',
  notes text default '',
  introduced boolean default false,
  address text default '',
  ssn_last4 text default '',
  dob text default '',
  mcl_case text default '',
  mcl_type text default '',
  mcl_status text default '',
  packet_sent_date text,
  mail_date text,
  mcl_contact_date text,
  dispute_letter_sent text,
  reports_requested_date text,
  outcome_date text,
  filed_date text,
  in_service_date text,
  is_new_lead boolean default false,
  seen_by_agent boolean default true,
  comms jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2. TEMPLATES
create table if not exists templates (
  key text primary key,
  name text not null,
  type text default 'text',
  trigger_stage text default 'new',
  subject text default '',
  body text default ''
);

-- 3. ACTIVITY LOG
create table if not exists activity_log (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) on delete cascade,
  detail text default '',
  agent text default '',
  created_at timestamptz default now()
);

-- 4. SETTINGS
create table if not exists settings (
  id text primary key default 'main',
  agent_name text default 'Joe',
  csv_url text default '',
  zapier_url text default '',
  last_sync text
);

-- 5. INDEXES
create index if not exists idx_clients_status on clients(status);
create index if not exists idx_clients_updated on clients(updated_at desc);

-- 6. AUTO updated_at
create or replace function update_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end; $$ language plpgsql;

drop trigger if exists clients_updated on clients;
create trigger clients_updated before update on clients
for each row execute function update_updated_at();

-- 7. ROW LEVEL SECURITY (open for anon key)
alter table clients enable row level security;
alter table templates enable row level security;
alter table activity_log enable row level security;
alter table settings enable row level security;

create policy "open_clients" on clients for all using (true) with check (true);
create policy "open_templates" on templates for all using (true) with check (true);
create policy "open_activity" on activity_log for all using (true) with check (true);
create policy "open_settings" on settings for all using (true) with check (true);

-- 8. DEFAULT SETTINGS
insert into settings (id, agent_name, csv_url) values (
  'main', 'Joe',
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vS-aIG0R1yc8KPTTmXLfUoAOjIv9oVVfGgDc_-M_i009NwwOJEiaoG9yLNkKDBZ4zMTBkYcOHw9qMn-/pub?gid=0&single=true&output=csv'
) on conflict (id) do nothing;

-- 9. DEFAULT TEMPLATES
insert into templates (key, name, type, trigger_stage, subject, body) values
('intro_text_no_answer','Intro Text (No Answer)','text','no_answer','','Hi {name}, this is {agent} from ASAP Credit Repair! We tried reaching you regarding a potential legal matter on your credit report. McCarthy Law may be able to help resolve this at no cost to you. Please call us back or reply to this text!'),
('intro_email_no_answer','Intro Email (No Answer)','email','no_answer','Important: Credit Report Legal Matter – McCarthy Law','Dear {name},

We tried reaching you by phone regarding a potential legal matter found on your credit report.

McCarthy Law specializes in resolving credit reporting errors through litigation at no upfront cost to you.

Please reply to this email or call us.

Best regards,
{agent}
ASAP Credit Repair'),
('intro_text_answered','Intro Text (Answered)','text','contacted','','Hi {name}, great speaking with you! As discussed, McCarthy Law can help resolve the legal matter on your credit report. Please reply to the email from McCarthy Law to get started!'),
('intro_email_answered','Intro Email (Answered)','email','contacted','Next Steps: McCarthy Law Introduction','Dear {name},

Thank you for speaking with us! We identified a legal matter on your credit report that McCarthy Law can help resolve.

You will receive an email from McCarthy Law — please reply to begin. No upfront cost.

Best regards,
{agent}
ASAP Credit Repair'),
('followup_mail','Reminder: Mail Disputes','text','packet_sent','','Hi {name}, this is {agent} from ASAP Credit Repair. Have you had a chance to mail your dispute packet from McCarthy Law? The sooner we get this mailed, the sooner we can resolve your case!'),
('followup_mail_email','Reminder: Mail Disputes (Email)','email','packet_sent','Reminder: Please Mail Your Dispute Packet','Dear {name},

Following up on the dispute packet from McCarthy Law. Have you mailed it out?

This is a critical step — the sooner it goes out, the sooner we can resolve your case.

Best regards,
{agent}
ASAP Credit Repair'),
('followup_31day_text','Day 31: Request Updated Reports','text','first_dispute','','Hi {name}, this is {agent} from ASAP Credit Repair. Its been 30+ days since McCarthy Law sent your first dispute round! We need your updated credit reports. Please pull them from annualcreditreport.com and send them to us ASAP!'),
('followup_31day_email','Day 31: Request Reports (Email)','email','first_dispute','Action Needed: Updated Credit Reports – 30 Day Follow Up','Dear {name},

It has been 30+ days since McCarthy Law sent your first round of disputes. We need your updated credit reports to determine next steps.

Please visit annualcreditreport.com, pull all three bureau reports, and send them to us.

Best regards,
{agent}
ASAP Credit Repair'),
('in_service_ready','In Service: Ready for MCL','text','in_service','','Hi {name}, this is {agent} from ASAP Credit Repair. You are now in your second round of credit repair, and we can move forward with McCarthy Law on the legal matter we discussed. We will be reaching out shortly with next steps!'),
('won_email','Won – Litigation Notice','email','won','Your Case Is Moving Forward – Litigation','Dear {name},

The credit reporting errors persist and your case qualifies for litigation. McCarthy Law will proceed with legal action at no upfront cost.

Congratulations!

Best regards,
{agent}
ASAP Credit Repair'),
('lost_email','Resolved – No Litigation','email','lost','Credit Reporting Error Resolved','Dear {name},

The credit reporting error has been corrected through the dispute process — litigation is not needed. The good news is the error is resolved!

Best regards,
{agent}
ASAP Credit Repair')
on conflict (key) do nothing;
