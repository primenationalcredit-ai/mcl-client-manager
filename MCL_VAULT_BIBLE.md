# MCL CLIENT MANAGER — VAULT BIBLE
## Last Updated: March 5, 2026

---

## WHAT THIS IS
The MCL Client Manager is a web app that tracks ASAP Credit Repair clients who have FCRA violations on their credit reports. These clients are referred to McCarthy Law, a law firm that sues creditors for reporting errors. Clients can earn $1,000-$2,500 in compensation.

**App URL:** stupendous-melomakarona-97abc8.netlify.app
**Repo:** https://github.com/primenationalcredit-ai/mcl-client-manager.git
**Stack:** Single index.html file, Supabase backend, Netlify hosting
**Owner:** Joe Mahlow, CEO of ASAP Credit Repair USA

---

## TECH STACK & CONNECTIONS

### Supabase
- **URL:** https://ffhjkrpflhyrhekzczal.supabase.co
- **Table:** `mcl_clients` (main data)
- **View:** `mcl_client_status` (computed fields: follow_up_status, days_since_contact, last_followup, etc.)
- **Table:** `templates` (email/SMS templates by key)
- **Table:** `mcl_activity_log` (all actions logged)

### Key Columns on mcl_clients
- id, name, email, phone, pipedrive_id, assigned_to, stage, intro_type
- intro_sent_at, fu1_sent_at, fu2_sent_at, fu3_sent_at, fu4_sent_at
- responded, responded_at, outcome, outcome_at
- notes, credit_error, error_details, comm_log (JSONB array)
- disputes_mailed_to_client, disputes_mailed_to_cra, round_over_date
- pause_reason, next_followup_date, date_mailed, day31_start

### APIs & Webhooks
- **SendGrid Email:** https://stupendous-melomakarona-97abc8.netlify.app/.netlify/functions/send-email (POST, JSON: {to, subject, body})
- **Zapier SMS:** https://hooks.zapier.com/hooks/catch/172130/u0vmgde/ (POST, form-urlencoded: SMS, Texting Cell, Person First Name)
- **Zapier Sheet Update:** https://hooks.zapier.com/hooks/catch/172130/u0vj0pw/ (POST, form-urlencoded: Name, Client Email, Phone Number, Action, + Contacted/New Name/Field as needed)
- **Google Sheet CSV (read-only sync):** https://docs.google.com/spreadsheets/d/e/2PACX-1vSs9OyAhWuv2BcenmZbtIEwD0R6UPZFpK0DYk0TfHkFZwO3ITY0mvMraxJ5X5BseiDaPtlbLpH1UKH-/pub?gid=1509920646&single=true&output=csv
- **Pipedrive API Token:** 328f4866f7d86c2bfbee1ed8b5c1895a1f6444d0
- **Pipedrive Base:** https://api.pipedrive.com/v1

### PapaParse CDN
- `https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.4.1/papaparse.min.js` (for CSV parsing)

---

## 10-STAGE PIPELINE

| Stage | Key | Description |
|-------|-----|-------------|
| Need to Call | need_to_call | New client, violation found, needs first call |
| Do Not Call | do_not_call | Temporary hold — requires reason + follow-up date |
| LVM | lvm | Left voicemail, following up with emails/texts |
| Contacted | contacted | Spoke with client, they know about violation |
| Waiting on MCL | waiting_mcl | Client said Yes, McCarthy Law reviewing |
| Packet Sent | packet_sent | McCarthy sent dispute packet to client |
| Disputes Mailed | disputes_mailed | Client mailed disputes to credit bureaus |
| Waiting on Reports | waiting_reports | Due date passed, need updated credit reports |
| Litigation | litigation | McCarthy Law suing creditor (outcome='litigation') |
| Won | won | Case resolved successfully (outcome='won') |
| Lost | lost | Client dropped off or not eligible (outcome='lost') |

---

## KEY FEATURES BUILT

