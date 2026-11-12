const cycle=['sun','cloud','rain','pouring','snow','mixed','storm','fog','twilight','night','wind'];
const presets={
 sun:{label:'Sunny / calm',energy:'sun',sun:1,condition:'sunny',rain:false,wind:{speed:2,gust:3,from:90}},
 cloud:{label:'Cloudy / light breeze',energy:'cloud',sun:.25,condition:'cloudy',rain:false,wind:{speed:8,gust:12,from:160}},
 rain:{label:'Rain / dense clouds',energy:'overcast',sun:.06,condition:'rainy',rain:true,rainLevel:2,wind:{speed:16,gust:28,from:230}},
 pouring:{label:'Heavy rain / overcast',energy:'overcast',sun:.02,condition:'pouring',rain:true,rainLevel:3,wind:{speed:19,gust:32,from:240}},
 snow:{label:'Snow',energy:'overcast',sun:.08,condition:'snowy',rain:false,wind:{speed:4,gust:6,from:30}},
 mixed:{label:'Sleet / rain and snow',energy:'overcast',sun:.06,condition:'snowy-rainy',rain:true,rainLevel:1,wind:{speed:8,gust:12,from:40}},
 storm:{label:'Thunderstorm / occasional lightning',energy:'overcast',sun:.02,condition:'lightning-rainy',rain:true,rainLevel:3,wind:{speed:24,gust:38,from:260}},
 fog:{label:'Fog / static wisps',energy:'overcast',sun:.04,condition:'fog',fog:true,rain:false,wind:{speed:1,gust:2,from:90}},
 twilight:{label:'Garage at dusk / warm lamps',energy:'cloud',sun:.1,condition:'partlycloudy',lighting:'twilight',rain:false,wind:{speed:3,gust:5,from:130}},
 night:{label:'Garage at night / warm lamps',energy:'overcast',sun:0,condition:'clear-night',lighting:'night',rain:false,wind:{speed:2,gust:3,from:90}},
 wind:{label:'Sunny / windy',energy:'sun',sun:.85,condition:'sunny',rain:false,wind:{speed:24,gust:38,from:290}},
 overcast:{label:'Overcast / light breeze',energy:'overcast',sun:.08,condition:'cloudy',rain:false,wind:{speed:7,gust:10,from:180}}
};
export function demoWeather(selection,tick=0){
 const key=selection==='auto'?cycle[Math.floor(tick/10)%cycle.length]:selection;
 return presets[key]||presets.sun;
}
