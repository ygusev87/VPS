from pathlib import Path
import json, html

root = Path(__file__).resolve().parent
data = json.loads((root / 'layout-proposal.json').read_text())
zones = [
    ('Дом', -38.5, -25.5, 11, 9, '#eed6bd'), ('Амбар', -14.3, -24.75, 14, 10, '#eabeb7'),
    ('Силос', -3.3, -27.75, 5, 5, '#e5dbca'), ('Курятник', 7.7, -21, 8, 7, '#f4dfae'),
    ('Свинарник', 26.4, -22.5, 10, 6, '#e6cfb5'), ('Холм / овцы', 43, -28, 17, 12, '#bddb9d'),
    ('Будка', -34, -13, 8, 7, '#ead8bc'), ('Кролики', -43, -11, 8, 7, '#ead8bc'),
    ('Щенок', -23, -9, 8, 10, '#f3e5c5'), ('Козлята', -18, 2, 14, 11, '#d4e3ad'),
    ('Пруд', -40, 4, 18, 14, '#b9dce3'), ('Коровы', 13, 1, 26, 16, '#c6dfa8'),
    ('Конюшня', 41, -3, 12, 9, '#e9c9b5'), ('Лошади', 41, 9, 16, 10, '#dfd9b3'),
    ('Сад', -41, 24, 16, 20, '#c6d6ab'), ('Пасека', -20, 24, 14, 12, '#dfd7b1'),
    ('Цветные грядки', 4, 25, 28, 17, '#d1c9de'), ('Пшеница', 29, 26, 12, 18, '#f0d68d'),
    ('Навес', 44, 27, 14, 10, '#e9ceb3'),
]
data['zoneFootprints'] = [{'name': n, 'center': [x,z], 'size': [w,h]} for n,x,z,w,h,_ in zones]
for t in data['tasks']:
    x,z=t['workingPatch']['center']
    t.pop('imageRegionHint',None)
    t['gridCell']=chr(65+min(9,int((x+55)/11)))+str(1+min(9,int((z+37.5)/7.5)))
(root/'layout-proposal.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
X=lambda x:50+(x+55)*10
Y=lambda z:70+(z+37.5)*10
s=['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 870" role="img" aria-label="Точный координатный черновик фермы 110 на 75">',
   '<rect width="1200" height="870" fill="#fbf8ef"/><g font-family="system-ui,sans-serif" fill="#233a41">',
   '<text x="50" y="25" font-size="19" font-weight="700">Ферма 110 × 75 · координатное предложение · не игровая графика</text>',
   '<rect x="50" y="70" width="1100" height="750" fill="#edf0de" stroke="#70837d"/>']
for n,x,z,w,h,color in zones:
    s.append(f'<rect x="{X(x-w/2):.1f}" y="{Y(z-h/2):.1f}" width="{w*10}" height="{h*10}" rx="8" fill="{color}" stroke="#829182" stroke-dasharray="4 3"/>')
    s.append(f'<text x="{X(x):.1f}" y="{Y(z-h/2)+17:.1f}" font-size="12" text-anchor="middle">{html.escape(n)}</text>')
for i in range(11):
    x=50+i*110;y=70+i*75
    s.append(f'<path d="M{x} 70V820 M50 {y}H1150" stroke="#566c7e" stroke-opacity=".3" fill="none"/>')
for i in range(10):
    s.append(f'<text x="{105+i*110}" y="58" text-anchor="middle" font-size="17">{chr(65+i)}</text>')
    s.append(f'<text x="32" y="{113+i*75}" text-anchor="middle" font-size="17">{i+1}</text>')
for t in data['tasks']:
    x,z=t['workingPatch']['center'];px,pz=t['pole'];n=t['number']
    s.append(f'<path d="M{X(x)} {Y(z)}L{X(px)} {Y(pz)}" stroke="#167c85" stroke-width="2" stroke-dasharray="3 3"/>')
    s.append(f'<rect x="{X(x)-20}" y="{Y(z)-20}" width="40" height="40" rx="3" fill="#fffdf4" stroke="#167c85" stroke-width="2"/>')
    s.append(f'<text x="{X(x)}" y="{Y(z)+6}" text-anchor="middle" font-size="17" font-weight="700">{n}</text>')
    s.append(f'<circle cx="{X(px)}" cy="{Y(pz)}" r="5" fill="#167c85"/>')
s.append('<text x="50" y="849" font-size="14">Квадрат = пятачок 4 × 4; точка = столб, расстояние 4–6. Дорожки и заборы согласуются на следующем шаге.</text></g></svg>')
(root/'layout-technical.svg').write_text('\n'.join(s)+'\n')
