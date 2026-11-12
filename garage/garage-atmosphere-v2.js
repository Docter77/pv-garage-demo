import * as THREE from './three-r180.module.min.js';

export class GarageAtmosphere {
  constructor(scene, ambient) {
    this.scene = scene;
    this.ambient = ambient;
    this.baseIntensity = ambient.intensity;
    this.baseSky = ambient.color.clone();
    this.baseGround = ambient.groundColor.clone();
    this.nightSky = new THREE.Color(0x7e91b0);
    this.nightGround = new THREE.Color(0x30343d);
    this.twilight = new THREE.Color(0xff7451);
    this.lamps = new THREE.Group();
    this.lamps.name = 'garage-night-lamps';
    this.lamps.visible = false;
    scene.add(this.lamps);
    this.housings = new THREE.InstancedMesh(new THREE.BoxGeometry(.42,.18,.16),new THREE.MeshLambertMaterial({color:0x333b40}),2);
    this.lenses = new THREE.InstancedMesh(new THREE.BoxGeometry(.32,.075,.025),new THREE.MeshBasicMaterial({color:0xffdda0}),2);
    this.washes = new THREE.InstancedMesh(new THREE.PlaneGeometry(2.4,2.3),new THREE.ShaderMaterial({
      transparent:true,depthWrite:false,side:THREE.DoubleSide,forceSinglePass:true,
      uniforms:{amount:{value:0}},
      vertexShader:`varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.0);}`,
      fragmentShader:`varying vec2 vUv; uniform float amount;
        void main(){float down=1.0-vUv.y;float width=mix(.06,.48,down);
        float beam=1.0-smoothstep(width*.3,width,abs(vUv.x-.5));
        float fade=smoothstep(0.0,.08,down)*(1.0-smoothstep(.25,1.0,down));
        gl_FragColor=vec4(1.0,.68,.29,beam*fade*.58*amount);}`
    }),2);
    this.lamps.add(this.housings,this.lenses,this.washes);
    const positions=[],centers=[],uv=[],indices=[];
    for(let i=0;i<3;i++){
      const center=[[-3,1.5,-5],[4,2.1,1],[-1,1.2,6]][i];
      positions.push(-12,-2,0,12,-2,0,12,2,0,-12,2,0);
      for(let j=0;j<4;j++)centers.push(...center);
      uv.push(0,0,1,0,1,1,0,1);const n=i*4;indices.push(n,n+1,n+2,n,n+2,n+3);
    }
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    geometry.setAttribute('center',new THREE.Float32BufferAttribute(centers,3));
    geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setIndex(indices);
    this.mist=new THREE.Mesh(geometry,new THREE.ShaderMaterial({
      transparent:true,depthWrite:false,
      uniforms:{brightness:{value:1}},
      vertexShader:`attribute vec3 center; varying vec2 vUv; varying float seed;
        void main(){vUv=uv;seed=center.z;vec4 p=modelViewMatrix*vec4(center,1.0);
        p.xy+=position.xy;gl_Position=projectionMatrix*p;}`,
      fragmentShader:`uniform float brightness;varying vec2 vUv;varying float seed;
        void main(){vec2 p=vUv;float x=p.x*18.0+seed;
        float ribbon=.5+.1*sin(x*.71)+.06*sin(x*1.9);
        float soft=exp(-pow((p.y-ribbon)*6.0,2.0));
        float cloud=.55+.25*sin(x*.52+p.y*7.0)+.2*sin(x*1.43-p.y*5.0);
        float edge=smoothstep(0.0,.16,p.x)*(1.0-smoothstep(.84,1.0,p.x));
        gl_FragColor=vec4(vec3(.72,.78,.8)*brightness,soft*cloud*edge*.34);}`
    }));
    this.mist.name='garage-fog-wisps';this.mist.frustumCulled=false;this.mist.visible=false;this.mist.renderOrder=3;
    scene.add(this.mist);
  }

  place(model) {
    this.lamps.rotation.y=(90-model.roofAzimuth)*Math.PI/180;
    const y=Math.min(model.wallHeight-.18,model.wallHeight*.88);
    const poses=[{x:0,z:-model.length/2-.13,angle:Math.PI},{x:model.width/2+.13,z:0,angle:Math.PI/2}];
    const object=new THREE.Object3D();
    poses.forEach((p,i)=>{
      object.position.set(p.x,y,p.z);object.rotation.set(0,p.angle,0);object.updateMatrix();this.housings.setMatrixAt(i,object.matrix);
      object.translateZ(.096);object.updateMatrix();this.lenses.setMatrixAt(i,object.matrix);
      object.position.set(p.x,y-1.05,p.z);object.updateMatrix();this.washes.setMatrixAt(i,object.matrix);
    });
    for(const mesh of [this.housings,this.lenses,this.washes]){mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();}
  }

  frame(data, live, seconds, elevation, key) {
    const active=live&&Number.isFinite(elevation);
    const day=active?THREE.MathUtils.smoothstep(elevation,-6,6):1;
    const dusk=active?Math.sin(day*Math.PI):0;
    this.ambient.intensity=THREE.MathUtils.lerp(.4,this.baseIntensity,day);
    this.ambient.color.copy(this.nightSky).lerp(this.baseSky,day).lerp(this.twilight,dusk*.38);
    this.ambient.groundColor.copy(this.nightGround).lerp(this.baseGround,day);
    if(active){key.intensity*=.06+.94*day;key.color.lerp(this.twilight,dusk*.8);}
    const lamp=active?1-THREE.MathUtils.smoothstep(elevation,-4,2):0;
    this.lamps.visible=lamp>.005;
    this.lenses.material.color.setRGB(1,.78,.43).multiplyScalar(.4+.6*lamp);
    this.washes.material.uniforms.amount.value=lamp;
    this.mist.visible=!!(live&&data?.fog===true);
    this.mist.material.uniforms.brightness.value=.38+.62*day;
  }

  dispose() {
    this.ambient.intensity=this.baseIntensity;this.ambient.color.copy(this.baseSky);this.ambient.groundColor.copy(this.baseGround);
    this.lamps.removeFromParent();this.mist.removeFromParent();
    for(const mesh of [this.housings,this.lenses,this.washes,this.mist]){mesh.dispose?.();mesh.geometry.dispose();mesh.material.dispose();}
  }
}
