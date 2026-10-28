import * as T from 'three';
import {key,edgeMap,topology,matrix,inverse} from './source.mjs';
export function snap(p){return new T.Vector3(...p).applyMatrix4(inverse).toArray().map(v=>Math.max(-32767,Math.min(32767,Math.round(v*32767)))/32767).map((v,i)=>v*.5+[matrix.elements[12],matrix.elements[13],matrix.elements[14]][i]);}
export function triangle(v,extra={}){return {v,...extra};}
export function area3(t){return new T.Vector3(...t.v[1].p).sub(new T.Vector3(...t.v[0].p)).cross(new T.Vector3(...t.v[2].p).sub(new T.Vector3(...t.v[0].p))).length()/2;}
export function normal(t){return new T.Vector3(...t.v[1].p).sub(new T.Vector3(...t.v[0].p)).cross(new T.Vector3(...t.v[2].p).sub(new T.Vector3(...t.v[0].p))).normalize().toArray();}
function interpolate(a,b,t){return {p:snap(a.p.map((v,k)=>v+(b.p[k]-v)*t)),n:new T.Vector3(...a.n.map((v,k)=>v+(b.n[k]-v)*t)).normalize().toArray(),uv:a.uv.map((v,k)=>v+(b.uv[k]-v)*t),original:null};}
export function clipAxial(tris,sign,plane){const out=[];for(const tri of tris){const poly=[];for(let j=0;j<3;j++){const a=tri.v[j],b=tri.v[(j+1)%3],da=sign*a.p[0]-plane,db=sign*b.p[0]-plane;if(da>=-1e-10)poly.push(a);if((da>=-1e-10)!==(db>=-1e-10))poly.push(interpolate(a,b,da/(da-db)));}const clean=poly.filter((v,i)=>key(v.p)!==key(poly[(i+poly.length-1)%poly.length].p));for(let j=1;j<clean.length-1;j++){const t=triangle([clean[0],clean[j],clean[j+1]],{source:tri.source,clipped:clean.length!==3||clean.some(v=>v.original===null)});if(new Set(t.v.map(v=>key(v.p))).size===3&&area3(t)>1e-14)out.push(t);}}return out;}
export function boundaryLoops(tris){const open=[...edgeMap(tris).values()].filter(e=>e.length===1).map(e=>e[0]),next=new Map();for(const e of open){if(next.has(e.a))throw Error('Branched outgoing boundary '+e.a);next.set(e.a,e);}const seen=new Set(),loops=[];for(const edge of open){if(seen.has(edge.a))continue;const loop=[];let e=edge;do{if(!e||seen.has(e.a))throw Error('Open or joined loop');seen.add(e.a);loop.push(e.va);e=next.get(e.b);}while(e.a!==edge.a);loops.push(loop);}return loops;}
export function polygonArea(ps){return ps.reduce((a,p,i)=>{const q=ps[(i+1)%ps.length];return a+p[0]*q[1]-q[0]*p[1]},0)/2;}
export function inside(p,poly){let yes=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if(((a[1]>p[1])!==(b[1]>p[1]))&&(p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0]))yes=!yes;}return yes;}
function capTriangles(contour,holes,axes,desiredNormal,uv){const all=[...contour,...holes.flat()],poly=contour.map(v=>new T.Vector2(v.p[axes[0]],v.p[axes[1]])),holePoly=holes.map(l=>l.map(v=>new T.Vector2(v.p[axes[0]],v.p[axes[1]])));const indices=T.ShapeUtils.triangulateShape(poly,holePoly),target=new T.Vector3(...desiredNormal),result=[];for(const idx of indices){let vs=idx.map(i=>all[i]);let t=triangle(vs);if(new T.Vector3(...normal(t)).dot(target)<0)vs=[vs[0],vs[2],vs[1]];t=triangle(vs);const n=normal(t);result.push(triangle(vs.map(v=>({p:v.p,n,uv,original:null})),{source:null,reconstructed:true}));}
const area=Math.abs(polygonArea(contour.map(v=>[v.p[axes[0]],v.p[axes[1]]])))-holes.reduce((s,l)=>s+Math.abs(polygonArea(l.map(v=>[v.p[axes[0]],v.p[axes[1]]]))),0),sum=result.reduce((s,t)=>s+Math.abs(polygonArea(t.v.map(v=>[v.p[axes[0]],v.p[axes[1]]]))),0);if(Math.abs(area-sum)>1e-9)throw Error('Cap area mismatch '+area+' vs '+sum);return {triangles:result,expectedArea:area,area:sum};}
export function closeAxial(tris,sign,uvDark,uvHub){const loops=boundaryLoops(tris),poly=loops.map(l=>l.map(v=>[v.p[1],v.p[2]])),depth=poly.map((p,i)=>poly.filter((q,j)=>i!==j&&Math.abs(polygonArea(q))>Math.abs(polygonArea(p))&&inside(p[0],q)).length),caps=[],reports=[];for(let i=0;i<loops.length;i++){if(depth[i]%2)continue;const holes=loops.filter((l,j)=>depth[j]===depth[i]+1&&inside(poly[j][0],poly[i]));const cap=capTriangles(loops[i],holes,[1,2],[-sign,0,0],Math.abs(polygonArea(poly[i]))>.005?uvDark:uvHub);caps.push(...cap.triangles);reports.push({outerVertices:loops[i].length,holeVertices:holes.map(l=>l.length),area:cap.area,triangles:cap.triangles.length});}const result=[...tris,...caps];if(topology(result).openEdges||topology(result).sameDirectionEdges)throw Error('Axial cap not closed/oriented '+JSON.stringify(topology(result)));return {triangles:result,caps,reports};}
// The rear body holes bend around supports; triangulate a 3D patch rather than
// projecting a self-overlapping loop onto an arbitrary plane. Independent surface
// intersection checks are required before this experimental patch can pass.
export function closeBody(tris,uv){
  const loops=boundaryLoops(tris),caps=[],reports=[],existing=edgeMap(tris);
  const permitted=(a,b)=>{const e=existing.get([key(a.p),key(b.p)].sort().join('|'));return !e||e.length===1};
  for(const loop of loops){
    const l=[...loop].reverse(),n=l.length,dp=Array.from({length:n},()=>Array(n).fill(Infinity)),split=Array.from({length:n},()=>Array(n).fill(-1));
    for(let i=0;i<n-1;i++)dp[i][i+1]=0;
    for(let span=2;span<n;span++)for(let i=0;i+span<n;i++){
      const j=i+span;
      for(let k=i+1;k<j;k++){
        if(!permitted(l[i],l[k])||!permitted(l[k],l[j])||!permitted(l[j],l[i]))continue;
        const a=area3(triangle([l[i],l[k],l[j]]));if(a<1e-13)continue;
        const cost=dp[i][k]+dp[k][j]+a;
        if(cost<dp[i][j]){dp[i][j]=cost;split[i][j]=k;}
      }
    }
    const added=[];
    function emit(i,j){if(j-i<2)return;const k=split[i][j];if(k<0)throw Error('No 3D cap triangulation');const vs=[l[i],l[k],l[j]],nt=normal(triangle(vs));added.push(triangle(vs.map(v=>({p:v.p,n:nt,uv,original:null})),{source:null,reconstructed:true}));emit(i,k);emit(k,j);}
    emit(0,n-1);caps.push(...added);reports.push({method:'minimum-area 3D boundary triangulation; no planar projection assumption',vertices:n,area:added.reduce((s,t)=>s+area3(t),0),triangles:added.length,bounds:{min:[0,1,2].map(k=>Math.min(...l.map(v=>v.p[k]))),max:[0,1,2].map(k=>Math.max(...l.map(v=>v.p[k])))}});
  }
  const result=[...tris,...caps];if(topology(result).openEdges||topology(result).sameDirectionEdges)throw Error('Body cap not closed/oriented '+JSON.stringify(topology(result)));return{triangles:result,caps,reports};
}
