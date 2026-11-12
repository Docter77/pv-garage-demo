import * as THREE from './three-r180.module.min.js';
import { GarageAtmosphere } from './garage-atmosphere-v2.js?v=20261112b';
import { GarageSkyWeather, garageSky } from './garage-sky-weather-v2.js?v=20261112c';

export class GarageWeather {
  constructor(scene, light, ambient) {
    this.scene = scene;
    this.baseFog = scene.fog;
    // Keep one shader variant; density zero disables fog without material recompiles.
    this.fog = new THREE.FogExp2(0x7b8990, 0);
    scene.fog = this.fog;
    this.light = light;
    this.baseIntensity = light.intensity;
    this.baseColor = light.color.clone();
    this.atmosphere = new GarageAtmosphere(scene,ambient);
    this.sky = new GarageSkyWeather(scene);
    const positions = new Float32Array(144 * 2 * 3);
    const ends = new Float32Array(144 * 2);
    for (let i = 0; i < 144; i++) {
      const x = ((i * .61803398875) % 1 - .5) * 30;
      const y = (i * .41421356237 % 1) * 20;
      const z = ((i * .73205080757) % 1 - .5) * 30;
      for (let e = 0; e < 2; e++) { positions.set([x,y,z], (i * 2 + e) * 3); ends[i * 2 + e] = e; }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions,3));
    geometry.setAttribute('end', new THREE.BufferAttribute(ends,1));
    const material = new THREE.ShaderMaterial({transparent:true,depthWrite:false,
      uniforms:{time:{value:0},opacity:{value:.48}},
      vertexShader:`attribute float end; uniform float time;
        void main(){vec3 p=position; p.y=mod(p.y-time*6.0,20.0)+0.8-end*0.65;
        p.x+=end*0.10; gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0);}`,
      fragmentShader:'uniform float opacity; void main(){gl_FragColor=vec4(0.55,0.78,0.92,opacity);}'
    });
    this.rain = new THREE.LineSegments(geometry,material);
    this.rain.frustumCulled = false;
    this.rain.visible = false;
    this.rain.name = 'garage-weather-rain';
    scene.add(this.rain);
    this.flagGroup = new THREE.Group();
    this.flagGroup.name = 'garage-weather-wind';
    const poleGeometry = new THREE.CylinderGeometry(.025,.035,2.4,6);
    this.pole = new THREE.Mesh(poleGeometry,new THREE.MeshLambertMaterial({color:0xb9c8cb}));
    this.pole.position.y = 1.2;
    this.flagGroup.add(this.pole);
    const flagGeometry = new THREE.BufferGeometry();
    // Five bands share one material/drawcall; duplicated edges keep stripes crisp.
    const colors = [], indices = [];
    for (let band = 0; band < 5; band++) {
      const color = new THREE.Color(band % 2 ? 0xf4f1e8 : 0xd94b42);
      for (let i = 0; i < 22; i++) colors.push(color.r,color.g,color.b);
      for (let j = 0; j < 10; j++) {
        const a = band * 22 + j, b = a + 11;
        indices.push(a,a+1,b, a+1,b+1,b);
      }
    }
    flagGeometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(110 * 3),3));
    flagGeometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
    flagGeometry.setIndex(indices);
    this.flag = new THREE.Mesh(flagGeometry,new THREE.MeshLambertMaterial({vertexColors:true,side:THREE.DoubleSide}));
    this.flag.position.y = 2.25;
    this.flagGroup.add(this.flag);
    this.flagGroup.visible = false;
    scene.add(this.flagGroup);
    this.elapsed = 0;
  }

  place(model) {
    this.sky.place(model);
    this.atmosphere.place(model);
    this.flagGroup.position.set(0,model.wallHeight + model.width / 2 * Math.tan(model.pitch * Math.PI / 180),0);
  }

  wind(wind, live) {
    this.flagGroup.visible = !!(live && wind);
    if (!wind || wind === this.lastWind) return;
    this.lastWind = wind;
    // Match RoomCard's visual weighting; gusts are not continuous wind.
    const strength = Math.max(wind.speed,wind.gust / 2);
    const thresholds = [4,8,16];
    let pose = thresholds.filter(n => strength >= n).length;
    if (this.windPose != null && pose < this.windPose
        && strength >= thresholds[this.windPose - 1] - 1) pose = this.windPose;
    this.windPose = pose;
    const key = `${wind.from}|${pose}`;
    if (key === this.windKey) return;
    this.windKey = key;
    // Meteorological bearing is FROM; the free edge points downwind (TO).
    this.flagGroup.rotation.y = (-90 - wind.from) * Math.PI / 180;
    if (pose === this.geometryPose) return;
    this.geometryPose = pose;
    const bend = [1.48,.95,.45,.06][pose], length = 1.65;
    const positions = this.flag.geometry.attributes.position.array;
    for (let band = 0; band < 5; band++) {
      for (let edge = 0; edge < 2; edge++) {
        const t = (band + edge) / 5, angle = -bend * Math.min(1,t * 2.8);
        // Integrate a curved centreline; the mouth stays open while the tail droops.
        let x = .08, y = 0;
        for (let step = 0; step < 16; step++) {
          const u = t * (step + .5) / 16, a = -bend * Math.min(1,u * 2.8);
          x += Math.cos(a) * length * t / 16;
          y += Math.sin(a) * length * t / 16;
        }
        const radius = .25 * (1 - .66 * t);
        const squash = [1 - .45 * t,1 - .2 * t,1,1][pose];
        for (let j = 0; j <= 10; j++) {
          const theta = j / 10 * Math.PI * 2;
          const r = radius * (1 + .045 * Math.sin(theta * 3 + t * 4) * t);
          const cross = Math.cos(theta) * r * squash;
          const offset = (band * 22 + edge * 11 + j) * 3;
          positions.set([x - Math.sin(angle) * cross,y + Math.cos(angle) * cross,Math.sin(theta) * r],offset);
        }
      }
    }
    this.flag.geometry.attributes.position.needsUpdate = true;
    this.flag.geometry.computeVertexNormals();
    this.flag.geometry.computeBoundingSphere();
    this.flagGroup.userData.pose = ['hanging','half-raised','slanted','extended'][pose];
  }

  frame(data, live, seconds, elevation = 90, lightning = false) {
    const sun = live && elevation > 0 && data?.sun != null ? data.sun : null;
    const sky = garageSky(data?.condition);
    this.rain.visible = !!(live && data?.rain && (!sky.snow || sky.mixed));
    this.fog.density = live && data?.fog === true ? .025 : 0;
    const level = [1,2,3].includes(data?.rainLevel) ? data.rainLevel : 1;
    const dense = level === 3 || data?.condition === 'pouring' || sky.storm;
    const rainCount = [0,16,32,48][level] * (dense ? 6 : 1);
    if (rainCount !== this.rainCount) {
      this.rainCount = rainCount;
      this.rainLevel = level;
      this.rain.geometry.setDrawRange(0, rainCount);
      this.rain.material.uniforms.opacity.value = [0,.36,.48,.62][level];
      this.rain.userData.level = level;
    }
    this.wind(data?.wind,live);
    if (!live) {
      this.light.intensity = this.baseIntensity;
      this.light.color.copy(this.baseColor);
      this.atmosphere.frame(data,false,0,elevation,this.light);
      this.sky.frame(data,false,0,elevation,this.light,false);
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
    this.atmosphere.frame(data,live,seconds,elevation,this.light);
    this.sky.frame(data,live,seconds,elevation,this.light,lightning);
  }

  dispose() {
    this.sky.dispose();
    this.atmosphere.dispose();
    if (this.scene.fog === this.fog) this.scene.fog = this.baseFog;
    this.flagGroup.removeFromParent();
    for (const object of [this.flag,this.pole]) { object.geometry.dispose(); object.material.dispose(); }
    this.rain.removeFromParent();
    this.rain.geometry.dispose();
    this.rain.material.dispose();
    this.light.intensity = this.baseIntensity;
    this.light.color.copy(this.baseColor);
  }
}
