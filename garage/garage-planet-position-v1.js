// Shared unchanged approximation for live view and worker previews.
const normDeg = value => ((value % 360) + 360) % 360;
export function planetPosition(name, date, latitude, longitude) {
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return { azimuth: NaN, elevation: NaN };
    }

    const rad = Math.PI / 180;
    const dayMs = 1000 * 60 * 60 * 24;
    const d = date.valueOf() / dayMs - 0.5 + 2440588 - 2451545;
    const elements = {
      earth: {
        N: 0, Nr: 0,
        i: 0, ir: 0,
        w: 282.9404, wr: 4.70935E-5,
        a: 1.000000, ar: 0,
        e: 0.016709, er: -1.151E-9,
        M: 356.0470, Mr: 0.9856002585
      },
      mercury: {
        N: 48.3313, Nr: 3.24587E-5,
        i: 7.0047, ir: 5.00E-8,
        w: 29.1241, wr: 1.01444E-5,
        a: 0.387098, ar: 0,
        e: 0.205635, er: 5.59E-10,
        M: 168.6562, Mr: 4.0923344368
      },
      venus: {
        N: 76.6799, Nr: 2.46590E-5,
        i: 3.3946, ir: 2.75E-8,
        w: 54.8910, wr: 1.38374E-5,
        a: 0.723330, ar: 0,
        e: 0.006773, er: -1.302E-9,
        M: 48.0052, Mr: 1.6021302244
      },
      mars: {
        N: 49.5574, Nr: 2.11081E-5,
        i: 1.8497, ir: -1.78E-8,
        w: 286.5016, wr: 2.92961E-5,
        a: 1.523688, ar: 0,
        e: 0.093405, er: 2.516E-9,
        M: 18.6021, Mr: 0.5240207766
      },
      jupiter: {
        N: 100.4542, Nr: 2.76854E-5,
        i: 1.3030, ir: -1.557E-7,
        w: 273.8777, wr: 1.64505E-5,
        a: 5.20256, ar: 0,
        e: 0.048498, er: 4.469E-9,
        M: 19.8950, Mr: 0.0830853001
      }
    };

    const planet = elements[String(name || "").toLowerCase()];
    if (!planet) return { azimuth: NaN, elevation: NaN };

    const pos = (el) => {
      const N = (el.N + el.Nr * d) * rad;
      const i = (el.i + el.ir * d) * rad;
      const w = (el.w + el.wr * d) * rad;
      const a = el.a + el.ar * d;
      const e = el.e + el.er * d;
      const M = normDeg(el.M + el.Mr * d) * rad;
      const E = M + e * Math.sin(M) * (1 + e * Math.cos(M));
      const xv = a * (Math.cos(E) - e);
      const yv = a * (Math.sqrt(1 - e * e) * Math.sin(E));
      const v = Math.atan2(yv, xv);
      const r = Math.sqrt(xv * xv + yv * yv);
      const vw = v + w;
      return {
        x: r * (Math.cos(N) * Math.cos(vw) - Math.sin(N) * Math.sin(vw) * Math.cos(i)),
        y: r * (Math.sin(N) * Math.cos(vw) + Math.cos(N) * Math.sin(vw) * Math.cos(i)),
        z: r * (Math.sin(vw) * Math.sin(i))
      };
    };

    const earth = pos(elements.earth);
    const body = pos(planet);
    const x = body.x + earth.x;
    const y = body.y + earth.y;
    const z = body.z + earth.z;
    const ecl = 23.4397 * rad;
    const xeq = x;
    const yeq = y * Math.cos(ecl) - z * Math.sin(ecl);
    const zeq = y * Math.sin(ecl) + z * Math.cos(ecl);
    const ra = Math.atan2(yeq, xeq);
    const dec = Math.atan2(zeq, Math.sqrt(xeq * xeq + yeq * yeq));

    return horizontalFromRaDec(ra, dec, d, latitude, longitude);
  }

function horizontalFromRaDec(ra, dec, d, latitude, longitude) {
    const rad = Math.PI / 180;
    const lw = -longitude * rad;
    const phi = latitude * rad;
    const H = (280.16 + 360.9856235 * d) * rad - lw - ra;
    const altitude = Math.asin(
      Math.sin(phi) * Math.sin(dec) +
      Math.cos(phi) * Math.cos(dec) * Math.cos(H)
    );
    const azimuth = Math.atan2(
      Math.sin(H),
      Math.cos(H) * Math.sin(phi) - Math.tan(dec) * Math.cos(phi)
    ) + Math.PI;

    return {
      azimuth: normDeg(azimuth / rad),
      elevation: altitude / rad
    };
  }
