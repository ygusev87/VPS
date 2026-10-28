from PIL import Image
from collections import deque
from pathlib import Path
import json,math
p=Path('assets-src/design-pass/kit/factory/painted-pilot-20261028/dial/speed-dial-a.webp');im=Image.open(p).convert('RGBA');px=im.load();w,h=im.size;pts=[]
for y in range(h):
 xs=[x for x in range(w) if px[x,y][3]>=115]
 if xs:pts.extend([(xs[0],y),(xs[-1],y)])
M=[[0.]*4 for _ in range(3)]
for x,y in pts:
 v=[2*x,2*y,1.];b=x*x+y*y
 for i in range(3):
  for j in range(3):M[i][j]+=v[i]*v[j]
  M[i][3]+=v[i]*b
for i in range(3):
 k=max(range(i,3),key=lambda k:abs(M[k][i]));M[i],M[k]=M[k],M[i];t=M[i][i];M[i]=[v/t for v in M[i]]
 for j in range(3):
  if j!=i:
   t=M[j][i];M[j]=[a-t*b for a,b in zip(M[j],M[i])]
cx,cy,c=[r[3]for r in M];R=math.sqrt(c+cx*cx+cy*cy)
dark=set()
for y in range(h):
 for x in range(w):
  r=math.hypot(x-cx,y-cy)
  if 130<r<195 and max(px[x,y][:3])<110 and px[x,y][3]>=115:dark.add((x,y))
parts=[]
while dark:
 q=[dark.pop()];cells=[]
 while q:
  x,y=q.pop();cells.append((x,y))
  for n in [(x+1,y),(x-1,y),(x,y+1),(x,y-1)]:
   if n in dark:dark.remove(n);q.append(n)
 if len(cells)>8:
  x=sum(x for x,y in cells)/len(cells);y=sum(y for x,y in cells)/len(cells);parts.append({'pixels':len(cells),'centerXY':[x,y],'angleDeg':math.degrees(math.atan2(cy-y,x-cx))%360})
parts.sort(key=lambda v:v['angleDeg']);result={'circleCenterPixels':[cx,cy],'circleCenterUv':[(cx+.5)/w,(cy+.5)/h],'circleRadiusPx':R,'boundaryRadialResidualMaxPx':max(abs(math.hypot(x-cx,y-cy)-R)for x,y in pts),'tickComponents':parts};(p.parent/'image-audit.json').write_text(json.dumps(result,indent=2));print(json.dumps({**{k:v for k,v in result.items()if k!='tickComponents'},'ticks':len(parts),'angles':[round(v['angleDeg'],2)for v in parts]},indent=2))
