"""Read-only delivery reconciliation. Writes only this audit directory; no game execution."""
from pathlib import Path
from collections import Counter
from datetime import datetime,timezone
import hashlib,json,re,struct,subprocess,sys

OUT=Path(__file__).resolve().parent;ROOT=OUT.parents[1]
def git(*args):return subprocess.check_output(['git',*args],cwd=ROOT)
REV=sys.argv[1] if len(sys.argv)>1 else git('rev-parse','HEAD').decode().strip()
def sha(b):return hashlib.sha256(b).hexdigest()
def committed(p):return git('show',REV+':'+p)
source_paths=['src/farm.ts','src/city.ts','src/farm-decor.ts','src/city-decor.ts','src/decor.ts','src/rig.ts','src/storymap.ts','src/life.ts','src/pest.ts','src/parts/assets.ts','src/parts/city.ts','src/parts/catalog.ts','src/main.ts']
S={p:committed(p).decode() for p in source_paths}
provenance={p:{'sha256':sha(s.encode()),'workingTreeMatchesCommit':sha((ROOT/p).read_bytes())==sha(s.encode())} for p,s in S.items()}
def cite(p,needle):
 s=S.get(p) or (ROOT/p).read_text();at=s.index(needle)
 return {'path':p,'line':s.count('\n',0,at)+1,'excerpt':s[at:s.find('\n',at) if '\n' in s[at:] else len(s)][:300]}
chat=(ROOT/'coordination/CHAT.md').read_text();messages={}
def msg(mid):
 m=re.search(r'^### '+mid+r'\b.*?(?=^### m|\Z)',chat,re.M|re.S)
 assert m,mid
 if mid not in messages:
  messages[mid]={'path':'coordination/CHAT.md','line':chat.count('\n',0,m.start())+1,'header':m.group().splitlines()[0],'text':m.group().strip()}
 return mid
# Parse bounded literal array declarations; do not import or execute the game.
def array_at(text,start):
 assert text[start]=='['
 depth=0;quote=None;escaped=False;count=0
 for i in range(start,len(text)):
  c=text[i]
  if quote:
   if escaped:escaped=False
   elif c==chr(92):escaped=True
   elif c==quote:quote=None
   continue
  if c in ['"',"'"]:quote=c;continue
  if c=='[':
   depth+=1
   if depth==2:count+=1
  elif c==']':
   depth-=1
   if depth==0:return text[start:i+1],count
 raise ValueError('Unclosed array')
parsed={}
for path,text in S.items():
 text=re.sub(r'//[^\n]*',lambda m:' '*len(m.group()),text)
 result={}
 for name in ['FARM_MODELS','CITY_MODELS','MODEL_NAMES','DECOR']:
  m=re.search(r'export const '+name+r'\b[^=]*=\s*(\[)',text)
  if not m:continue
  array,_=array_at(text,m.start(1))
  if name=='DECOR':
   entries=[]
   for model in re.finditer(r'model:\s*[\"\']([^\"\']+)[\"\']',array):
    item=re.search(r'items:\s*(\[)',array[model.end():]);assert item
    _,count=array_at(array,model.end()+item.start(1))
    entries.append({'model':model.group(1),'count':count,'line':text.count('\n',0,m.start(1)+model.start())+1})
   result[name]=entries
  else:
   prefix=array.split('...DECOR.map')[0]
   prefix=re.sub(r'//[^\n]*','',prefix)
   result[name]=re.findall(r"['\"]([^'\"]+)['\"]",prefix)
 if result:parsed[path]=result

groups={k:parsed['src/'+k+'-decor.ts']['DECOR'] for k in ['farm','city']}
preloads={k:sorted(set(parsed['src/'+k+'.ts'][k.upper()+'_MODELS']+[g['model'] for g in groups[k]])) for k in ['farm','city']}
preloads['workbench']=parsed['src/parts/catalog.ts']['MODEL_NAMES']
public_names={Path(x).stem for x in git('ls-tree','--name-only',REV,'public/models/').decode().splitlines() if x.endswith('.glb')}
inventory={}
for name in sorted(set(sum(preloads.values(),[]))|{'firefighter','shopkeeper'}):
 p='public/models/'+name+'.glb'
 if name not in public_names:inventory[name]={'path':p,'exists':False};continue
 b=committed(p);assert b[:4]==b'glTF' and struct.unpack_from('<I',b,4)[0]==2
 n,t=struct.unpack_from('<II',b,12);assert t==0x4e4f534a
 d=json.loads(b[20:20+n]);tri=0
 for m in d.get('meshes',[]):
  for a in m['primitives']:
   if a.get('mode',4)==4:tri+=d['accessors'][a['indices'] if 'indices' in a else a['attributes']['POSITION']]['count']//3
 inventory[name]={'path':p,'exists':True,'bytes':len(b),'sha256':sha(b),'triangles':tri,'skins':len(d.get('skins',[])),'animations':[a.get('name','') for a in d.get('animations',[])],'workingTreeMatchesCommit':sha((ROOT/p).read_bytes())==sha(b)}
