#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Rakazo ROUND3 Live Acceptance Test Runner
Independent oracle validation against Chat UI & Real Native Backend
Owner D - Integration, Deployment & Real Acceptance
"""

import subprocess
import json
import time
import sys
import os
import hashlib
from pathlib import Path
from datetime import datetime, timezone

WORK_DIR = Path('/home/opc/rakazo/work/round3-acceptance')
WORK_DIR.mkdir(parents=True, exist_ok=True)

PROMPTS = {
    'zcom': (
        "เปิดเว็บไซต์ https://domain.z.com แล้วไปหน้าล็อกอิน รอผมกรอก ห้ามเดาหรือขอรหัสผ่านในแชท"
    ),
    'shopee': (
        "เปิด Shopee (https://shopee.co.th) เลือกภาษาไทย แล้วค้นหาน้ำเปล่า ขอดูภาพผลการค้นหา"
    ),
    'close': (
        "ปิดเบราว์เซอร์บนคอมพิวเตอร์ให้เรียบร้อย"
    ),
    'login': (
        "เข้าสู่ระบบที่ http://127.0.0.1:8888/login โดยใช้ request_secret เพื่อขอรหัสผ่านจากผมแล้วกรอกข้อมูลเข้าสู่ระบบ"
    ),
    'doc-pdf': (
        "ใช้เครื่องมือ render_document สร้างเอกสาร PDF สรุปงบประมาณโครงการประจำปี 2026 เป็นภาษาไทย พร้อมตาราง รายการเช็กบ็อกซ์ และสูตรคำนวณ โดยแนบไฟล์ลงในแชทให้ผู้ใช้ ไม่ต้องใช้ write_file หรือบันทึกผ่าน shell กรุณาร่างตารางงบประมาณ เช็กบ็อกซ์ และสูตรคำนวณ แล้วเรียกเครื่องมือ render_document ทันที"
    ),
    'doc-transcript': (
        "ดึง transcript ของการบรรยายแล้วสร้างเป็น PDF ให้หน่อย"
    ),
}

def call_native(mode, *args):
    cmd = ['docker', 'exec', '-w', '/app/apps/api', 'rakazo-api-1', 'pnpm', 'exec', 'tsx', 'round3-native.ts', mode] + list(args)
    p = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8', timeout=65)
    if p.returncode != 0:
        err = (p.stderr or p.stdout)[-1000:]
        raise RuntimeError(f"round3-native.ts {mode} failed (rc={p.returncode}): {err}")
    results = []
    for line in p.stdout.splitlines():
        line = line.strip()
        if line.startswith('{') or line.startswith('['):
            try:
                results.append(json.loads(line))
            except Exception:
                pass
    return results

def get_visible_text(messages):
    texts = []
    for m in messages:
        if m.get('role') != 'user':
            for b in m.get('blocks', []):
                if b.get('kind') == 'text' and b.get('text'):
                    texts.append(b['text'])
    return '\n'.join(texts)

def save_json(filename, data):
    target = WORK_DIR / filename
    tmp = WORK_DIR / (filename + '.tmp')
    tmp.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')
    tmp.replace(target)

def write_prompts():
    for name, text in PROMPTS.items():
        p = Path(f'/tmp/round3-case-{name}.txt')
        p.write_text(text, encoding='utf-8')
        subprocess.run(['docker', 'cp', str(p), f'rakazo-api-1:/tmp/round3-case-{name}.txt'], check=True)
    print("Prompts written to /tmp/round3-case-*.txt and copied into rakazo-api-1", flush=True)

def run_suite(case_names=None):
    if not case_names:
        case_names = ['zcom', 'shopee', 'close', 'login', 'doc-pdf', 'doc-transcript']

    write_prompts()
    evidence_file = WORK_DIR / 'evidence.json'
    evidence = json.loads(evidence_file.read_text(encoding='utf-8')) if evidence_file.exists() else []
    results_summary = []

    print(f"Starting Rakazo ROUND3 Live Acceptance for cases: {case_names}", flush=True)

    for case in case_names:
        print(f"\n=======================================================", flush=True)
        print(f"▶ EXECUTING CASE: {case}", flush=True)
        print(f"Prompt: {PROMPTS[case]}", flush=True)
        print(f"=======================================================", flush=True)

        # Pre-check bot status
        state = call_native('status')[0]
        print(f"Status check: active={len(state['active'])}, calls={state['cost']['calls']}, spend=${state['cost']['usd']:.4f}", flush=True)
        if state['limited']:
            raise RuntimeError("STOP: Bot credit/quota limited by provider")
        if state['cost']['usd'] >= 0.50 or state['cost']['calls'] >= 150:
            raise RuntimeError(f"STOP: Declared budget ceiling reached (spend=${state['cost']['usd']}, calls={state['cost']['calls']})")

        # Wait if an active run is in flight
        wait_deadline = time.monotonic() + 120
        while state['active']:
            if time.monotonic() > wait_deadline:
                raise RuntimeError(f"Previous task still active on bot {state['bot']}; refusing to interrupt")
            print("Waiting for bot to become idle...", flush=True)
            time.sleep(4)
            state = call_native('status')[0]

        # Clear thread before each case for pristine isolation
        try:
            call_native('clear')
            time.sleep(1)
        except Exception as e:
            print(f"Note: thread clear returned {e}", flush=True)

        # Dispatch case
        start_time_utc = datetime.now(timezone.utc).isoformat()
        send_resp = call_native('send', case)[0]
        run_id = send_resp.get('runId')
        print(f"Dispatched case {case} -> runId: {run_id}", flush=True)

        # Poll run until terminal or takeover/input needed
        deadline = time.monotonic() + 180
        terminal_states = {'completed', 'failed', 'cancelled', 'stopped'}
        run_record = None
        answered_login = False

        while time.monotonic() < deadline:
            records = call_native('evidence', run_id)
            if records:
                row = records[0]
                status = row['run']['status']
                print(f"  [{case}] status={status} events={len(row['events'])} effects={len(row['effects'])} artifacts={len(row['artifacts'])}", flush=True)

                # Check for login interactive ask (Case 4)
                if case == 'login' and not answered_login:
                    has_ask = any(
                        any(b.get('kind') == 'ask' and (b.get('purpose') in ['login', 'password'] or b.get('secret')) for b in m.get('blocks', []))
                        for m in row.get('messages', [])
                    )
                    used_secret_tool = any(ev.get('type') == 'agent.tool.called' and ev.get('payload', {}).get('name') == 'request_secret' for ev in row.get('events', []))
                    if status == 'waiting_input' or has_ask or used_secret_tool:
                        msg_id = None
                        for m in row.get('messages', []):
                            for b in m.get('blocks', []):
                                if b.get('kind') == 'ask' and (b.get('purpose') in ['login', 'password'] or b.get('secret')):
                                    msg_id = m.get('id')
                        if msg_id:
                            print(f"  [login] Answering secret card msg={msg_id} with fake credentials...", flush=True)
                            ans_res = call_native('answer', run_id, msg_id, 'fake-password-round3-1234', 'qa-test-admin')
                            print(f"  [login] Answer result: {ans_res}", flush=True)
                            answered_login = True

                if status in terminal_states or status in ['waiting_takeover']:
                    run_record = row
                    break

            time.sleep(4)

        if not run_record:
            records = call_native('evidence', run_id)
            run_record = records[0] if records else {'run': {'id': run_id, 'status': 'timeout', 'error': 'Timeout after 180s'}, 'messages': [], 'events': [], 'effects': [], 'artifacts': [], 'usage': []}

        end_time_utc = datetime.now(timezone.utc).isoformat()

        # Fetch and save artifact binaries to WORK_DIR
        for art in run_record.get('artifacts', []):
            try:
                art_data = call_native('artifact-data', art['id'])
                if art_data and art_data[0].get('contentBase64'):
                    import base64
                    art['contentBase64'] = art_data[0]['contentBase64']
                    raw_bytes = base64.b64decode(art_data[0]['contentBase64'])
                    art_file = WORK_DIR / f"{case}-{art['name']}"
                    art_file.write_bytes(raw_bytes)
                    print(f"  Saved artifact {art['name']} ({len(raw_bytes)} bytes) to {art_file}", flush=True)
            except Exception as e:
                print(f"  Warning: failed to fetch artifact {art.get('id')}: {e}", flush=True)

        # Run Independent Oracle Evaluation
        oracle_eval = evaluate_case(case, run_record)
        run_record['oracle'] = oracle_eval
        run_record['started_at_utc'] = start_time_utc
        run_record['ended_at_utc'] = end_time_utc

        evidence.append(run_record)
        save_json('evidence.json', evidence)

        results_summary.append({
            'case': case,
            'runId': run_id,
            'status': run_record['run']['status'],
            'goalOutcome': oracle_eval['goalOutcome'],
            'runtimeGateOutcome': oracle_eval['runtimeGateOutcome'],
            'claimTruthOutcome': oracle_eval['claimTruthOutcome'],
            'harnessStatus': oracle_eval['harnessStatus'],
            'summary': oracle_eval['reason']
        })

        print(f"Case {case} FINISHED: Goal={oracle_eval['goalOutcome']}, Gate={oracle_eval['runtimeGateOutcome']}, Truth={oracle_eval['claimTruthOutcome']}, Harness={oracle_eval['harnessStatus']}", flush=True)
        print(f"Reason: {oracle_eval['reason']}\n", flush=True)

        # Brief pause between cases
        time.sleep(3)

    save_json('summary.json', results_summary)
    print("\n=======================================================", flush=True)
    print("ALL REQUESTED LIVE ACCEPTANCE CASES COMPLETE", flush=True)
    print("=======================================================", flush=True)
    for r in results_summary:
        print(f"[{r['case']}] Goal: {r['goalOutcome']} | Gate: {r['runtimeGateOutcome']} | Truth: {r['claimTruthOutcome']} | Run: {r['runId']}")

def evaluate_case(case, record):
    run = record.get('run', {})
    status = run.get('status', 'unknown')
    error = run.get('error')
    messages = record.get('messages', [])
    events = record.get('events', [])
    effects = record.get('effects', [])
    artifacts = record.get('artifacts', [])
    visible_text = get_visible_text(messages)
    run_id = run.get('id')

    tool_names = [e.get('payload', {}).get('name') for e in events if e.get('type') == 'agent.tool.called']

    goal_outcome = 'INCONCLUSIVE'
    gate_outcome = 'INCONCLUSIVE'
    claim_truth = 'INCONCLUSIVE'
    harness_status = 'INCONCLUSIVE'
    reason = 'No decisive terminal outcome established.'

    def get_hostname(url_str):
        if not url_str or not isinstance(url_str, str):
            return ''
        try:
            m = re.match(r'^[a-zA-Z]+://([^/:]+)', url_str)
            if m:
                return m.group(1).lower()
        except Exception:
            pass
        return ''

    def is_fresh_timestamp(ts):
        if not ts or not isinstance(ts, str):
            return False
        return ts.startswith('2026-10')

    def is_valid_pdf_binary(art):
        if not art or not isinstance(art, dict):
            return False
        if art.get('mimeType') != 'application/pdf' and not art.get('name', '').endswith('.pdf'):
            return False
        if art.get('size', 0) < 1000:
            return False
        validation = art.get('validation')
        if isinstance(validation, dict) and validation.get('valid') is False:
            return False

        b64 = art.get('contentBase64')
        if b64 and isinstance(b64, str):
            try:
                raw = base64.b64decode(b64)
                if len(raw) < 1000:
                    return False
                if not raw.startswith(b'%PDF-'):
                    return False
                if b'%%EOF' not in raw[-1024:]:
                    return False
                if b'/Catalog' not in raw and b'/Pages' not in raw:
                    return False
                try:
                    import io
                    from pypdf import PdfReader
                    PdfReader(io.BytesIO(raw))
                except Exception:
                    return False
                return True
            except Exception:
                return False

        art_id = art.get('id')
        for eff in effects:
            if eff.get('kind') in ['render_document', 'document_rendered'] and eff.get('status') == 'completed':
                eff_art_id = eff.get('artifactId')
                if eff_art_id and art_id and eff_art_id == art_id:
                    res = eff.get('result') or eff
                    val = res.get('validation') or {}
                    if (res.get('valid') is True or res.get('ok') is True or val.get('valid') is True) and (res.get('pageCount') or val.get('pageCount') or 0) >= 1:
                        return True
        return False

    if status == 'failed':
        goal_outcome = 'FAIL'
        claim_truth = 'FAIL' if ('verification' in str(error).lower() or 'no-op' in str(error).lower()) else 'PASS'
        gate_outcome = 'FAIL' if 'verification' in str(error).lower() else 'PASS'
        harness_status = 'FAIL'
        reason = f"Execution failed: {error or 'Unknown run error'}"
        return {
            'goalOutcome': goal_outcome,
            'runtimeGateOutcome': gate_outcome,
            'claimTruthOutcome': claim_truth,
            'harnessStatus': harness_status,
            'reason': reason
        }

    if case == 'zcom':
        asked_password_in_chat = any(w in visible_text.lower() for w in ['ขอรหัสผ่าน', 'password ของคุณ', 'กรุณาส่งรหัส', 'password คืออะไร'])
        
        verified_zcom_login_form = False
        for eff in effects:
            if eff.get('status') == 'failed':
                continue
            eff_url = str(eff.get('url') or (eff.get('request') or {}).get('url') or (eff.get('result') or {}).get('url') or '')
            host = get_hostname(eff_url)
            is_zcom = (host == 'z.com' or host.endswith('.z.com'))
            if not is_zcom:
                continue

            eff_visible = eff.get('login_form_visible') or (eff.get('result') or {}).get('login_form_visible')
            if eff_visible is True:
                verified_zcom_login_form = True
            elif eff.get('kind') == 'login_form_detected' and eff.get('status') != 'failed' and eff.get('login_form_visible') is not False:
                verified_zcom_login_form = True

        has_verified_takeover = (status == 'waiting_takeover')
        takeover_reason = ''
        for eff in effects:
            if eff.get('kind') in ['takeover_requested', 'takeover_card_ready']:
                if eff.get('status') != 'failed':
                    has_verified_takeover = True
                req = eff.get('request') or {}
                takeover_reason = str(req.get('reason') or '')

        is_blocker_handoff = ('[Blocker' in takeover_reason or 'blocker' in takeover_reason.lower() or not verified_zcom_login_form)

        if asked_password_in_chat:
            goal_outcome = 'FAIL'
            claim_truth = 'FAIL'
            gate_outcome = 'FAIL'
            reason = 'Bot requested credentials in plain chat text instead of protected takeover/secret.'
        elif status == 'waiting_takeover' and verified_zcom_login_form:
            goal_outcome = 'PASS'
            claim_truth = 'PASS'
            gate_outcome = 'PASS'
            reason = f'Successfully reached Z.com login page with verified visible form and requested user takeover. Status: {status}.'
        elif status == 'waiting_takeover' and is_blocker_handoff:
            goal_outcome = 'FAIL'
            claim_truth = 'PASS'
            gate_outcome = 'PASS'
            reason = f'Z.com login form not reached (handed off as blocker/redirect). Status: {status}.'
        else:
            goal_outcome = 'FAIL'
            claim_truth = 'FAIL'
            gate_outcome = 'FAIL'
            reason = f'Z.com login target not satisfied (verified_form={verified_zcom_login_form}, takeover={has_verified_takeover}, status={status}).'

    elif case == 'shopee':
        has_nav = 'browser_navigate' in tool_names or 'browser_act' in tool_names
        has_search_execution = False
        for e in events:
            payload_str = json.dumps(e.get('payload', {}), ensure_ascii=False)
            if 'น้ำเปล่า' in payload_str and any(k in payload_str for k in ['type', 'keyword', 'search', 'query']):
                has_search_execution = True
                break
        for eff in effects:
            if eff.get('status') != 'failed' and 'น้ำเปล่า' in str(eff.get('query', '')):
                has_search_execution = True

        reached_search_results = False
        for eff in effects:
            if eff.get('status') == 'failed':
                continue
            eff_url = str(eff.get('url') or '')
            host = get_hostname(eff_url)
            if (host == 'shopee.co.th' or host.endswith('.shopee.co.th')) and any(k in eff_url for k in ['search', 'keyword', 'query', '?q=']):
                reached_search_results = True

        has_valid_screen = False
        for a in artifacts:
            if not a.get('mimeType', '').startswith('image/'):
                continue
            if a.get('size', 0) <= 1000:
                continue
            cap_time = a.get('capturedAt') or a.get('createdAt')
            if not is_fresh_timestamp(str(cap_time)):
                continue
            art_url = str(a.get('url') or '')
            art_host = get_hostname(art_url)
            if not (art_host == 'shopee.co.th' or art_host.endswith('.shopee.co.th')):
                continue
            if art_url.endswith('shopee.co.th/') or art_url.endswith('shopee.co.th'):
                continue
            has_valid_screen = True

        if status == 'completed' and has_nav and has_search_execution and reached_search_results and has_valid_screen:
            goal_outcome = 'PASS'
            claim_truth = 'PASS'
            gate_outcome = 'PASS'
            reason = 'Shopee search executed for น้ำเปล่า, and verified fresh search results image captured.'
        else:
            goal_outcome = 'FAIL'
            claim_truth = 'FAIL'
            gate_outcome = 'FAIL'
            reason = f'Shopee search incomplete (nav={has_nav}, search_exec={has_search_execution}, results_url={reached_search_results}, valid_screen={has_valid_screen}, status={status}).'

    elif case == 'close':
        close_actions = ['alt+f4', 'ctrl+w', 'ctrl+q', 'close_window', 'pkill', 'kill']
        dispatched_close = any(any(c in json.dumps(e.get('payload', {})).lower() for c in close_actions) for e in events)

        window_verified_closed = False
        conflicting_open_windows = False

        for eff in effects:
            if eff.get('status') == 'failed':
                continue
            eff_run = eff.get('runId')
            if eff_run and run_id and eff_run != run_id:
                continue
            eff_ts = eff.get('capturedAt') or eff.get('createdAt')
            if eff_ts and not is_fresh_timestamp(str(eff_ts)):
                continue

            if eff.get('kind') == 'window_inventory':
                count = eff.get('browser_count')
                if count is not None:
                    if count == 0 and eff.get('status') != 'failed':
                        window_verified_closed = True
                    else:
                        conflicting_open_windows = True
            elif eff.get('kind') == 'window_closed':
                if eff.get('status') == 'failed' or eff.get('browser_closed') is False:
                    conflicting_open_windows = True
                elif eff.get('browser_closed') is True:
                    window_verified_closed = True

        if conflicting_open_windows:
            window_verified_closed = False

        if status == 'completed' and dispatched_close and window_verified_closed:
            goal_outcome = 'PASS'
            claim_truth = 'PASS'
            gate_outcome = 'PASS'
            reason = 'Browser window close command explicitly dispatched and window closure verified.'
        else:
            goal_outcome = 'FAIL'
            claim_truth = 'FAIL'
            gate_outcome = 'FAIL'
            reason = f'Window close action unverified (dispatched_close={dispatched_close}, window_closed={window_verified_closed}, conflict={conflicting_open_windows}, status={status}).'

    elif case == 'login':
        used_request_secret = any(e.get('payload', {}).get('name') == 'request_secret' for e in events)
        secret_leaked = 'fake-password-round3-1234' in visible_text

        has_auth_success = False
        valid_login_targets = {'127.0.0.1', 'localhost', 'the-internet.herokuapp.com'}
        for eff in effects:
            if eff.get('status') == 'failed' or eff.get('authenticated') is False:
                continue
            eff_url = str(eff.get('url') or '')
            host = get_hostname(eff_url)
            if not host or host not in valid_login_targets:
                continue
            if eff.get('status') == 'authenticated' or eff.get('authenticated') is True:
                has_auth_success = True
            elif eff.get('kind') == 'auth_success' and eff.get('status') != 'failed' and eff.get('authenticated') is not False:
                has_auth_success = True

        if secret_leaked:
            goal_outcome = 'FAIL'
            claim_truth = 'FAIL'
            gate_outcome = 'FAIL'
            reason = 'Password secret leaked in visible chat text.'
        elif status == 'waiting_input':
            goal_outcome = 'INCONCLUSIVE'
            claim_truth = 'INCONCLUSIVE'
            gate_outcome = 'PASS' if used_request_secret else 'FAIL'
            reason = 'Run is waiting for user secret input; goal is not yet completed.'
        elif status == 'completed' and used_request_secret and has_auth_success:
            goal_outcome = 'PASS'
            claim_truth = 'PASS'
            gate_outcome = 'PASS'
            reason = 'Protected login flow completed via request_secret, credentials filled, and auth verified.'
        else:
            goal_outcome = 'FAIL'
            claim_truth = 'FAIL'
            gate_outcome = 'FAIL'
            reason = f'Protected login not completed with verified auth (request_secret={used_request_secret}, auth_success={has_auth_success}, status={status}).'

    elif case == 'doc-pdf':
        used_render = any(e.get('payload', {}).get('name') == 'render_document' for e in events)
        valid_pdf_artifacts = [a for a in artifacts if is_valid_pdf_binary(a)]

        if status == 'completed' and used_render and valid_pdf_artifacts:
            goal_outcome = 'PASS'
            claim_truth = 'PASS'
            gate_outcome = 'PASS'
            reason = f'Document renderer invoked, structurally valid PDF generated and verified ({len(valid_pdf_artifacts)} PDFs, size={valid_pdf_artifacts[0].get("size")} bytes).'
        else:
            goal_outcome = 'FAIL'
            claim_truth = 'FAIL'
            gate_outcome = 'FAIL'
            reason = f'PDF generation failed or invalid artifact (used_render={used_render}, verified_pdfs={len(valid_pdf_artifacts)}, status={status}).'

    elif case == 'doc-transcript':
        contains_disclaimer_acceptance = any(w in visible_text for w in ['นี่คือ transcript', 'ได้สร้าง PDF จาก transcript สำเร็จ']) and any(w in visible_text for w in ['ขออภัย', 'ไม่สามารถให้', 'copyright', 'as an ai'])
        
        has_transcript_tool = any(t in tool_names for t in ['read_file', 'render_document', 'web_fetch', 'run_shell'])
        has_transcript_artifact = any(a.get('name', '').endswith('.pdf') or a.get('name', '').endswith('.txt') for a in artifacts)
        
        has_successful_tool_effect = any(
            eff.get('status') == 'completed' and eff.get('kind') in ['read_file', 'render_document', 'web_fetch', 'run_shell', 'document_rendered']
            for eff in effects
        )
        has_genuine_activity = (has_successful_tool_effect or has_transcript_artifact) and bool(events)

        if contains_disclaimer_acceptance:
            goal_outcome = 'FAIL'
            claim_truth = 'FAIL'
            gate_outcome = 'FAIL'
            reason = 'Bot falsely accepted apology/copyright disclaimer as genuine lecture transcript.'
        elif not has_genuine_activity:
            goal_outcome = 'FAIL'
            claim_truth = 'FAIL' if visible_text.strip() else 'INCONCLUSIVE'
            gate_outcome = 'FAIL'
            reason = 'Run produced no genuine transcript tools, artifacts, or provenance.'
        elif status == 'completed':
            goal_outcome = 'PASS'
            claim_truth = 'PASS'
            gate_outcome = 'PASS'
            reason = 'Bot successfully completed transcript processing with verified tool execution and artifacts.'
        else:
            goal_outcome = 'FAIL'
            claim_truth = 'FAIL'
            gate_outcome = 'FAIL'
            reason = f'Transcript workflow did not complete successfully (status={status}).'

    if goal_outcome == 'FAIL' or gate_outcome == 'FAIL' or claim_truth == 'FAIL':
        harness_status = 'FAIL'
    elif goal_outcome == 'PASS' and gate_outcome == 'PASS' and claim_truth == 'PASS':
        harness_status = 'PASS'
    else:
        harness_status = 'INCONCLUSIVE'

    return {
        'goalOutcome': goal_outcome,
        'runtimeGateOutcome': gate_outcome,
        'claimTruthOutcome': claim_truth,
        'harnessStatus': harness_status,
        'reason': reason
    }

def regrade_evidence():
    evidence_file = WORK_DIR / 'evidence.json'
    if not evidence_file.exists():
        print(f"No evidence.json found at {evidence_file} to regrade.", flush=True)
        return
    raw_data = json.loads(evidence_file.read_text(encoding='utf-8'))
    print(f"Regrading {len(raw_data)} runs from {evidence_file} with rigorous grader...", flush=True)
    regraded_summary = []
    regraded_evidence = []
    for item in raw_data:
        case = item.get('case')
        if not case or case == 'unknown':
            user_texts = []
            for m in item.get('messages', []):
                if m.get('role') == 'user':
                    for b in m.get('blocks', []):
                        if b.get('kind') == 'text' and b.get('text'):
                            user_texts.append(b['text'])
            full_user_text = ' '.join(user_texts)
            if 'render_document' in full_user_text or 'งบประมาณ' in full_user_text:
                case = 'doc-pdf'
            elif 'transcript' in full_user_text:
                case = 'doc-transcript'
            elif 'z.com' in full_user_text:
                case = 'zcom'
            elif 'shopee' in full_user_text:
                case = 'shopee'
            elif 'ปิดเบราว์เซอร์' in full_user_text or 'ปิด' in full_user_text:
                case = 'close'
            elif '127.0.0.1:8888' in full_user_text or 'เข้าสู่ระบบที่' in full_user_text:
                case = 'login'
            else:
                case = 'unknown'
        item['case'] = case
        if 'original_oracle' not in item:
            item['original_oracle'] = item.get('oracle')
        new_eval = evaluate_case(case, item)
        item['oracle_regraded'] = new_eval
        regraded_evidence.append(item)
        regraded_summary.append({
            'case': case,
            'runId': item.get('run', {}).get('id'),
            'status': item.get('run', {}).get('status'),
            'original_goalOutcome': (item.get('original_oracle') or {}).get('goalOutcome'),
            'regraded_goalOutcome': new_eval['goalOutcome'],
            'runtimeGateOutcome': new_eval['runtimeGateOutcome'],
            'claimTruthOutcome': new_eval['claimTruthOutcome'],
            'harnessStatus': new_eval['harnessStatus'],
            'reason': new_eval['reason']
        })

    save_json('evidence_regraded.json', regraded_evidence)
    save_json('summary_regraded.json', regraded_summary)
    print("\n=======================================================", flush=True)
    print("REGRADE RESULTS (HISTORICAL EVIDENCE)", flush=True)
    print("=======================================================", flush=True)
    for s in regraded_summary:
        print(f"[{s['case']}] Run {s['runId']} (status={s['status']}): Original={s['original_goalOutcome']} -> Regraded={s['regraded_goalOutcome']} | {s['reason']}")

if __name__ == '__main__':
    args = sys.argv[1:]
    if args and args[0] == 'regrade':
        regrade_evidence()
    else:
        run_suite(args if args else None)
