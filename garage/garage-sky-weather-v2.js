import * as THREE from './three-r180.module.min.js';

export function garageSky(condition) {
  const storm=condition==='lightning'||condition==='lightning-rainy';
  const snow=condition==='snowy'||condition==='snowy-rainy';
  const clouds=storm?1.5:condition==='pouring'?1.5:condition==='rainy'?1.35:
    condition==='cloudy'?.8:condition==='partlycloudy'?.45:
    ['snowy','snowy-rainy','hail','windy-variant'].includes(condition)?.8:0;
  return {storm,snow,clouds,mixed:condition==='snowy-rainy'};
}

export class GarageSkyWeather {
  constructor(scene) {
    this.scene=scene;this.elapsed=0;this.stormClock=0;
    const positions=[],centers=[],uv=[],indices=[];
    for(let i=0;i<3;i++){
      positions.push(-6,-1.7,0,6,-1.7,0,6,1.7,0,-6,1.7,0);
      const center=[[-6,0,-4],[3,1,-6],[6,-.3,3]][i];
      for(let j=0;j<4;j++)centers.push(...center);
      uv.push(0,0,1,0,1,1,0,1);const n=i*4;indices.push(n,n+1,n+2,n,n+2,n+3);
    }
    const cloudGeometry=new THREE.BufferGeometry();
    cloudGeometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    cloudGeometry.setAttribute('center',new THREE.Float32BufferAttribute(centers,3));
    cloudGeometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));cloudGeometry.setIndex(indices);
    this.clouds=new THREE.Mesh(cloudGeometry,new THREE.ShaderMaterial({transparent:true,depthWrite:false,
      uniforms:{coverage:{value:0},brightness:{value:1},storm:{value:0}},
      vertexShader:`attribute vec3 center;varying vec2 vUv;void main(){vUv=uv;
        vec4 p=modelViewMatrix*vec4(center,1.0);p.xy+=position.xy;gl_Position=projectionMatrix*p;}`,
      fragmentShader:`uniform float coverage;uniform float brightness;uniform float storm;varying vec2 vUv;
        void main(){vec2 p=vUv;float puff=0.0;
        puff=max(puff,exp(-dot((p-vec2(.26,.45))*vec2(6.,4.),(p-vec2(.26,.45))*vec2(6.,4.))));
        puff=max(puff,exp(-dot((p-vec2(.49,.61))*vec2(5.,3.7),(p-vec2(.49,.61))*vec2(5.,3.7))));
        puff=max(puff,exp(-dot((p-vec2(.73,.46))*vec2(6.,4.4),(p-vec2(.73,.46))*vec2(6.,4.4))));
        float texture=.9+.1*sin(p.x*23.+sin(p.y*19.))*sin(p.y*16.);
        float a=smoothstep(.12,.6,puff)*texture*coverage*.62;
        vec3 shade=mix(vec3(.43,.48,.52),vec3(.88,.9,.91),p.y)*brightness*(1.-storm*.3);
        gl_FragColor=vec4(shade,a);}`
    }));
    this.clouds.frustumCulled=false;this.clouds.name='garage-cloud-layer';this.clouds.visible=false;scene.add(this.clouds);
    const flakes=new Float32Array(32*3);
    for(let i=0;i<32;i++)flakes.set([((i*.61803398875)%1-.5)*24,(i*.41421356237%1)*16,((i*.73205080757)%1-.5)*24],i*3);
    const snowGeometry=new THREE.BufferGeometry();snowGeometry.setAttribute('position',new THREE.BufferAttribute(flakes,3));
    this.snow=new THREE.Points(snowGeometry,new THREE.ShaderMaterial({transparent:true,depthWrite:false,
      uniforms:{time:{value:0}},
      vertexShader:`uniform float time;void main(){vec3 p=position;p.y=mod(p.y-time*.9,16.)+.4;
        p.x+=sin(time*.3+position.y)*.45;vec4 view=modelViewMatrix*vec4(p,1.);
        gl_Position=projectionMatrix*view;gl_PointSize=clamp(85./max(1.,-view.z),2.,5.);}`,
      fragmentShader:`void main(){float d=length(gl_PointCoord-vec2(.5));float a=1.-smoothstep(.18,.5,d);gl_FragColor=vec4(.91,.96,1.,a*.8);}`
    }));this.snow.frustumCulled=false;this.snow.name='garage-snow';this.snow.visible=false;scene.add(this.snow);
    const boltGeometry=new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-.8,3,0),new THREE.Vector3(-1.2,2.1,0),new THREE.Vector3(-.9,2.05,0),
      new THREE.Vector3(-1.5,1.1,0),new THREE.Vector3(-1.2,1.05,0),new THREE.Vector3(-1.9,0,0)]);
    this.bolt=new THREE.Line(boltGeometry,new THREE.LineBasicMaterial({color:0xcddff4,transparent:true,opacity:0,depthWrite:false}));
    this.bolt.name='garage-lightning';this.bolt.visible=false;scene.add(this.bolt);
  }
  place(model) {
    const roof=model.wallHeight+model.width/2*Math.tan(model.pitch*Math.PI/180);
    this.clouds.position.y=roof+3.5;this.bolt.position.set(3,roof+1,-5);
  }
  frame(data,live,seconds,elevation,key,lightning) {
    const state=garageSky(data?.condition);
    const sun=Number.isFinite(data?.sun)?data.sun:null;
    this.clouds.visible=!!(live&&state.clouds);
    this.clouds.material.uniforms.coverage.value=state.clouds*(1-(sun??0)*.6);
    this.clouds.material.uniforms.brightness.value=THREE.MathUtils.lerp(.32,1,Number.isFinite(elevation)?THREE.MathUtils.smoothstep(elevation,-6,6):1);
    this.clouds.material.uniforms.storm.value=state.storm?1:0;
    // Measured local sunlight wins over the reported weather condition.
    if(live&&sun===null)key.intensity*=1-state.clouds*.4;
    if(live)this.elapsed+=seconds;
    this.snow.visible=!!(live&&state.snow);this.snow.geometry.setDrawRange(0,state.mixed?16:32);
    this.snow.material.uniforms.time.value=this.elapsed;
    const enabled=live&&state.storm&&lightning&&seconds>0;
    this.stormClock=enabled?this.stormClock+Math.min(seconds,.1):0;
    // One gentle pulse, first after 12s then every 37s; never catch up missed flashes.
    const phase=(this.stormClock+25)%37;
    const flash=enabled&&phase<.45?Math.sin(phase/.45*Math.PI):0;
    this.bolt.visible=flash>.01;this.bolt.material.opacity=.55*flash;
    if(flash)key.intensity+=flash*.45;
  }
  dispose() {
    for(const object of [this.clouds,this.snow,this.bolt]){object.removeFromParent();object.geometry.dispose();object.material.dispose();}
  }
}
