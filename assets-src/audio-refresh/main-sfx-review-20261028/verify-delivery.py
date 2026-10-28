import json, hashlib, subprocess, collections, concurrent.futures, datetime
from pathlib import Path
root=Path('/Users/gusev/gameios')
p=root/'assets-src/audio-refresh/research/sfx-animals'
sha=lambda q:hashlib.sha256(q.read_bytes()).hexdigest()
m=json.loads((p/'animal-sfx-manifest.json').read_text())
sel=json.loads((p/'selections.json').read_text())
deliv=json.loads((p/'delivery.json').read_text())
ledger=json.loads((p/'ledger.json').read_text())
qa=json.loads((p/'technical-qa.json').read_text())
issues=[]
def check_file(c):
 f=p/c['file']; d={'id':c.get('id',c['file']),'file':c['file'],'exists':f.is_file()}
 if not f.is_file(): return d
 d.update(bytes=f.stat().st_size,sha256=sha(f),hashMatches=sha(f)==c['sha256'])
 return d
raw=[check_file(c) for c in m['candidates']]
def check_clip(c):
 d=check_file(c)
 if not d['exists']: return d
 f=p/c['file']
 r=subprocess.run(['/opt/homebrew/bin/ffprobe','-v','error','-show_entries','stream=codec_name,sample_rate,channels,bit_rate','-of','json',str(f)],capture_output=True,text=True)
 d['streams']=json.loads(r.stdout).get('streams',[]) if r.returncode==0 else []
 r=subprocess.run(['/opt/homebrew/bin/ffmpeg','-nostdin','-v','error','-i',str(f),'-f','null','-'],capture_output=True,text=True)
 d['decodes']=r.returncode==0 and not r.stderr.strip()
 d['decodeError']=r.stderr.strip()
 d['formatPass']=len(d['streams'])==1 and d['streams'][0].get('codec_name')=='mp3' and d['streams'][0].get('sample_rate')=='24000' and d['streams'][0].get('channels')==1 and d['streams'][0].get('bit_rate')=='64000'
 d['sourceHashMatches']=sha(p/c['sourceFile'])==c['sourceSha256']
 return d
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as ex: clips=list(ex.map(check_clip,m['clips']))
for d in raw+clips:
 if not d.get('exists') or not d.get('hashMatches'): issues.append({'file':d['file'],'problem':'missing-or-hash'})
for d in clips:
 if not all(d.get(k) for k in ['decodes','formatPass','sourceHashMatches']): issues.append({'file':d['file'],'problem':'decode-format-or-source'})
selected=[c['id'] for c in m['clips'] if c.get('ownerSelected') and c.get('listeningQA')=='owner-approved']
if set(selected)!=set(sel['selected']): issues.append({'problem':'selection-mismatch'})
zip_ok=sha(Path(deliv['file']))==deliv['sha256']
if not zip_ok: issues.append({'problem':'zip-hash'})
public=json.loads((root/'public/sfx/sfx.json').read_text())
pub_checks={i:sha(root/'public/sfx'/f'{i}.mp3')==next(c['sha256'] for c in m['clips'] if c['id']==i) for i in selected}
report={'createdAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'status':'technical-delivery-verified-awaiting-owner-listening','manifest':'research/sfx-animals/animal-sfx-manifest.json','manifestSha256':sha(p/'animal-sfx-manifest.json'),'selectionSha256':sha(p/'selections.json'),'readyFiles':len(clips),'families':len({c['family'] for c in m['clips']}),'readyBytes':sum(c.get('bytes',0) for c in clips),'rawFiles':len(raw),'uniqueReadyHashes':len({c.get('sha256') for c in clips}),'uniqueRawHashes':len({c.get('sha256') for c in raw}),'allFilesHashAndDecodeAndFormatPassed':not issues,'zipHashMatches':zip_ok,'ownerSelected':selected,'pendingListening':sum(c.get('listeningQA')=='pending' for c in m['clips']),'listeningStates':dict(collections.Counter(c.get('listeningQA') for c in m['clips'])),'notSelected':len(clips)-len(selected),'allIntroDisabled':all(not c.get('introEligible') for c in m['clips']),'workerReportedDurationSeconds':qa['totalDuration'],'workerReportedDurationRange':qa['durationRange'],'workerReportedMaxTruePeakDb':qa['maximumTruePeakDb'],'workerDurationAdvisories':qa['durationAdvisories'],'budgetAccountingReported':{k:ledger.get(k) for k in ['initialBalance','balanceAfter','spentCredits','reservedCredits','remainingCredits','remainingCreditsConservative']},'selectedPublicHashes':pub_checks,'runtimeMap':public,'issues':issues,'mainScope':'Independent read-only SHA checks of88 raw and61 ready; decoded all61 and ffprobe MP3/mono24k/64kbps. No generation, no source or runtime edits. No new listening approval; loudness/duration values are worker measurements, not repeated by main. No iPad or runtime mix acceptance.','rawChecks':raw,'clipChecks':clips}
Path('/tmp/codex-sfx-delivery-review.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({k:v for k,v in report.items() if k not in ['rawChecks','clipChecks','workerDurationAdvisories']},ensure_ascii=False,indent=2))
