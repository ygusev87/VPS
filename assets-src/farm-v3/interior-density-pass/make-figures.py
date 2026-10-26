"""Static full-bounds reservation map and contact sheets from native screenshots."""
import json,math
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
root=Path(__file__).resolve().parent;q=root/'qa'
a=json.loads((root/'candidate-audit.json').read_text());r=json.loads((root/'reservations.json').read_text());base=json.loads((root/'baseline/decor-layout.json').read_text())
parts=['<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="860" viewBox="0 0 1600 860">','<rect width="1600" height="860" fill="#f2eedf"/>','<style>text{font-family:Arial,sans-serif;fill:#26382c}.caption{font-size:19px}.small{font-size:15px}</style>','<text x="30" y="32" font-size="24">Interior planting • full bounds and protected working areas</text>']
def poly(points,fill,stroke='none',opacity=1,sw=.1):
 return '<polygon points="'+ ' '.join(f'{x:.4f},{z:.4f}' for x,z in points)+f'" fill="{fill}" stroke="{stroke}" stroke-width="{sw}" opacity="{opacity}"/>'
def rect(x,z,w,d,fill,stroke='none',opacity=1,sw=.1):return f'<rect x="{x}" y="{z}" width="{w}" height="{d}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}" opacity="{opacity}"/>'
parts.append('<g transform="translate(560 425) scale(9.4)">')
parts.append(rect(-55,-37.5,110,75,'#d2e0af','#71835d'))
for b in r['soil']:parts.append(rect(b['x0'],b['z0'],b['x1']-b['x0'],b['z1']-b['z0'],'#b59b76'))
for p in r['ponds']:parts.append(f'<ellipse cx="{p["x"]}" cy="{p["z"]}" rx="{p["rx"]}" ry="{p["rz"]}" fill="#89babc"/>')
for p in r['roads']:parts.append('<polyline points="'+' '.join(f'{x},{z}' for x,z in p['points'])+f'" fill="none" stroke="#ddbf8b" stroke-width="{p["width"]}" stroke-linecap="round"/>')
for l in r['fences']:parts.append('<polyline points="'+' '.join(f'{x},{z}' for x,z in l)+'" fill="none" stroke="#8c8066" stroke-width=".12"/>')
for b in r['buildings']:parts.append(poly(b['footprint'],'#aaa995','#6d725e'))
for t in r['tasks']:
 x,z=t['workingPatch']['center'];w,d=t['workingPatch']['size'];parts.append(rect(x-w/2,z-d/2,w,d,'#e49676','#a94d31',.45))
for animal in r['roamingAnimals']:parts.append(f'<circle cx="{animal["p"][0]}" cy="{animal["p"][1]}" r="{animal["roam"]+animal["bodyRadius"]}" fill="#91a69a" opacity=".17"/>')
for item in a['added']:parts.append(poly(item['footprint'],{'flower-cluster':'#ba4b81','bush-lite':'#3c7854','crop-wheat':'#dfac28'}[item['model']]))
parts.append('</g>')
parts.extend(['<text x="30" y="812" class="caption">Pink: 64 flower groups • Green: 5 low shrubs • Gold: 26 field clumps</text>','<text x="30" y="838" class="small">Wider baseline roads retained as conservative reserves. Red: work pads. Grey circles: existing herd motion envelopes.</text>'])
parts.append('<text x="1130" y="72" class="caption">Field and tractor envelope</text><g transform="translate(1140 100) scale(37)">')
parts.append('<g transform="translate(-24 -21)">')
b=base['SOIL'][-1];parts.append(rect(b['x0'],b['z0'],b['x1']-b['x0'],b['z1']-b['z0'],'#d4bc96','#87725c',1,.025))
w,d=a['tractor']['size'][0],a['tractor']['size'][2];points=[]
for dt in [1/120,1/60,.05]:
 x,z,yaw=30,12,math.pi;t=dt;i=0
 while t<42:
  if t<4:x,z,yaw=30,12+t*2.6,math.pi
  else:
   ang=(t-4)*.35-math.pi/2;dx,dz=29+math.cos(ang)*4.2-x,26.5+math.sin(ang)*6-z
   if dx*dx+dz*dz>1e-4:yaw=math.atan2(-dx,-dz)
   x+=dx*min(1,dt*2);z+=dz*min(1,dt*2)
  if i%8==0 and z>19:
   c,s=math.cos(yaw),math.sin(yaw);vertices=[(x+u*c+v*s,z-u*s+v*c) for u,v in [(-w/2,-d/2),(w/2,-d/2),(w/2,d/2),(-w/2,d/2)]];parts.append(poly(vertices,'#627d8d',opacity=.045))
  t+=dt;i+=1
for item in a['added']:
 if item['model']=='crop-wheat':parts.append(poly(item['footprint'],'#e5b52d','#926f19',1,.02))
parts.append('</g></g>')
for i,text in enumerate(['26 clumps / 9 rows / scale 0.82','Full AABB area: 20.15 → 21.13 (+4.86%)','Field soil area: 95 map units²','Feasible centre region at scale 0.82: ~17.2','Tractor: full body at 3 dt values / 42 s','Motion reserve is intentionally left empty.','Areas are geometric estimates, not pixels.']):parts.append(f'<text x="1115" y="{610+i*27}" class="small">{text}</text>')
parts.append('</svg>');(q/'placement-plan.svg').write_text('\n'.join(parts))
font=ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf',18)
small=ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf',14)
def frame(file,width):
 im=Image.open(file).convert('RGB');return im.crop((0,47,width,47+({1180:660,1024:768,390:844}[width])))
areas=['wide','cowPen','poultry','westPens','horsePen','apiary','field']
for area in areas:
 paths=[q/f'{mode}-{area}-1180.jpg' for mode in ['before','after']]
 if not all(p.exists() for p in paths):continue
 canvas=Image.new('RGB',(1200,382),'#eee7db');d=ImageDraw.Draw(canvas)
 for j,(mode,p) in enumerate(zip(['Before','After'],paths)):
  im=frame(p,1180);im.thumbnail((590,330));canvas.paste(im,(j*600,34));d.text((j*600+10,8),f'{mode} · {area}',font=font,fill='#25372f')
 canvas.save(q/f'comparison-{area}.jpg',quality=90)
for width in [1180,1024,390]:
 reports=json.loads((q/f'audit-{width}.json').read_text());tasks=[x['area'] for x in reports if x['area'].startswith('task')]
 tw,th=(320,180) if width==1180 else (320,240) if width==1024 else (156,338);cols=4 if width>=1024 else 6;rows=math.ceil(len(tasks)/cols)
 sheet=Image.new('RGB',(cols*(tw+12),rows*(th+40)),'#eee7db');d=ImageDraw.Draw(sheet)
 for i,area in enumerate(tasks):
  p=q/f'after-{area}-{width}.jpg'
  if not p.exists():continue
  im=frame(p,width);im.thumbnail((tw,th));x=(i%cols)*(tw+12);y=(i//cols)*(th+40);sheet.paste(im,(x,y+25));d.text((x,y+4),area.removeprefix('task-'),font=small,fill='#25372f')
 sheet.save(q/f'contact-tasks-{width}.jpg',quality=90)
print('Reservation plan, paired scenic sheets and task contacts generated')
