const EPS = 1e-8;
const EDGES = [[0,1],[1,3],[3,2],[2,0],[0,4],[1,5],[2,6],[3,7],[4,5],[6,7],[4,8],[6,8],[5,9],[7,9],[8,9]];
const sub = (a,b) => ({x:a.x-b.x,y:a.y-b.y,z:a.z-b.z});
const dot = (a,b) => a.x*b.x+a.y*b.y+a.z*b.z;
const cross3 = (a,b) => ({x:a.y*b.z-a.z*b.y,y:a.z*b.x-a.x*b.z,z:a.x*b.y-a.y*b.x});
const unit = a => {const n=Math.hypot(a.x,a.y,a.z);return{x:a.x/n,y:a.y/n,z:a.z/n};};
const cross = (a,b,c) => (b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);

function hull(points) {
  const sorted=points.sort((a,b)=>a.x-b.x||a.y-b.y),unique=[];
  for(const p of sorted)if(!unique.length||Math.hypot(p.x-unique.at(-1).x,p.y-unique.at(-1).y)>EPS)unique.push(p);
  if(unique.length<3)return [];
  const lower=[],upper=[];
  for(const p of unique){while(lower.length>1&&cross(lower.at(-2),lower.at(-1),p)<=EPS)lower.pop();lower.push(p);}
  for(let i=unique.length-1;i>=0;i--){const p=unique[i];while(upper.length>1&&cross(upper.at(-2),upper.at(-1),p)<=EPS)upper.pop();upper.push(p);}
  return lower.slice(0,-1).concat(upper.slice(0,-1));
}

export function makeShadowReceiver(vertices, normal, kind) {
  const origin=vertices[0],n=unit(normal),u=unit(sub(vertices[1],origin)),v=unit(cross3(n,u));
  const polygon=hull(vertices.map(p=>{const d=sub(p,origin);return{x:dot(d,u),y:dot(d,v)};}));
  return {origin,n,u,v,polygon,kind};
}

export function projectHouseShadow(receiver, vertices, sun) {
  const {origin,n,u,v}=receiver,denominator=dot(n,sun);
  if(denominator<=1e-5)return [];
  const distances=vertices.map(p=>dot(sub(p,origin),n)),front=[];
  for(let i=0;i<vertices.length;i++)if(distances[i]>=0)front.push(vertices[i]);
  // Clip the convex house to the sun-facing half-space before projection.
  for(const[a,b]of EDGES)if((distances[a]<0)!==(distances[b]<0)){
    const t=distances[a]/(distances[a]-distances[b]),p=vertices[a],q=vertices[b];
    front.push({x:p.x+(q.x-p.x)*t,y:p.y+(q.y-p.y)*t,z:p.z+(q.z-p.z)*t});
  }
  let polygon=hull(front.map(p=>{
    const d=sub(p,origin),t=dot(d,n)/denominator;
    const projected={x:d.x-sun.x*t,y:d.y-sun.y*t,z:d.z-sun.z*t};
    return{x:dot(projected,u),y:dot(projected,v)};
  }));
  // Sutherland-Hodgman clipping keeps the projected silhouette on this face.
  for(let i=0;i<receiver.polygon.length&&polygon.length;i++){
    const a=receiver.polygon[i],b=receiver.polygon[(i+1)%receiver.polygon.length],next=[];
    let previous=polygon.at(-1),dp=cross(a,b,previous);
    for(const point of polygon){
      const dc=cross(a,b,point);
      if((dp>=-EPS)!==(dc>=-EPS)){
        const t=dp/(dp-dc);next.push({x:previous.x+(point.x-previous.x)*t,y:previous.y+(point.y-previous.y)*t});
      }
      if(dc>=-EPS)next.push(point);
      previous=point;dp=dc;
    }
    polygon=next;
  }
  if(polygon.length<3)return [];
  return polygon.map(p=>({x:origin.x+u.x*p.x+v.x*p.y,y:origin.y+u.y*p.x+v.y*p.y,z:origin.z+u.z*p.x+v.z*p.y}));
}
