# Deep Beat

### Description:
Deep Beat analyses many characteristics of BeatSaber Maps that give a better understanding of the playstyle, difficulty and flow.

#### Features
 * You can analyse your own maps by uploading them or any map on bsaber.com or beatsaver.com by copying their bsr-code.
 * Deep Beat provides you with general information about the map like uploader, duration, stars, nps, njs, etc...
 * You can install, download and listen to the map
 * Deep Beat estimates the occurence of some patterns like jumps and vision blockers and gives it a grade
 * You can also look how the nps, speed, wrist-heavyness and complexity develops over time

#### Code
I'm currently using HTML, CSS and Javascript along with js libraries like JQuery, [JSZip](https://stuk.github.io/jszip/) and [ChartJS](https://www.chartjs.org/), and the css framework [CirrusUI](https://cirrus-ui.netlify.app/).

For development, I've set up webpack to merge and minimize all js code using the `webpack.config.js` configuartion. 

There are two pages, the index.js page and the map.js page. The index page contains simple logic about finding a map by its key and giving it to the map page. The map page (src/map.js) includes all logic for analysing a maps characteristics and generating its corresponding report. The helper.js file helps with calls to API endpoints and other useful general helper functions. JSZip is used to decode zip files from an API or user upload.


#### Development
 * Run `npm install`
 * Run `cd dist && http-server` (assuming that you have installed it)
 * Run `npx webpack` in another terminal session

<hr>

[![man hours](https://img.shields.io/endpoint?url=https%3A%2F%2Fmh.jessemillar.com%2Fhours%3Frepo%3Dhttps%3A%2F%2Fgithub.com%2FMindLaborDev%2Fdeep-beat.git)](https://jessemillar.com/r/man-hours)
