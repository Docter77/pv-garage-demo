# PV Flow + Garage Sun & Moon

### Visual Update (14 November 2026)

Garage visuals match revision312 of the reference dashboard, with English
controls and synthetic inputs only:

- Darker panel base (#142a3a), separate east/west reflections up to3000W per
  side, stronger low-power contrast and15% softer highlight strength.
- A very subtle weather-colored sky,8.8% blend, only above the projected
  garage floor. The foreground stays dark.
- Flatter camera flight, especially at night; garage framed lower for more sky.
- Slightly dimmer neutral night light and warm gable light patches.
-181 catalog stars at their local sky positions, with faint Big Dipper,
  Cassiopeia, Orion and Cygnus lines. See garage/STAR_CATALOG_LICENSE.md.
- Gust-only windsock stages, dense rain/snow/storm clouds, static fog,
  gentle lightning, and sunlight-colored sun symbol.

This supersedes the older decorative-star and shared-PV descriptions below.
PV inputs here are synthetic ten-minute simulation steps; the real dashboard's
five-minute sensor averaging and HA-specific controls are intentionally absent.

### Gust-Based Wind Stages (13 November 2026)

The windsock now uses gust speed only, with five stages at 0/8/16/24/32 km/h.
Steady wind no longer overrides it. Its downward angles are46.08/35.02/
24.35/13.41/2.14 degrees, matching the reference dashboard's icon rotations.
Opacity ranges from30 to100 percent, reaching maximum at32 km/h. No separate
downward hysteresis; no flutter, new timer, extra draw call or geometry rebuild
on a stage change. Perspective still affects the apparent screen angle.

### Clear Night and Sunlight (13 November 2026)

Earlier version (superseded above): clear nights showed a decorative star field, fading in between sun
elevations -4 and -10 degrees. Clouds, rain and fog hide it; no twinkling,
catalogue or extra timer. One extra draw call only while visible. Moon and
planet tracks are subtler; their positions and event labels are unchanged.
The sun symbol goes from white (weak) to yellow (strong) with simulated
sunlight, with only +/-4 percent size variation. Red is restricted to twilight
(-6..+6 degrees); deep-night outline is dimmed, not red. Annual views retain
their neutral presentation. Existing moonlight, weather and PV gloss remain.

### Moonlight and Solar Reflections (12 November 2026)

Soft neutral-white night fill keeps the garage visible, with warm gable light
patches and red twilight retained. This is decorative moonlight, not a lunar
phase/position simulation. Daytime panel gloss follows the simulated PV power:
0 W matte, 1,500 W half strength, 3,000 W maximum. Higher power is capped;
night and annual previews disable the effect. Existing lights and batched
materials are reused: no extra draw calls, geometry, timers or API requests.

An interactive energy-flow and 3D astronomy demo by **Docter77**.
Watch a simulated solar day unfold, or explore the sun, moon and planet paths
around an example garage.

**All energy readings are synthetic. There is no Home Assistant connection,
no login and no control of real devices.**

**[Open the live animation](https://docter77.github.io/pv-garage-demo/)**

No Home Assistant installation or download is needed. Open the link in a recent
desktop or mobile browser. Camera flight and the simulated daily cycle start
automatically; their controls can pause them independently.

## Features

- PV generation, home demand, battery and grid flows with colors, glow effects,
  temperatures and changing power readings.
- A continuous daily cycle starting at 06:00: two real seconds represent ten
  simulated minutes. Pause or change the weather at any time.
- Battery charge follows the simulated energy balance. See low and high charge
  levels, car charging, grid imports and exports throughout the day.
- Weather changes preserve time and charge levels. At midnight, daily energy
  totals move to **Y** (yesterday); **STAT** opens the energy statistics.
- An interactive 3D garage with camera flight, expanded view and planet controls.
- Automatic weather changes every 20 seconds: sunshine, clouds, rain, heavy rain,
  snow, sleet, thunderstorms, fog, dusk, night and wind. Select any condition
  manually to keep it. Rain has three intensities; rainy skies are denser than
  partly cloudy skies. Cloudy has three cloud patches, Overcast six, and rain,
  snow and thunderstorms nine; thunderstorm clouds are dark. Snow has 192 flakes
  (96 in sleet). Heavy rain and thunderstorms show up to 144 rain streaks,
  double the preceding version. Fog wisps stay static.
- A red-and-white 3D windsock shows five gust strengths and downwind direction,
  without flutter. Night darkens the garage and shows two warm light patches:
  between the front garage doors and beside the rear person door. Both patches
  share one draw call; there are no lamp fixtures, point lights or shadow maps;
  twilight adds a warm red tint. These presets also adjust the garage clock to
  actual solar noon, sunset or two hours after sunset for the selected date.
- Thunderstorms keep the same gentle .45-second light pulses, starting after 2 seconds
  and then every 6 seconds while camera flight is running. Disable **Lightning**
  in **3D options**; reduced-motion preferences also disable flashes.
  Rain, snow and sunlight animate during camera flight.
  Pausing the daily cycle also pauses automatic weather changes. Weather is
  hidden during the annual astronomy preview.
- A one-year preview from the selected date, with sun, moon, selected planets
  and an eclipse timeline.
- Rise/set times, elevation, compass directions, day/night length and countdowns.

The energy simulation clock and garage date/time are independent. The garage
starts on today's date and displays times in UTC. The example location
(52 degrees north, 13 degrees east) is **not the location of the house artwork**.
Shadow end (**SE**) remains `--:--` because no site-specific shadow model is
included. This is a visual demonstration, not a battery-management or engineering
simulation.

Weather presentation updated 12 November 2026. The effects reuse the existing
render loop with a slightly denser cloud layer (19% higher opacity).
The daily-cycle timer is unchanged, with no new API requests. Cloud and fog
layers are static; this reduces work but does not promise zero GPU cost.

## Run Locally

Download or clone this repository, then serve its root with a static HTTP server.
For example, with Python installed:

```sh
python -m http.server 8080 --bind 127.0.0.1
```

Open [localhost:8080](http://127.0.0.1:8080) in a recent browser with WebGL support.
No build step or Home Assistant token is required. Opening `index.html` directly
with `file://` is not supported because the demo uses ES modules and Web Workers.
Libraries, fonts and artwork are bundled locally; the demo does not fetch live
household data or call external APIs.

## Status and Rights

This is a standalone demonstration, **not yet a HACS card or a supported,
configurable Home Assistant integration**.

The repository is shared for viewing and evaluation. No open-source license
has been granted for the project's own code or artwork. Public visibility does
not grant a general redistribution or reuse license; contact Docter77 to discuss
reuse. Third-party components retain their bundled licenses, listed in
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

The owner-created house and battery graphics are included with the owner's
authorization. The demo excludes private credentials, real household readings,
vehicle registration plates and the Google/VectorStock images used in the
original private dashboard.
