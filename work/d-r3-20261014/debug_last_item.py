import json
from pathlib import Path
import sys

grader_dir = Path('/home/opc/rakazo/work/d-r3-20261014')
sys.path.insert(0, str(grader_dir))
from test_grader_invariants import evaluate_case

ev_path = Path('/home/opc/rakazo/work/round3-acceptance/evidence.json')
data = json.loads(ev_path.read_text(encoding='utf-8'))
item = data[-1]
print("Run ID:", item['run']['id'])
print("Artifacts:", item.get('artifacts'))
print("Effects:", item.get('effects'))
res = evaluate_case('doc-pdf', item)
print("Evaluate result:", res)
