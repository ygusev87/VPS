"""Source-derived geometric envelope for the wall cards; no gameplay claims."""
import hashlib
import json
import math
from pathlib import Path
base = Path(__file__).resolve().parent
root = base.parents[4]
report = json.loads((base / 'wall-pair.json').read_text())
sy, sz = .78 / math.hypot(1, .78), 1 / math.hypot(1, .78)
sign = report['assets'][0]
sign['projectedGapBelowPipe'] = (2.2-sign['visibleWorldY'][1])*sy-.38*sz-.18
assert sign['projectedGapBelowPipe'] > 0
phases = []
for i in range(181):
    k = i/100
    angle = math.sin(k*60)*.12*max(0, 1-k/1.6)
    jump = abs(math.sin(k*30))*.08*max(0, 1-k/1.6)
    half = .8*(abs(math.sin(angle))+abs(math.cos(angle)))
    phases.append((3.4+jump-half, 3.4+jump+half, half))
# Continuous bound for |angle|<=.12 and jump in[0,.08], including optional bells.
half = .8*(math.sin(.12)+math.cos(.12))
low, high = 3.4-half, 3.48+half
assert low > 2.38 and high < 5 and half < 1.5
report['geometryAudit'] = {
    'sampledPhases':181, 'stepSeconds':.01,
    'sampledWorldY':[min(x[0] for x in phases),max(x[1] for x in phases)],
    'continuousEnvelope':{'halfSizeBeforeAnimation':.8,'rotationBound':.12,'positiveJumpBound':.08,'worldY':[low,high],'absX':half,'windowGapX':[-1.5,1.5],'windowClearance':1.5-half,'wallTopClearance':5-high,'pipeUpperY':2.38,'pipeClearance':low-2.38},
    'includes':'1.4 clock plane, current hand and optional old bells',
    'clockPlaneInFrontOfWall':.1,
    'sourceHashes':{p:hashlib.sha256((root/p).read_bytes()).hexdigest() for p in ['src/factory.ts','src/life.ts']},
    'limitation':'source-derived bounds and isolated wall rendering; no actual gameplay/raycast/sound/interaction test'
}
(base/'wall-pair.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report['geometryAudit']))
