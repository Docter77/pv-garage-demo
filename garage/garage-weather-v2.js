import * as THREE from './three-r180.module.min.js';

export class GarageWeather {
  constructor(scene, light) {
    this.light = light;
    this.baseIntensity = light.intensity;
    this.baseColor = light.color.clone();
    const positions = new Float32Array(24 * 2 * 3);
    const ends = new Float32Array(24 * 2);
    for (let i = 0; i < 24; i++) {
      const x = ((i * .61803398875) % 1 - .5) * 30;
      const y = (i * .41421356237 % 1) * 20;
      const z = ((i * .73205080757) % 1 - .5) * 30;
      for (let e = 0; e < 2; e++) { positions.set([x,y,z], (i * 2 + e) * 3); ends[i * 2 + e] = e; }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions,3));
    geometry.setAttribute('end', new THREE.BufferAttribute(ends,1));
    const material = new THREE.ShaderMaterial({transparent:true,depthWrite:false,
      uniforms:{time:{value:0}},
      vertexShader:`attribute float end; uniform float time;
        void main(){vec3 p=position; p.y=mod(p.y-time*6.0,20.0)+0.8-end*0.65;
        p.x+=end*0.10; gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0);}`,
      fragmentShader:'void main(){gl_FragColor=vec4(0.55,0.78,0.92,0.48);}'
    });
    this.rain = new THREE.LineSegments(geometry,material);
    this.rain.frustumCulled = false;
    this.rain.visible = false;
    this.rain.name = 'garage-weather-rain';
    scene.add(this.rain);
    this.flagGroup = new THREE.Group();
    this.flagGroup.name = 'garage-weather-wind';
    const poleGeometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,0,0),new THREE.Vector3(0,2.4,0)]);
    this.pole = new THREE.Line(poleGeometry,new THREE.LineBasicMaterial({color:0xb9c8cb}));
    this.flagGroup.add(this.pole);
    const flagGeometry = new THREE.BufferGeometry();
    flagGeometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(12),3));
    flagGeometry.setIndex([0,1,2,0,2,3]);
    this.flag = new THREE.Mesh(flagGeometry,new THREE.MeshBasicMaterial({color:0x60d5f0,side:THREE.DoubleSide}));
    this.flag.position.y = 2.25;
    this.flagGroup.add(this.flag);
    this.flagGroup.visible = false;
    scene.add(this.flagGroup);
    this.elapsed = 0;
  }

  place(model) {
    this.flagGroup.position.set(0,model.wallHeight + model.width / 2 * Math.tan(model.pitch * Math.PI / 180),0);
  }

  wind(wind, live) {
    this.flagGroup.visible = !!(live && wind);
    if (!wind || wind === this.lastWind) return;
    this.lastWind = wind;
    const strength = Math.max(wind.speed,wind.gust);
    const pose = strength < 5 ? 0 : strength < 20 ? 1 : 2;
    const key = `${wind.from}|${pose}`;
    if (key === this.windKey) return;
    this.windKey = key;
    // Meteorological bearing is FROM; the free edge points downwind (TO).
    this.flagGroup.rotation.y = (-90 - wind.from) * Math.PI / 180;
    const width = [.12,.9,1.4][pose], drop = [-1.25,-.75,-.06][pose];
    this.flag.geometry.attributes.position.array.set([0,0,0, 0,-.6,0, width,drop-.6,0, width,drop,0]);
    this.flag.geometry.attributes.position.needsUpdate = true;
    this.flag.geometry.computeBoundingSphere();
    this.flagGroup.userData.pose = ['hanging','slanted','extended'][pose];
  }

  frame(data, live, seconds, daylight = true) {
    const sun = live && daylight && data?.sun != null ? data.sun : null;
    this.rain.visible = !!(live && data?.rain);
    this.wind(data?.wind,live);
    if (!live) {
      this.light.intensity = this.baseIntensity;
      this.light.color.copy(this.baseColor);
      return;
    }
    this.elapsed += seconds;
    if (this.rain.visible) this.rain.material.uniforms.time.value = this.elapsed;
    if (sun == null) {
      this.light.intensity = this.baseIntensity;
      this.light.color.copy(this.baseColor);
    } else {
      this.light.intensity = 1.6 + sun * .9 + sun * .04 * Math.sin(this.elapsed * .8);
      this.light.color.setRGB(1, 1 - sun * .06, 1 - sun * .18);
    }
  }

  dispose() {
    this.flagGroup.removeFromParent();
    for (const object of [this.flag,this.pole]) { object.geometry.dispose(); object.material.dispose(); }
    this.rain.removeFromParent();
    this.rain.geometry.dispose();
    this.rain.material.dispose();
    this.light.intensity = this.baseIntensity;
    this.light.color.copy(this.baseColor);
  }
}
