#!/usr/bin/env python3
"""Apply the TADEX Hub auth email templates + subjects to the Supabase project (Management API).
Run in a fresh login shell so SUPABASE_ACCESS_TOKEN is set:  bash -lc 'python3 supabase/email-templates/apply.py'
Links point at {{ .SiteURL }}/auth/confirm (Site URL = https://tadexhub.com), never at *.supabase.co.
Email change + reauthentication keep the Supabase defaults (the hub has no email-change feature)."""
import json, os, pathlib, urllib.request
REF = "ichcxptnnzakwzlmixvk"
here = pathlib.Path(__file__).parent
subjects = json.loads((here / "subjects.json").read_text())
body = {"site_url": "https://tadexhub.com"}
for k, subj in subjects.items():
    body[f"mailer_subjects_{k}"] = subj
    body[f"mailer_templates_{k}_content"] = (here / f"{k}.html").read_text()
req = urllib.request.Request(f"https://api.supabase.com/v1/projects/{REF}/config/auth", data=json.dumps(body).encode(), method="PATCH",
    headers={"Authorization": "Bearer " + os.environ["SUPABASE_ACCESS_TOKEN"], "Content-Type": "application/json", "User-Agent": "tadex-hub-apply"})
with urllib.request.urlopen(req) as r:
    d = json.load(r)
for k in subjects:
    t = d[f"mailer_templates_{k}_content"]
    assert "/auth/confirm?token_hash={{ .TokenHash }}" in t and "ConfirmationURL" not in t and "supabase.co" not in t, k
    print("applied", k, "|", d[f"mailer_subjects_{k}"])
print("site_url", d["site_url"], "| redirect allow list", d["uri_allow_list"])