### Sync Button (↻ Sync)
- Pulls from Google Sheet CSV every click
- Auto-syncs every 5 minutes, DB refresh every 60 seconds
- Stage logic from sheet columns: Not Eligible→Lost, Client Confirmed Mailed→Disputes Mailed, Dispute Mailed to Client→Packet Sent, MCL Initial Contact→Waiting MCL, Intro Made→Contacted, else→Need to Call
- Due Date passed → auto-moves to Waiting on Reports
- NEVER moves Lost/deleted clients back
- NEVER regresses stages
- Skips clients with any outcome set
- Checks mcl_activity_log for 'deleted' action before inserting new clients
- Morning sync popup on first session load (uses sessionStorage)

### Call Outcome Buttons (Need to Call stage)
- Green bar: "Called this client?" → Spoke to Client / Left Voicemail / No answer
- Spoke → moves to contacted, fires sheet webhook with Contacted=TRUE
- LVM → moves to lvm, fires sheet webhook with Contacted=TRUE
- No answer → stays in need_to_call, logs attempt
- Requires email (@) and phone (10-11 digits) before moving (except no_answer)

### MCL Responded Button (LVM & Contacted stages)
- Blue bar: "Did client respond to McCarthy Law email?"
- Yes → fires sheet webhook (Name, Client Email, Phone Number, Action=mcl_responded), moves to waiting_mcl, logs to comm_log

### Email McCarthy Law
- Click "Email McCarthy Law" → buttons swap to "Send to McCarthy Law" / "Cancel"
- Body is BLANK — user types message, app wraps with: "Hello McCarthy Law Team, Re: [name], Email: [email], Phone: [phone], [user message]"
- SendGrid template adds signature: "Thanks, FCRA Violation Team, ASAP Credit Repair, accounts@asapcreditrepairusa.com"
- NO copy to accounts@ — only goes to FCRA@McCarthyLawyer.com
- Logged to comm_log with full message content

### Manual Messages
- Send Email, Send Text, Send Both buttons
- Comm log records full message content (truncated at 200 chars)
- Fields clear after send, profile stays open (no page reload)

### SMS via Zapier
- Form-urlencoded: SMS (body), Texting Cell (phone), Person First Name (first name)
- Webhook: https://hooks.zapier.com/hooks/catch/172130/u0vmgde/

### Follow-up Timeline
- Shows Intro, FU#1-4 with sent dates
- Resend button on each sent message (resends email + SMS, logs to comm_log)
- Next action bar with Send Email / Send Text buttons
- Auto-lose after 5 follow-ups with no response

### Pipedrive Label Sync
- Labels: "McCarthy - [Stage Name]" for each stage
- On stage move: reads existing deal labels, keeps non-McCarthy labels, replaces only McCarthy label
- Auto-creates labels in Pipedrive if they don't exist
- Labels loaded on app init via loadPipedriveLabels()

### Field Validation
- Email: must contain @
- Phone: must be 10-11 digits
- Deal ID: must be exactly 6 digits
- Validation on profile field edits AND move-stage popups
- Move-stage popups loop until valid input or cancel

### Custom Modal Popups
- All prompt() and confirm() replaced with custom modal (customPrompt, customConfirm)
- Modal stays on screen — won't dismiss on click-off
- OK, Cancel buttons + Enter/Escape keyboard support
- Used for: Deal ID, email, phone, DNC reason, DNC follow-up date, pause reason, delete confirm, resend confirm, MCL responded confirm, schedule follow-up, morning sync

### Pause / Unpause
- Pause button → asks reason → stores in pause_reason column
- Orange banner on profile, no overdue alerts, no follow-up suggestions
- Logged to comm_log and activity_log
- Unpause clears pause_reason, resumes everything

### Schedule Follow-up Date (📅 Schedule button)
- Available on any client in any active pipeline (except Lost/Won/Litigation)
- Stores date in next_followup_date column
- Blue banner on profile showing scheduled date
- Pauses automated follow-ups until that date
- Client turns RED when date arrives, counted in overdue badges
- Moving to another stage clears the scheduled date
- Clear Date button on banner

### Do Not Call Pipeline
- Moving to DNC requires: Deal ID, reason (stored in pause_reason), follow-up date (stored in next_followup_date)
- Client turns red when follow-up date arrives
- Moving out of DNC clears both reason and follow-up date
- No overdue alerts while in DNC (unless follow-up date passed)

### Global Search
- Searches all pipelines by name, email, phone
- Excludes Lost clients from results
- Clicking a stage tab clears search

