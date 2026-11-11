# PV Flow + Garage Sun & Moon

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
- Automatic weather changes every 20 seconds: sunshine, clouds, rain and wind.
  Select a weather condition manually to keep it. Rain and sunlight animate
  during camera flight; a static rooftop flag shows wind strength and direction.
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
