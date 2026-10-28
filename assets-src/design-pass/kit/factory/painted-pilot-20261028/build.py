"""Rebuild only by full-canvas resize and WebP encoding; default verifies saved bytes."""
from pathlib import Path
from io import BytesIO
from PIL import Image
import argparse, hashlib, json
parser=argparse.ArgumentParser()
parser.add_argument('--write',action='store_true',help='Write the two local/public derivatives; never edits source PNGs')
args=parser.parse_args()
base=Path(__file__).resolve().parent
root=next(p for p in base.parents if (p/'package.json').is_file())
result=[]
for kind,source,local,name,size in [('lever','lever-attempt3.png','lever-body-a.webp','factory-lever-body-a',(1024,683)),('dial','dial-attempt3.png','speed-dial-a.webp','factory-speed-dial-a',(512,512))]:
    im=Image.open(base/kind/source).convert('RGBA')
    output=BytesIO()
    im.resize(size,Image.Resampling.LANCZOS).save(output,'WEBP',quality=90,alpha_quality=100,method=6)
    data=output.getvalue()
    paths=[base/kind/local,root/'public/textures/kit/factory'/f'{name}.webp']
    if args.write:
        for path in paths: path.write_bytes(data)
    assert all(path.read_bytes()==data for path in paths),name
    result.append({'asset':name,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest(),'matchesSaved':True})
print(json.dumps(result,indent=2))