### Delete Client
- Logs deletion to mcl_activity_log (action='deleted', details='Deleted: [name]')
- Sync checks for deletion log before inserting — won't re-create deleted clients

### Profile Field Auto-save
- Name, email, phone, Deal ID all editable inline
- onblur saves to DB + resets highlight
- Enter key triggers blur (saves)
- Updates local data immediately (no refresh needed)
- Name/email/phone changes also fire sheet update webhook

### Sheet Update Webhook Triggers
Fires to https://hooks.zapier.com/hooks/catch/172130/u0vj0pw/ on:
1. **MCL Responded** (Yes button): Name, Client Email, Phone Number, Action=mcl_responded
2. **Spoke/LVM** (call outcome): Name, Client Email, Phone Number, Contacted=TRUE, Action=contacted
3. **Field edits** (name/email/phone): Name, Client Email, Phone Number, Action=field_update, Field=[changed field], New Name=[if name changed]

---

## TEMPLATE KEYS (Supabase templates table)

### No Answer / LVM stage
- intro_email_no_answer, fu1_email_no_answer, fu2_email_no_answer, fu3_email_no_answer
- intro_text_no_answer, fu1_text_no_answer, fu2_text_no_answer, fu3_text_no_answer

### Contacted stage
- fu1_email_contacted, fu2_email_contacted, fu3_email_contacted, fu4_email_contacted
- fu1_text_contacted, fu2_text_contacted, fu3_text_contacted, fu4_text_contacted

### Mailing stages (waiting_mcl, packet_sent, disputes_mailed)
- intro_email_mailing, fu1_email_mailing, fu2_email_mailing, fu3_email_mailing
- intro_text_mailing, fu1_text_mailing, fu2_text_mailing, fu3_text_mailing

### Waiting on Reports
- followup_31day_email, fu2_email_reports, fu3_email_reports, fu4_email_reports
- followup_31day_text, fu2_text_reports, fu3_text_reports, fu4_text_reports

Template variables: {name} = first name, {agent} = assigned_to or 'ASAP Credit Repair'

---

## DATABASE VIEW SQL (mcl_client_status)

```sql
DROP VIEW IF EXISTS mcl_client_status;
CREATE VIEW mcl_client_status AS
SELECT id, name, email, phone, pipedrive_id, assigned_to, stage, intro_type,
    intro_sent_at, fu1_sent_at, fu2_sent_at, fu3_sent_at, fu4_sent_at,
    responded, responded_at, date_mailed, day31_start, outcome, outcome_at,
    notes, created_at, updated_at, credit_error, error_details, comm_log,
    disputes_mailed_to_client, disputes_mailed_to_cra, round_over_date, 
    pause_reason, next_followup_date,
    CASE
        WHEN fu4_sent_at IS NOT NULL THEN 'fu4'
        WHEN fu3_sent_at IS NOT NULL THEN 'fu3'
        WHEN fu2_sent_at IS NOT NULL THEN 'fu2'
        WHEN fu1_sent_at IS NOT NULL THEN 'fu1'
        WHEN intro_sent_at IS NOT NULL THEN 'intro'
        ELSE 'none'
    END AS last_followup,
    COALESCE(fu4_sent_at, fu3_sent_at, fu2_sent_at, fu1_sent_at, intro_sent_at) AS last_contact_at,
    EXTRACT(day FROM now() - COALESCE(fu4_sent_at, fu3_sent_at, fu2_sent_at, fu1_sent_at, intro_sent_at))::integer AS days_since_contact,
    COALESCE(fu4_sent_at, fu3_sent_at, fu2_sent_at, fu1_sent_at, intro_sent_at) +
        CASE WHEN stage = 'packet_sent' THEN '4 days'::interval ELSE '2 days'::interval END AS next_due_at,
    CASE
        WHEN stage = 'do_not_call' THEN 'on_track'
        WHEN pause_reason IS NOT NULL THEN 'on_track'
        WHEN responded = true THEN 'responded'
        WHEN outcome IS NOT NULL THEN 'resolved'
        WHEN stage = 'need_to_call' THEN 'needs_intro'
        WHEN stage = ANY (ARRAY['waiting_mcl', 'disputes_mailed']) THEN 'on_track'
        WHEN COALESCE(fu4_sent_at, fu3_sent_at, fu2_sent_at, fu1_sent_at, intro_sent_at) IS NULL THEN 'needs_intro'
        WHEN now() > (COALESCE(fu4_sent_at, fu3_sent_at, fu2_sent_at, fu1_sent_at, intro_sent_at) +
            CASE WHEN stage = 'packet_sent' THEN '4 days'::interval ELSE '2 days'::interval END) THEN 'overdue'
        WHEN now()::date = (COALESCE(fu4_sent_at, fu3_sent_at, fu2_sent_at, fu1_sent_at, intro_sent_at) +
            CASE WHEN stage = 'packet_sent' THEN '4 days'::interval ELSE '2 days'::interval END)::date THEN 'due_today'
        ELSE 'on_track'
    END AS follow_up_status,
    EXTRACT(day FROM now() - COALESCE(intro_sent_at, created_at))::integer AS days_in_stage,
    CASE WHEN round_over_date IS NOT NULL THEN round_over_date - CURRENT_DATE ELSE NULL END AS days_until_round_over
FROM mcl_clients c;
```

