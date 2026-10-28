"""Full-canvas LANCZOS + WebP90 only. Default checks reproducibility, --write creates derivatives."""
from pathlib import Path
from PIL import Image
from io import BytesIO
import argparse,hashlib,json
p=argparse.ArgumentParser();p.add_argument('--write',action='store_true');args=p.parse_args()
base=Path(__file__).resolve().parent;root=next(p for p in base.parents if (p/'package.json').is_file())
rows=[]
for kind,w in [('rack',1024)]:
 im=Image.open(base/(kind+'-source.png')).convert('RGBA');h=round(w*im.height/im.width);buf=BytesIO();im.resize((w,h),Image.Resampling.LANCZOS).save(buf,'WEBP',quality=90,alpha_quality=100,method=6);data=buf.getvalue();out=root/'public/textures/kit/factory'/'factory-rack-tall-a.webp'
 if args.write:out.write_bytes(data)
 assert out.read_bytes()==data,kind
 a=Image.open(out).getchannel('A');mask=a.point(lambda v:255 if v>=115 else 0);bbox=mask.getbbox();border=[max(a.crop(r).getextrema()) for r in [(0,0,w,1),(w-1,0,w,h),(0,h-1,w,h),(0,0,1,h)]]
 rows.append(dict(kind=kind,size=[w,h],bytes=len(data),sha256=hashlib.sha256(data).hexdigest(),sourceSha256=hashlib.sha256((base/(kind+'-source.png')).read_bytes()).hexdigest(),bboxAlpha115=bbox,borderMaxAlpha=border))
print(json.dumps(rows,indent=2))