rows=[]
def add(id,label,models,status,mids,uses,remaining='',documents=None):
 rows.append({'id':id,'requirement':label,'agreement':[msg(m) for m in mids],'models':models,'deliveryStatus':status,'useEvidence':uses,'remaining':remaining,'documents':documents or []})
for name,mids in [('bakery',['m0103','m0107']),('grandma-house',['m0195','m0204','m0207']),('school',['m0195','m0214','m0217']),('club',['m0217','m0220']),('toy-shop',['m0223','m0226']),('fire-station',['m0229','m0234']),('house-a',['m0249','m0251']),('house-b',['m0255','m0259','m0262']),('house-c',['m0262','m0263','m0268'])]:
 gs=[x for x in groups['city'] if x['model']==name]
 add(name,'Город: '+name,[name],'delivered-configured',mids,[{'path':'src/city-decor.ts','line':g['line'],'instances':g['count']} for g in gs]+[cite('src/city.ts','...DECOR.map')],documents=[f'assets-src/city-v2/{name}-3d/README.md'] if name!='bakery' else ['assets-src/city-v1/README.md'])
 if name=='house-a':rows[-1]['useEvidence'].append(cite('src/city.ts',"this.add('house-a'"));rows[-1]['note']='4 экземпляра DECOR + отдельный горящий дом задания; старое «4 дома» не весь runtime.'
for name in ['baker','tram','car']:
 add(name,'Город: '+name,[name],'delivered-configured',['m0103','m0107' if name=='baker' else 'm0110'],[cite('src/city.ts',"this.critter('"+name+"'" if name!='car' else "['car', 'car2', 'car3']")],documents=['assets-src/city-v1/README.md'])
add('grandma','Статичная бабушка на балконе',['grandma'],'delivered-scope-revised',['m0109','m0111'],[cite('src/city.ts',"this.critter('grandma'"),cite('src/city.ts','grandma.base = BALCONY_TOP')],documents=['assets-src/city-v1/README.md'])
for name in ['cow','horse','pig','goat','dog']:
 add(name+'-rig','Ферма: реакции головы/хвоста '+name,[name+'-rig'],'delivered-configured',['m0181','m0189','m0191'],[cite('src/farm.ts','const rigged ='),cite('src/rig.ts','  '+name+':')],documents=['assets-src/farm-v3/hero-rigs/README.md'])
add('sheep-rig','Овца: кандидат rig отклонён',['sheep'],'accepted-static-alternative',['m0187','m0189','m0191'],[cite('src/farm.ts',"'sheep'"),cite('src/rig.ts','export const RIGS'),cite('src/storymap.ts','const pose = !rig')],documents=['assets-src/farm-v3/hero-rigs/sheep.md'])
candidate='assets-src/farm-v3/hero-rigs/candidates/sheep-rig.glb';b=committed(candidate);rows[-1]['rejectedCandidate']={'path':candidate,'bytes':len(b),'sha256':sha(b),'publicExists':'sheep-rig' in public_names,'reason':'Нет отдельной кости хвоста; m0189 оставляет static + bend.ts. Новый rig не требуется.'}
for name in ['frog','crow']:
 add(name,'Игрушка у пруда: '+name,[name],'delivered-configured',['m0257','m0359'],[cite('src/farm.ts',"frog: () => model('frog'" )] if name=='frog' else [cite('src/pest.ts',"model('crow'")],documents=['assets-src/farm-v3/pond-animals/native-review-2/README.md'])
for name,mids in [('hay-bale',['m0306','m0336','m0341']),('pond-dock',['m0306','m0334','m0339']),('pond-reeds',['m0306','m0334','m0346']),('farm-crate',['m0306','m0344','m0346']),('farm-barrel',['m0306','m0344','m0346'])]:
 uses=[{'path':'src/farm-decor.ts','line':g['line'],'instances':g['count']} for g in groups['farm'] if g['model']==name]
 if name=='hay-bale':uses.append(cite('src/farm.ts',"mouse: () => model('hay-bale'"))
 add(name,'Ферма: '+name,[name],'delivered-configured',mids,uses)
