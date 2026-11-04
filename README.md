# PV Flow + Garage Sonne Mond

Private Demo von Docter77: Energiefluss und eine 3D-Garage mit Sonnen-, Mond-
und Planetenbahnen. Alle Energiewerte sind erfundene Beispieldaten. Keine
Verbindung zu Home Assistant und keine Befehle an echte Geraete.

## Funktionen

- PV, Haus, Batterie und Netz mit Farbe, Shine, Temperaturen und Energiefluss.
- Durchlaufender PV-Tag mit Uhrzeit ab06:00: zwei Sekunden sind zehn Demominuten.
- PV-Erzeugung, Wolken, Hauslast und Autoladung veraendern sich ueber den Tag.
- Batterie-SOC folgt der Energiebilanz; niedrige, mittlere und hohe Staende,
  Netzbezug und Einspeisung werden sichtbar. Tageslauf kann pausiert werden.
- Wetterwechsel setzt SOC und Zeit nicht zurueck. Mitternacht rollt Tageswerte
  nach Y; STAT zeigt die Energiesummen. Eine Demo-Autofahrt verbraucht Energie.
- Garage mit Flug, Vergroesserung, Optionen, Jahresvorschau und Planetenwahl.
- Sonnen-/Mondzeiten, Hoehe/Richtung, Tageslaenge und Countdowns.

PV-Zeitraffer und Garage-Datum sind unabhaengig. Die Jahresvorschau beginnt
standardmaessig heute. Standort52N/13O und Garage sind Beispiele, nicht der
Standort des abgebildeten Hauses. Schattenende bleibt --:--, weil kein passendes
Schattenmodell enthalten ist. Es ist keine BMS- oder Anlagen-Simulation.

## Lokal Starten

Das Repository herunterladen/klonen und mit einem statischen HTTP-Server
ausliefern, zum Beispiel bei installiertem Python:

```sh
python -m http.server 8080 --bind 127.0.0.1
```

Dann http://127.0.0.1:8080 oeffnen. Kein Build, keine Cloud und kein HA-Token
noetig. Aktueller Browser mit WebGL erforderlich. file:// ist wegen ES-Modulen
und Web Workern nicht geeignet. Bibliotheken und Schrift werden lokal geladen.

## Projektstatus Und Rechte

Privater Prototyp, noch keine HACS-Karte und kein fertiger Konfigurationseditor.
GitHub Pages ist nicht aktiviert. Eigener Code und eigene Haus-/Batteriegrafiken
haben vorerst keine Weitergabelizenz; keine allgemeine Wiederverwendung erlaubt.
Fremdbibliotheken behalten ihre beigefuegten MIT/BSD/OFL-Lizenzen, siehe
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

Keine echten Entitaeten, Zugangsdaten, Steuerungen, Kennzeichen oder
Google-/VectorStock-Grafiken sind enthalten. Haus und Batterie wurden vom
Eigentuemer zur Verwendung in dieser privaten Demo bereitgestellt.
