import * as A from './astronomy-engine-2.1.19.js';
import { STAR_CATALOG } from './garage-star-catalog-v1.js';

export { STAR_CATALOG };
export const STAR_FIGURES = [
  {name:'Big Dipper',paths:[[54061,53910,58001,59774,54061],[59774,62956,65378,67301]]},
  {name:'Cassiopeia',paths:[[746,3179,4427,6686,8886]]},
  {name:'Orion',paths:[[27989,26207,25336,25930,24436,27366,26727,27989],[25930,26311,26727]]},
  {name:'Cygnus',paths:[[102098,100453,95947],[97165,100453,102488]]}
];
const RAD=Math.PI/180;
const vectors=STAR_CATALOG.map(([, ,ra,dec])=>{
  const r=ra*15*RAD,d=dec*RAD;
  return [Math.cos(d)*Math.cos(r),Math.cos(d)*Math.sin(r),Math.sin(d)];
});
const index=new Map(STAR_CATALOG.map((s,i)=>[s[0],i]));
export const STAR_EDGES=STAR_FIGURES.flatMap(f=>f.paths.flatMap(p=>p.slice(1).map((id,i)=>[index.get(p[i]),index.get(id)])));

// Geometric horizon, including precession/nutation. Proper motion/refraction
// are intentionally omitted for this small decorative naked-eye chart.
export function starPositions(now,latitude,longitude) {
  if(!Number.isFinite(now)||Math.abs(now)>8e15||!Number.isFinite(latitude)||Math.abs(latitude)>90||!Number.isFinite(longitude)||Math.abs(longitude)>180)return null;
  const time=A.MakeTime(new Date(now)),rotation=A.Rotation_EQJ_HOR(time,new A.Observer(latitude,longitude,0));
  return vectors.map(v=>{
    const p=A.RotateVector(rotation,new A.Vector(...v,time));
    // Astronomy HOR: north, west, zenith; scene: east, up, south.
    return [-p.y,p.z,-p.x];
  });
}

export function visibleStarEdges(positions) {
  const result=[];
  for(const [i,j] of STAR_EDGES){
    let a=positions[i],b=positions[j];
    if(a[1]<=0&&b[1]<=0)continue;
    if(a[1]<0||b[1]<0){
      const t=-a[1]/(b[1]-a[1]),q=a.map((v,k)=>v+t*(b[k]-v)),length=Math.hypot(...q);
      const horizon=q.map(v=>v/length);horizon[1]=0;
      if(a[1]<0)a=horizon;else b=horizon;
    }
    result.push(...a,...b);
  }
  return result;
}