add('reuse','Переиспользование кошки, пожарной машины и щенка',['kitten','firetruck','dog','dog-rig'],'accepted-reuse',['m0036','m0101','m0191'],[cite('src/city.ts',"{ cat: 'kitten' }"),cite('src/parts/catalog.ts','export const MODEL_NAMES'),cite('src/farm.ts',"{ puppy: 'dog' }")],remaining='Отдельные cat/puppy GLB не требуются.')
for name in ['child','firefighter','shopkeeper','builder','boat']:
 uses=[cite('src/city.ts','  '+name+': () =>')]
 add(name,'Город: '+name,[name],'open-earlier-model-plan',['m0105','m0135'] if name=='child' else ['m0135'],uses,'GLB не поставлен; в игре кодовая фигурка. Подтвердить включение в следующую художественную пачку, затем модель и интеграция.')
 if name in ['firefighter','shopkeeper']:rows[-1]['remaining']+=' Имя также отсутствует в CITY_MODELS: при будущей поставке понадобится добавить preload.'
add('child-walk','Ходьба детей',['child'],'open-earlier-animation-plan',['m0103','m0105','m0135'],[cite('src/city.ts','private updateSchool')],remaining='Согласованный общий humanoid walk не поставлен; имя GLB со скелетом/формат клипа ещё не закреплены. Требование бабушки отменено отдельно m0109.')
for name in ['raccoon','raccoon-rig','pigeon','fountain-basin','street-lamp']:
 uses=[cite('src/city.ts','export const CITY_MODELS')]
 if name.startswith('raccoon'):uses += [cite('src/city.ts',"base === 'raccoon'"),cite('src/city.ts',"const walk = clipsOf('raccoon-rig')")]
 if name=='pigeon':uses += [cite('src/city.ts',"this.critter('pigeon'"),cite('src/city.ts','?? blob(name)'),cite('src/storymap.ts','export function blob')]
 if name=='fountain-basin':uses += [cite('src/city.ts',"this.add('fountain-basin'"),cite('src/city.ts','function basin()')]
 note={'raccoon':'Статичная модель отсутствует; сейчас generic blob.', 'raccoon-rig':'Скелет/клип ходьбы отсутствуют; условный AnimationMixer не включается без файла.', 'pigeon':'GLB отсутствует; отдельного STAND_INS.pigeon нет, используется generic blob.', 'fountain-basin':'GLB отсутствует; чаша и вода рисуются basin().', 'street-lamp':'Есть только имя в preload; отдельного размещения модели не найдено. Рабочий DuskLamp — другое устройство.'}[name]
 add(name,'Ранний город: '+name,[name],'open-earlier-model-plan',['m0103'],uses,note+' Позднего явного закрытия требования в просмотренных решениях нет; согласовать актуальность до новых заказов.')
for name in ['counter','hydrant','basket']:
 add(name,'Город, низкий приоритет: '+name,[name],'open-low-priority-model-plan',['m0109'],[cite('src/city.ts',"this.add('"+name+"'"),cite('src/city.ts','function '+name+'()')],'GLB отсутствует, функция рисует рабочий предмет кодом. В m0109 назван низкий приоритет; нового заказа эта сверка не разрешает.')
for name in ['bins','bench']:
 uses=[cite('src/city.ts',"this.add('bins'"),cite('src/city.ts','function bins()')] if name=='bins' else [cite('src/city-decor.ts',"model: 'bench'"),cite('src/decor.ts','if (!src) return null'),cite('src/city.ts','const look = HOUSES[g.model]')]
 add(name,'Допустимая кодовая замена: '+name,[name],'code-alternative-allowed' if name=='bins' else 'placement-gap-no-glb-order-implied',['m0101','m0103'],uses,'GLB не обязателен по разрешению m0101.' if name=='bins' else 'Два места bench в DECOR, GLB нет, dressing пропускает группу; отдельного кодового fallback нет. Решить: реализовать разрешённую кодовую скамейку или явно убрать эти места. Не считать обязательным платным GLB.')
