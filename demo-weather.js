const cycle=['sun','cloud','rain','wind'];
const presets={
 sun:{label:'Sunny / calm',energy:'sun',sun:1,rain:false,wind:{speed:2,gust:3,from:90}},
 cloud:{label:'Cloudy / light breeze',energy:'cloud',sun:.25,rain:false,wind:{speed:8,gust:12,from:160}},
 rain:{label:'Rain / gusty',energy:'overcast',sun:.06,rain:true,wind:{speed:16,gust:28,from:230}},
 wind:{label:'Sunny / windy',energy:'sun',sun:.85,rain:false,wind:{speed:24,gust:38,from:290}},
 overcast:{label:'Overcast / light breeze',energy:'overcast',sun:.08,rain:false,wind:{speed:7,gust:10,from:180}}
};
export function demoWeather(selection,tick=0){
 const key=selection==='auto'?cycle[Math.floor(tick/10)%cycle.length]:selection;
 return presets[key]||presets.sun;
}
