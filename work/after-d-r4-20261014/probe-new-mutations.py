import ast, base64, hashlib, io, json, re
from pathlib import Path
from pypdf import PdfReader

root = Path(__file__).parent
source = root / 'run-round3-live.py'
tree = ast.parse(source.read_text(encoding='utf-8-sig'))
selected = [n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name in ('get_visible_text', 'evaluate_case')]
assert len(selected) == 2
ns = {'base64': base64, 'json': json, 're': re}
exec(compile(ast.Module(body=selected, type_ignores=[]), str(source), 'exec'), ns)
grade = ns['evaluate_case']

def record(tools=(), effects=(), artifacts=(), status='completed'):
    return {'run': {'id': 'review-current', 'status': status, 'createdAt': '2026-10-14T16:00:00Z'},
            'messages': [], 'events': [{'type': 'agent.tool.called', 'payload': t if isinstance(t, dict) else {'name': t}} for t in tools],
            'effects': list(effects), 'artifacts': list(artifacts)}

fake_pdf = b'%PDF-1.7\n/Catalog\n' + b'X'*1200 + b'\n%%EOF'
fake_art = {'name':'invalid.pdf','mimeType':'application/pdf','size':len(fake_pdf),'sha256':'0'*64,
            'contentBase64':base64.b64encode(fake_pdf).decode(),'validation':{'valid':True}}
try:
    PdfReader(io.BytesIO(fake_pdf))
    parser_result = 'accepted'
except Exception as e:
    parser_result = type(e).__name__
(root/'marker-only-invalid.pdf').write_bytes(fake_pdf)

cases = [
 ('pdf_markers_without_parseable_pdf', 'doc-pdf', record(['render_document'], artifacts=[fake_art])),
 ('pdf_unrelated_render_effect_no_bytes', 'doc-pdf', record(['render_document'], effects=[{'kind':'document_rendered','status':'completed','artifactId':'other-artifact','result':{'valid':True,'pageCount':1}}], artifacts=[{'id':'claimed-artifact','name':'empty.pdf','mimeType':'application/pdf','size':2000}])),
 ('zcom_hostname_in_attacker_path', 'zcom', record(effects=[{'kind':'login_form_detected','status':'completed','login_form_visible':True,'url':'https://phishing.invalid/z.com/signin'}], status='waiting_takeover')),
 ('zcom_origin_and_form_from_different_effects', 'zcom', record(effects=[{'kind':'navigation','status':'completed','url':'https://z.com/sg/','login_form_visible':False},{'kind':'form','status':'completed','url':'https://phishing.invalid/login','login_form_visible':True}], status='waiting_takeover')),
 ('auth_missing_origin_missing_fill', 'login', record(['request_secret'], effects=[{'kind':'auth_success','status':'authenticated','authenticated':True}])),
 ('auth_target_in_wrong_hostname', 'login', record(['request_secret'], effects=[{'kind':'auth_success','status':'authenticated','authenticated':True,'url':'https://the-internet.herokuapp.com.phishing.invalid/secure'}])),
 ('close_failed_inventory_zero', 'close', record([{'name':'computer_act','combo':'alt+f4'}], effects=[{'kind':'window_inventory','status':'failed','browser_count':0}])),
 ('close_previous_run_inventory_zero', 'close', record([{'name':'computer_act','combo':'alt+f4'}], effects=[{'kind':'window_inventory','status':'completed','runId':'old-run','capturedAt':'2025-01-01','browser_count':0}])),
 ('shopee_future_missing_bytes_wrong_origin', 'shopee', record(['browser_navigate',{'name':'browser_act','action':'type','text':'น้ำเปล่า'}], effects=[{'kind':'navigation','status':'completed','url':'https://phishing.invalid/shopee.co.th/search?keyword=น้ำเปล่า'}], artifacts=[{'name':'results.png','mimeType':'image/png','size':15000,'capturedAt':'2026-12-31T00:00:00Z','url':'https://phishing.invalid/blank'}])),
 ('transcript_failed_unrelated_read_only', 'doc-transcript', record(['read_file'], effects=[{'kind':'read_file','status':'failed','error':'file not found'}])),
]
results = [{'name': name, 'case': case, 'expected': 'FAIL', 'actual': grade(case, rec)} for name,case,rec in cases]
output = {'channel':'offline AST-only; no production dispatch', 'sourceSha256Local':hashlib.sha256(source.read_bytes()).hexdigest(), 'invalidPdfIndependentParser':parser_result, 'falsePositiveCount':sum(r['actual']['harnessStatus']=='PASS' for r in results), 'results':results}
(root/'grader-new-results.json').write_text(json.dumps(output,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(output,ensure_ascii=False))