for name,cls in [('barrier','Barrier'),('ferris','FerrisWheel'),('carWash','CarWash'),('drawbridge','Drawbridge'),('towerCrane','TowerCrane'),('duskLamp','DuskLamp'),('neon','NeonSign'),('ladder','FireLadder')]:
 add('device-'+name,'Городское устройство: '+name,[],'open-earlier-body-model-plan',['m0135'],[cite('src/parts/city.ts','export class '+cls+' ')],'Механика и геометрия реализованы кодом. Из m0135 не поставлена художественная модель корпуса/отдельных подвижных узлов; имя GLB и контракт деталей не закреплены. Уточнить актуальность этого старого приоритета, не считать устройство отсутствующим.')
add('concept-only','Телега/тачка и другая мелочь из концептов',[],'concept-not-a-confirmed-glb-order',['m0058','m0109','m0265','m0306'],[],'Старые художественные ориентиры не являются отдельным утверждённым перечнем заказов. Поздний конкретный набор m0306 (тюк/ящики/бочки/мостки/камыш/камни) закрыт; универсальная полнота всего рисунка не заявляется.')
# Corroborating preload inventory is not treated as a requirements list.
resolved={k:{'names':ns,'present':[n for n in ns if inventory[n]['exists']],'missing':[n for n in ns if not inventory[n]['exists']]} for k,ns in preloads.items()}
assert not resolved['farm']['missing']
assert not resolved['workbench']['missing']
assert all(inventory[n]['exists'] for r in rows if r['deliveryStatus'].startswith('delivered') for n in r['models'])
assert all(not inventory[n]['exists'] for r in rows if r['deliveryStatus'].startswith('open-') for n in r['models'])
assert all(x.get('workingTreeMatchesCommit',True) for x in inventory.values())
for r in rows:
 for doc in r['documents']:
  assert (ROOT/doc).is_file(),doc
  provenance[doc]={'sha256':sha((ROOT/doc).read_bytes())}
 # Embed hashes of specific contracts/release records alongside requirement evidence.
 for n in r['models']:
  for p in [f'assets-src/city-v2/{n}-contract.json',f'assets-src/city-v2/{n}-3d/release.json']:
   if (ROOT/p).exists() and p not in provenance:provenance[p]={'sha256':sha((ROOT/p).read_bytes())}
result={'date':'2026-10-26','timezone':'Asia/Bangkok','capturedAtUTC':datetime.now(timezone.utc).isoformat(),'revision':REV,'scope':'Поставка согласованных поздних зданий города, прудовых животных, пяти farm rigs, отклонённой овцы и props; сверка ранних городских списков m0103/m0109/m0135. Полного единого утверждённого перечня всех моделей проекта нет. Текстуры/материалы исключены.','method':'Статическое чтение закреплённых исходников, чтение ограниченных литеральных массивов preload/DECOR, GLB JSON headers + SHA-256. Без загрузки сцены, браузера, визуальной перепроверки, игровых тестов и генераций. Наличие + ссылка в коде означает configured use, не новый runtime-тест.','sources':provenance,'coordinationSnapshot':{'path':'coordination/CHAT.md','sha256':sha(chat.encode()),'latestMessageAtCapture':re.findall(r'^### (m\d+)',chat,re.M)[-1],'messages':messages},'preloadWiring':[cite('src/main.ts','models: FARM_MODELS'),cite('src/main.ts','models: CITY_MODELS'),cite('src/main.ts','loadModels(def.models)'),cite('src/parts/assets.ts','async function fileBytes')],'preloads':resolved,'decorGroups':groups,'models':inventory,'requirements':rows,'counts':dict(Counter(r['deliveryStatus'] for r in rows)),'conclusion':'Поздние конкретные поставки готовы и подключены. Безоговорочное «все требуемые модели сделаны» не подтверждено: в прежних городских списках остаются непоставленные персонажи/лодка/декор и корпуса устройств. Большинство заменено рабочим кодом; bench имеет отдельный пропуск размещения. До новых заказов требуется актуализировать именно этот остаток, не переделывать принятые модели.'}
if re.search(r'^### m0361\b',chat,re.M):
 result['ongoingParallelWork']={'agreement':msg('m0361'),'status':'Main возобновил child: только Image-референс и контракт на 7 экземпляров; GLB не поставлен, платный заказ не запущен. Аудит эту работу не дублирует.'}
(OUT/'audit.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'revision':REV,'counts':result['counts'],'missingFarm':resolved['farm']['missing'],'missingCity':resolved['city']['missing'],'missingWorkbench':resolved['workbench']['missing'],'rows':len(rows)},ensure_ascii=False,indent=2))