---

## TEAM MEMBERS
- Joe Mahlow (CEO, builder)
- Kimberly Sanchez (Account Manager, 281-545-5001 Ext 54, kimberly@asapcreditrepairusa.com)
- Astrid (Director of Operations)
- accounts@asapcreditrepairusa.com (main company email)
- FCRA@McCarthyLawyer.com (McCarthy Law contact)

---

## KEY DECISIONS & RULES
1. Google Sheet is synced silently — team never sees or uses it directly
2. Once a client is Lost or deleted, sync NEVER brings them back
3. Sync never moves clients backwards (only forward or same)
4. Do Not Call requires reason + follow-up date
5. Moving to any stage (except Lost) requires Deal ID (6 digits), email (@), phone (10 digits)
6. All popups use custom modals that stay on screen (no browser prompt/confirm)
7. Profile stays open after all stage moves (never clears to empty)
8. Pipedrive labels preserve non-McCarthy labels (only replaces McCarthy- prefixed ones)
9. SendGrid function only accepts single email in 'to' field (no CC support)
10. Template variables: {name} for first name, {agent} for assigned consultant
11. Comm log is JSONB array: [{date, agent, text}]
12. Auto-lose after 5 follow-ups with no response
13. Manual messages don't reload page — update comm log in-place
14. Scheduled follow-up date pauses automations until that date, then turns client red
15. Moving stages always clears next_followup_date and pause_reason

---

## TRAINING DOCUMENT
Complete 21-part training guide exists as MCL_Training_Text.md covering:
1. FCRA Violations explained
2. The App overview
3. Pipeline stages
4. Daily startup
5. Dashboard walkthrough
6. Working Need to Call
7. Sending follow-ups
8. Emailing McCarthy Law
9. Client responded to MCL
10. Communicating updates to McCarthy Law (forwarding emails to fcra@mccarthylawyer.com)
11. Moving clients between stages (validation requirements)
12. Pausing and scheduling follow-ups
13. Resending messages
14. Deleting clients
15. Sync button
16. How dates move clients automatically
17. Communication Log best practices
18. Morning sync reminder
19. Do Not Call pipeline
20. Field validation rules
21. Quick reference + daily workflow (12 steps)

---

## KNOWN ISSUES / PENDING
- Pipedrive API may have CORS issues from browser — if labels don't update, may need webhook approach
- Google Sheet sync is read-only (5-min polling) — no instant push from sheet changes
- SendGrid function needs CC support if we ever want true CC (currently sends separate emails)
- Template updates are done via Supabase SQL Editor directly on the templates table
- Session-based sync reminder uses sessionStorage (resets when browser closes)

---

## HOW TO DEPLOY
```powershell
cd ~\Downloads\mcl-client-manager
# Save new index.html to this folder
git add .
git commit -m "description of changes"
git push
# Wait 30 seconds for Netlify auto-deploy
# Hard refresh browser: Ctrl+Shift+R
```

## HOW TO UPDATE DATABASE
- Go to Supabase dashboard → SQL Editor
- Run SQL queries there (ALTER TABLE, UPDATE templates, DROP/CREATE VIEW, etc.)
- View must be dropped and recreated when adding columns
