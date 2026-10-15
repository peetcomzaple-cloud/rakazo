import json
from pathlib import Path
import sys

live_path = Path('/home/opc/rakazo/work/round3-acceptance/run-round3-live.py')
code = live_path.read_text(encoding='utf-8')
namespace = {}
exec(code, namespace)
evaluate_case = namespace['evaluate_case']

ev_path = Path('/home/opc/rakazo/work/round3-acceptance/evidence.json')
data = json.loads(ev_path.read_text(encoding='utf-8'))
for idx, item in enumerate(data):
    case = item.get('case', 'doc-pdf')
    res = evaluate_case(case, item)
    if res is None:
        print(f"Item {idx} (runId={item.get('run',{}).get('id')}, case={case}) returned None!")
    else:
        print(f"Item {idx} (case={case}): {res['harnessStatus']}")
