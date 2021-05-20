"use strict";

const {
    round,
    bytesToSize,
    convertDate,
    API
} = require("./helper");

let progressElement;
let progressStatusElement;
let progressMessageElement;
let progressWrapper;
let difficulty;
let audio;
let data;
let map;
let chart;
let analysedBeatmap;
let historyMode = "nps";
let histories = {};
const CHART_OPACITY = "66";
$(document).ready(async function () {

    const args = location.hash.split(",");
    if (args.length < 1) {
        window.location.href = "/";
        return;
    } else if (args.length > 2) {
        difficulty = +args[1];
    }

    const key = args[0].substring(1);
    document.title = "Fetching Map Details...";

    map = await API.getMapDetails(key);
    if (map === 404)
        return;
    console.log(map);

    document.title = `Deep Beat | ${map.name}`;

    // Download map
    progressElement = $("#progress");
    progressStatusElement = $("#progress-status");
    progressMessageElement = $("#progress-message");
    progressWrapper = $(".progress");
    progressWrapper.removeClass("not-loaded");
    const zip = `https://beatsaver.com${map.directDownload}`;
    const blob = await download(zip);

    data = await decodeZippedMap(blob, zip.endsWith(".audica"));
    console.log(data);

    console.log(data.infos._beatsPerMinute)
    analysedBeatmap = new BeatMap(data.mapData, data.infos._beatsPerMinute);
    //console.log(analysedBeatmap);

    // Show song informations
    renderSongHero({
        cover: `https://beatsaver.com${map.coverURL}`,
        title: data.infos._songName,
        mapper: map.uploader.username,
        likes: map.stats.upVotes,
        dislikes: map.stats.downVotes,
        oneclick: `beatsaver://${key}`,
        zip
    })

    renderDifficultyMenu(data.beatmap);
    analyseMapStructure();
    renderBasicMapInfos();

    setupCharts();
    toggleTrend(historyMode);
    addToggleTrendListener();
})


function addToggleTrendListener() {
    const toggleMenu = $("li[id^='graph-toggle-']");

    toggleMenu.each((_, e) => {
        $(e).click(event => {
            const trendType = event.currentTarget.id.replace(/graph-toggle-/g, '');
            $(toggleMenu).removeClass("selected");
            $(event.currentTarget).addClass("selected");
            toggleTrend(trendType);
        })
    });
}

function getComplexityHistory() {
    analysedBeatmap.analyseSaberPath();

    // Readability feature -> cross hands

    // Get angles of hitting notes
    let angles = [];
    let lastSpeed = 0;
    for (let i = 1; i < analysedBeatmap.rightSaberPath.length - 1; i++) {
        const prev = analysedBeatmap.rightSaberPath[i - 1];
        const curr = analysedBeatmap.rightSaberPath[i];
        const next = analysedBeatmap.rightSaberPath[i + 1];
        const angle = BeatMap.getAngleBetweenVectors(curr.x - prev.x, curr.y - prev.y, next.x - curr.x, next.y - curr.y);
        const dist = Math.sqrt((curr.x - next.x) * (curr.x - next.x) + (curr.y - next.y) * (curr.y - next.y));
        const dT = next.time - curr.time;
        const speed = dist / dT;
        const endSpeed = dT >= 0.03 ? speed : lastSpeed;

        angles.push({
            angle: round(angle / (2 * Math.PI), 4),
            time: curr.time,
            speed: endSpeed,
            note: curr
        });

        if (dT >= 0.03)
            lastSpeed = speed;
    }

    // Get angle change (acceleration) between notes
    let lastAngle;
    let dAngles = [];
    let skippedAngles = 0;
    for (const angle of angles) {
        if (lastAngle) {
            if (angle.angle <= 0.1) {
                skippedAngles++;
                continue;
            }
            dAngles.push({
                angle: Math.abs(angle.angle - lastAngle.angle) * 1.5,
                skippedAngles,
                time: angle.time,
                speed: angle.speed,
                note: angle.note
            });
            skippedAngles = 0;
        }
        lastAngle = angle;
    }

    // Calc average angle change and build history for graph
    let lastSongChunkIndex = Infinity;
    let angleHistoryItems = [], speedHistoryItems = [], complexityHistoryItems = [];
    let currentAngleAvg = 0, currentSpeedAvg = 0, currentComplexityAvg = 0;
    let noteCount = 0;
    for (const angle of dAngles) {
        let currentSongChunkIndex = ~~(angle.time * 60 / measureAccuracy);

        if (lastSongChunkIndex !== currentSongChunkIndex) {
            lastSongChunkIndex = currentSongChunkIndex;

            // Vision blockers make it harder to see the notes
            let offset = data.maps[difficulty]._noteJumpStartBeatOffset + 3;
            offset = offset < 0.1 ? 0.1 : offset;
            const VISION_BLOCKER_WEIGHT = 0.4;
            const beatA = angle.time * data.infos._beatsPerMinute / 60;
            const beatB = (angle.time + offset) * data.infos._beatsPerMinute / 60;
            const blockers = analysedBeatmap.getVisionBlockers(beatA, beatB);
            let rightBlockerValue = blockers.right.length * VISION_BLOCKER_WEIGHT;
            if (blockers.left.length > 0 && blockers.right.length > 0) {
                rightBlockerValue += VISION_BLOCKER_WEIGHT;
            }

            angleHistoryItems.push(noteCount === 0 ? 0 : currentAngleAvg * 8 / noteCount);
            speedHistoryItems.push(noteCount === 0 ? 0 : currentSpeedAvg * 1 / noteCount);
            complexityHistoryItems.push(noteCount === 0 ? 0 : currentComplexityAvg * (1 + rightBlockerValue) * 4 / noteCount);

            currentAngleAvg = 0;
            currentSpeedAvg = 0;
            currentComplexityAvg = 0;
            noteCount = 0;
        }

        currentAngleAvg += angle.angle + angle.skippedAngles * 0.2;
        currentSpeedAvg += angle.speed;
        currentComplexityAvg += angle.speed * (angle.angle + angle.skippedAngles * 0.2);
        noteCount++;
    }

    return {
        angleHistoryItems,
        speedHistoryItems,
        complexityHistoryItems
    };
}

let measureAccuracy = 5;
function determineDistribution(items, multiplier) {
    let mins = data.audio.duration / 60;
    let historyItems = [];
    let lastSongChunkIndex = Infinity;
    let currentNoteCount = 0;
    measureAccuracy = ~~((mins / 2 + 1) * 5);

    for (const item of items) {
        let currentSongChunkIndex = ~~(item._time * 60 / data.infos._beatsPerMinute / measureAccuracy);

        if (lastSongChunkIndex !== currentSongChunkIndex) {
            lastSongChunkIndex = currentSongChunkIndex;
            historyItems.push(currentNoteCount * multiplier / measureAccuracy);
            currentNoteCount = 1;
            continue;
        }

        currentNoteCount += item.value == null ? 1 : item.value;
    }

    let dataPoints = Math.ceil(data.audio.duration / measureAccuracy);
    while (historyItems.length < dataPoints) {
        historyItems.push(0);
    }

    return historyItems;
}


function setupCharts() {

    let seconds = 0;
    let labels = [];
    for (const _ of histories.npm) {
        labels.push(formatSecondsToTime(seconds));
        seconds += measureAccuracy;
    }

    const ctx = document.getElementById('chart');
    chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: 'NPS',
                data: histories.npm,
                backgroundColor: '#f03d4d' + CHART_OPACITY,
                borderColor: '#f03d4d',
                borderWidth: 1,
                fill: true
            }]
        },
        options: {
            elements: {
                line: {
                    tension: 0.2,
                    cubicInterpolationMode: "monotone"
                },
                point: {
                    radius: 0
                }
            },
            normalized: true,
            animation: false
        }
    });

    $("#chart-wrapper").removeClass("u-none");
}


function analyseMapStructure() {
    const complexityHistory = getComplexityHistory();
    const vBlockers = analysedBeatmap.getVisionBlockers(-Infinity, Infinity);
    const npmHistory = determineDistribution(analysedBeatmap.notes, 1);
    const jumps = analysedBeatmap.getJumps();

    histories.jumps = jumps;
    histories.npm = npmHistory;
    histories.blockers = vBlockers;
    histories.complexity = complexityHistory;
}

function renderBasicMapInfos() {

    let reqHTML = [];
    for (const req of data.maps[difficulty]._customData._requirements) {
        const link = modLinks[req] ? `href="${modLinks[req]}" target="_blank"` : "";
        reqHTML.push(`<a ${link}>${req}</a>`);
    }
    let requires = reqHTML.length > 0 ? `Requires <span>${reqHTML.join(", ")}</span><br />` : "";

    let min = ~~(~~data.audio.duration / 60);
    let sec = ~~data.audio.duration % 60;
    let starData;
    if (map._diffs != null)
        starData = map._diffs.find(d => d.diff === difficulty);

    $("#map-general-info-wrapper").html(`
        <!-- https://cdn.wes.cloud/beatstar/bssb/v2-all.json -->
        ${requires}<br />

        <div id="map-general-infos">
            <div>
                <div class="u-text-ellipsis">
                    <span class="key-1 u-text-ellipsis">Uploader</span><span class="value-1">${map.uploader.username}</span>
                </div>
                <div>
                    <span class="key-1 u-text-ellipsis">Duration</span><span class="value-1">${min}min ${sec}s</span>
                </div>
                <div>
                    <span class="key-1 u-text-ellipsis">Artist</span><span class="value-1">${data.infos._songAuthorName}</span>
                </div>
                ${data.infos._songSubName ? `
                    <div>
                        <span class="key-1 u-text-ellipsis">Subname</span><span class="value-1">${data.infos._songSubName}</span>
                    </div>
                ` : ``}
                <div>
                    <span class="key-1 u-text-ellipsis">&nbsp;</span>
                </div>
                <div>
                    <span class="key-1 u-text-ellipsis">Notes</span><span class="value-1">${data.mapData._notes.length}</span>
                </div>
                <div>
                    <span class="key-1 u-text-ellipsis">Obstacles</span><span class="value-1">${data.mapData._obstacles.length}</span>
                </div>
                <div>
                    <span class="key-1 u-text-ellipsis">Bombs</span><span class="value-1">${data.mapData._bombs.length}</span>
                </div>
                <div>
                    <span class="key-2 u-text-ellipsis">&nbsp;</span>
                </div>
                <div>
                    <span class="key-3 u-text-ellipsis">Estimated jumps</span><span class="value-1" id="value-jumps">${histories.jumps.jumpsCount}</span>
                </div>
                <div>
                    <span class="key-3 u-text-ellipsis">Vision blockers</span><span class="value-1" id="value-blockers">${histories.blockers.left.length + histories.blockers.right.length}</span>
                </div>
            </div>
            <div>
                ${starData ? `
                    <div>
                        <span class="key-2 u-text-ellipsis">Stars</span><span class="value-2">${round(starData.stars)} <i class="fas fa-star"></i></span>
                    </div>
                ` : ``}
                ${starData ? `
                    <div>
                        <span class="key-2 u-text-ellipsis">Max pp</span><span class="value-2">${round(starData.pp)} <i class="fab fa-pied-piper-pp"></i></span>
                    </div>
                ` : ``}
                <div>
                    <span class="key-2 u-text-ellipsis">&nbsp;</span>
                </div>
                <div>
                    <span class="key-2 u-text-ellipsis">NPS</span><span class="value-2">${round(data.mapData._notes.length / data.audio.duration)}</span>
                </div>
                <div>
                    <span class="key-2 u-text-ellipsis">NJS</span><span class="value-2">${round(data.maps[difficulty]._noteJumpMovementSpeed)}</span>
                </div>
                <div>
                    <span class="key-2 u-text-ellipsis">Offset</span><span class="value-2">${round(data.maps[difficulty]._noteJumpStartBeatOffset)}</span>
                </div>
                <div>
                    <span class="key-2 u-text-ellipsis">BPM</span><span class="value-2">${round(data.infos._beatsPerMinute)}</span>
                </div>
            </div>
        </div>
    `);

}


function toggleTrend(mode) {
    historyMode = mode;

    switch (mode) {
        case 'nps':
            chart.data.datasets = [{
                label: 'NPS',
                data: histories.npm,
                backgroundColor: '#f03d4d' + CHART_OPACITY,
                borderColor: '#f03d4d',
                borderWidth: 1,
                fill: true
            }];
            chart.update();
            break;
        case 'comp':
            chart.data.datasets = [{
                label: 'Complexity',
                data: histories.complexity.complexityHistoryItems,
                backgroundColor: '#f03d4d',
                borderColor: '#f03d4d',
                borderWidth: 1
            }, {
                label: 'Readability (beta)',
                data: histories.complexity.angleHistoryItems,
                backgroundColor: '#5e5cc7' + CHART_OPACITY,
                borderColor: '#5e5cc7',
                borderWidth: 1,
                fill: true
            }];
            chart.update();
            break;
        case 'speed':
            chart.data.datasets = [{
                label: 'Speed',
                data: histories.complexity.speedHistoryItems,
                backgroundColor: '#5e5cc7' + CHART_OPACITY,
                borderColor: '#5e5cc7',
                borderWidth: 1,
                fill: true
            }];
            chart.update();
            break;
        case 'wrists':
            chart.data.datasets = [{
                label: 'Wrists',
                data: histories.jumps.wrists,
                backgroundColor: '#0dd157' + CHART_OPACITY,
                borderColor: '#0dd157',
                borderWidth: 1,
                fill: true
            }, {
                label: 'Jumps',
                data: histories.jumps.historyItems,
                backgroundColor: '#fdd157' + CHART_OPACITY,
                borderColor: '#fdd157',
                borderWidth: 1,
                fill: true
            }];
            chart.update();
            break;
    }
}


async function selectDifficulty(difficultyRank) {
    difficulty = difficultyRank;

    const zip = new JSZip;
    const zipBlob = await zip.loadAsync(data.blob);
    const mapFile = zipBlob.file(data.maps[difficulty]._beatmapFilename);
    const mapString = await mapFile.async("string");
    data.mapData = JSON.parse(mapString);

    // Split bombs and notes
    data.mapData._bombs = data.mapData._notes.filter(n => n._type === 3);
    data.mapData._notes = data.mapData._notes.filter(n => n._type !== 3);

    analysedBeatmap = new BeatMap(data.mapData, data.infos._beatsPerMinute);
    analyseMapStructure();
    renderBasicMapInfos();

    $("#difficulty-menu li").removeClass("selected");
    $(`#difficulty-menu li[data-did="${difficulty}"]`).addClass("selected");

    toggleTrend(historyMode);
}


function renderDifficultyMenu(beatmap) {
    const html = beatmap._difficultyBeatmaps.reduce((acc, cv) => {
        const selected = difficulty === cv._difficultyRank ? `class="selected"` : "";
        const d = cv._customData._difficultyLabel || difficultyDisplayMap[cv._difficulty] || cv._difficulty;
        return acc + `<li data-did="${cv._difficultyRank}" ${selected}><div class="tab-item-content">${d}</div></li>`
    }, "");

    $("#difficulty-menu").html(`<ul>${html}</ul>`);
    $("#difficulty-menu").removeClass("not-loaded");

    beatmap._difficultyBeatmaps.forEach(e => {
        $(`#difficulty-menu li[data-did="${e._difficultyRank}"]`).click(event => {
            selectDifficulty($(event.currentTarget).data("did"));
        });
    });
}

function formatSecondsToTime(sec) {
    let min = ~~(sec / 60);
    let s = sec % 60;
    return `${min < 10 ? "0" + min : min}:${s < 10 ? "0" + s : s}`;
}

function renderSongHero(data) {
    $("#song-hero").html(`
        <div class="song-img">
            <img class="u-circle u-center" src="${data.cover}" />
            <button class="js-listen-mobile btn-small u-center listen-btn">listen</button>
        </div>
        <div>
            <h4>${data.title}</h4>
            <p class="tooltip tooltip--bottom" data-tooltip="${convertDate(map.uploaded)}" style="width: fit-content;">Uploaded by ${data.mapper}</p>
            <span>
                ${data.likes} <i class="fas fa-heart"></i> &nbsp;&nbsp;
                ${data.dislikes} <i class="fas fa-heart-broken"></i>
            </span>
        </div>
        <div class="song-footer" id="install-btn-group">
            <div class="my-2">
            <div class="list-dropdown">
                <div class="btn-group">
                    <button class="btn-primary" onclick="window.location.href = '${data.oneclick}';">Install</button>
                    <button class="btn-primary btn-small btn-dropdown"><i class="fa fa-wrapper fa-caret-down" aria-hidden="true"></i></button>
                    <ul class="menu">
                        <li class="menu-item" id="download-map"><a>Download Map</a></li>
                        <li class="menu-item" id="bsr-copy-btn" data-key="${map.key}"><a>Copy !bsr</a></li>
                    </ul>
                </div>
            </div>
            <div class="my-2">
                <button class="js-listen btn-small listen-btn">listen</button>
            </div>
        </div>
    `);

    $(".listen-btn").click(event => {
        listen(event.currentTarget);
    });

    $("#bsr-copy-btn").click(event => {
        const key = $(event.currentTarget).data("key");
        copyTextToClipboard('!bsr ' + key);
    });

    $("#download-map").click(_ => {
        downloadMap();
    });
}


function setStatus(message, percentage) {
    progressElement.css("width", percentage + "%");
    progressStatusElement.text(percentage + "%");
    progressMessageElement.text(message);

    if (percentage >= 100) {
        progressWrapper.addClass("u-none");
    }
}


function downloadMap() {

    // Create invisible link
    const a = document.createElement("a");
    a.style = "display: none";
    document.body.appendChild(a);

    // Create url and click link
    const url = URL.createObjectURL(data.blob);
    a.href = url;
    a.download = `${map.key} (${data.infos._songName} - ${data.infos._levelAuthorName}).zip`;
    a.click();
    URL.revokeObjectURL(url);
}


async function decodeZippedMap(blob, audica = false) {
    setStatus(`Analysing your map...`, 91);

    const zip = new JSZip;
    const zipBlob = await zip.loadAsync(blob);

    if (audica) {
        const descFile = await zipBlob.file("song.desc").async("string");
        const description = JSON.parse(descFile);
        throw "Audica files are not supported yet";
    } else {
        const infoFile = zipBlob.file("info.dat") || zipBlob.file("Info.dat");
        const infoString = await infoFile.async("string");
        const infos = JSON.parse(infoString);
        setStatus(`Analysing your map...`, 92);

        const beatmap = infos._difficultyBeatmapSets.find(dbs => dbs._beatmapCharacteristicName === "Standard");
        if (!beatmap)
            return;

        // Choose default difficulty
        if (difficulty == null) {
            beatmap._difficultyBeatmaps.reverse();
            const found = beatmap._difficultyBeatmaps.find(db => [9, 7, 5, 3, 1].includes(db._difficultyRank));
            beatmap._difficultyBeatmaps.reverse();
            if (!found)
                return;
            difficulty = found._difficultyRank;
        }

        const maps = {
            1: beatmap._difficultyBeatmaps.find(db => db._difficultyRank === 1),
            3: beatmap._difficultyBeatmaps.find(db => db._difficultyRank === 3),
            5: beatmap._difficultyBeatmaps.find(db => db._difficultyRank === 5),
            7: beatmap._difficultyBeatmaps.find(db => db._difficultyRank === 7),
            9: beatmap._difficultyBeatmaps.find(db => db._difficultyRank === 9),
        }

        const mapFile = zipBlob.file(maps[difficulty]._beatmapFilename);
        const mapString = await mapFile.async("string");
        const mapData = JSON.parse(mapString);
        setStatus(`Analysing your map...`, 94);

        audio = await API.getAudioBlob(zipBlob);
        setStatus(`Analysing your map...`, 100);

        // Split bombs and notes
        mapData._bombs = mapData._notes.filter(n => n._type === 3);
        mapData._notes = mapData._notes.filter(n => n._type !== 3);

        return {
            infos,
            maps,
            beatmap,
            mapData,
            audio,
            blob
        }
    }
}


async function download(url) {
    const response = await fetch(url);
    const reader = response.body.getReader();
    const contentLength = +response.headers.get('content-length');

    let receivedLength = 0;
    let chunks = [];
    let i = 0;
    while (true) {
        const { done, value } = await reader.read();

        if (done)
            break;

        chunks.push(value);
        receivedLength += value.length;

        if (i % 100 === 0) {
            const progress = round(receivedLength * 90 / contentLength);
            setStatus(`Downloading map ${bytesToSize(receivedLength)} of ${bytesToSize(contentLength)}`, progress);
        }
        i++;
    }
    setStatus(`Downloading map ${bytesToSize(contentLength)} of ${bytesToSize(contentLength)}`, 90);

    // Concatenate chunks into single Uint8Array
    const chunksAll = new Uint8Array(receivedLength);
    let position = 0;
    for (const chunk of chunks) {
        chunksAll.set(chunk, position);
        position += chunk.length;
    }

    return new Blob([chunksAll]);
}


/**
 * Runs when user clicked on "listen"
 */
let playing = false;
function listen(me) {

    // If the button that has been click was playing: Stop the song
    if (playing)
        songFinished(me);

    // If nothing is playing, just start the song
    else
        songStarted(me);
}


/**
 * Handles logic for audio preview start
 */
async function songStarted(e) {
    await audio.play();
    $(e).text("Stop");
    $(e).removeClass("animated loading hide-text");
    playing = true;
}


/**
 * Handles logic for audio preview end/stop
 */
function songFinished() {
    audio.pause();
    audio.currentTime = data.infos._previewStartTime;
    $(".js-listen").text("Listen");
    playing = false;
}

function fallbackCopyTextToClipboard(text) {
    var textArea = document.createElement("textarea");
    textArea.value = text;

    // Avoid scrolling to bottom
    textArea.style.top = "0";
    textArea.style.left = "0";
    textArea.style.position = "fixed";

    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    try {
        var successful = document.execCommand('copy');
        var msg = successful ? 'successful' : 'unsuccessful';
        console.log('Fallback: Copying text command was ' + msg);
    } catch (err) {
        console.error('Fallback: Oops, unable to copy', err);
    }

    document.body.removeChild(textArea);
}


function copyTextToClipboard(text) {
    if (!navigator.clipboard) {
        fallbackCopyTextToClipboard(text);
        return;
    }
    navigator.clipboard.writeText(text).then(function () {
        console.log('Async: Copying to clipboard was successful!');
    }, function (err) {
        console.error('Async: Could not copy text: ', err);
    });
}



class Saber {

    constructor(initialChunk) {

        // Set starting position
        this.position = BeatMap.getNoteBehind(initialChunk[0]._lineIndex, initialChunk[0]._lineLayer, initialChunk[0]._cutDirection);

    }


    traverse(chunk) {
        this.position = chunk.path[chunk.path.length - 1];
    }


}

class BeatMap {

    constructor(rawData) {
        this.notes = rawData._notes.filter(n => n._type !== 3);
        this.leftNotes = this.notes.filter(n => n._type === 0);
        this.rightNotes = this.notes.filter(n => n._type === 1);
        this.bombs = rawData._notes.filter(n => n._type === 3);

        this.chunkedDataLeft = this.normalize(this.leftNotes);
        this.chunkedDataRight = this.normalize(this.rightNotes);

        this.leftBlockers = this.notes.filter(n => n._lineIndex === 1 && n._lineLayer === 1);
        this.rightBlockers = this.notes.filter(n => n._lineIndex === 2 && n._lineLayer === 1);

        this.sortedRightNotes = this.chunkedDataRight.flat();
        this.sortedLeftNotes = this.chunkedDataLeft.flat();
    }


    getJumps() {

        let jumps = {
            left: [],
            right: []
        };
        let wristsUsage = [];
        for (let i = 0; i < this.sortedRightNotes.length - 1; i++) {

            const dA = BeatMap.getAngleBetweenDirectionCodes(this.sortedRightNotes[i], this.sortedRightNotes[i + 1])
            const dX = this.sortedRightNotes[i]._lineIndex - this.sortedRightNotes[i + 1]._lineIndex;
            const dY = this.sortedRightNotes[i]._lineLayer - this.sortedRightNotes[i + 1]._lineLayer;
            const dBeat = this.sortedRightNotes[i + 1]._time - this.sortedRightNotes[i]._time;
            const dTime = BeatMap.beatToTime(dBeat);
            const dist = Math.sqrt(dX * dX + dY * dY);

            if (((dA > .374 && dist > 2.5) || (dist > 1.9 && dA >= .49)) && dTime < .15) {
                jumps.right.push(this.sortedRightNotes[i]);
                wristsUsage.push(Object.assign(this.sortedRightNotes[i], {
                    value: dist * ((.3 - dTime) * 6) + (.5 - dA)
                }));
            }
        }

        for (let i = 0; i < this.sortedLeftNotes.length - 1; i++) {

            const dA = BeatMap.getAngleBetweenDirectionCodes(this.sortedLeftNotes[i], this.sortedLeftNotes[i + 1])
            const dX = this.sortedLeftNotes[i]._lineIndex - this.sortedLeftNotes[i + 1]._lineIndex;
            const dY = this.sortedLeftNotes[i]._lineLayer - this.sortedLeftNotes[i + 1]._lineLayer;
            const dBeat = this.sortedLeftNotes[i + 1]._time - this.sortedLeftNotes[i]._time;
            const dTime = BeatMap.beatToTime(dBeat);
            const dist = Math.sqrt(dX * dX + dY * dY);

            if (((dA > .374 && dist > 2.5) || (dist > 1.9 && dA >= .49)) && dTime < .15) {
                jumps.left.push(this.sortedLeftNotes[i]);
                wristsUsage.push(Object.assign(this.sortedLeftNotes[i], {
                    value: dist * ((.3 - dTime) * 6) + (.5 - dA)
                }));
            }
        }

        // Filter out alone standing jumps and keep jumps in streams
        const allJumps = jumps.right.concat(jumps.left).sort((a, b) => a._time - b._time);
        let lastJumpTime = 0;
        let jumpStreams = [];
        for (const jumpNote of allJumps) {

            const currentJumpTime = BeatMap.beatToTime(jumpNote._time);
            if ((currentJumpTime - lastJumpTime) < 0.5) {
                jumpStreams.push(jumpNote);
            }

            lastJumpTime = currentJumpTime;
        }

        return {
            historyItems: determineDistribution(jumpStreams, 1),
            wrists: determineDistribution(wristsUsage, 2),
            jumpsCount: jumpStreams.length
        }
    }


    getVisionBlockers(from, to) {

        const leftBlockers = this.leftBlockers.filter(n => n._time > from && n._time < to);
        const rightBlockers = this.rightBlockers.filter(n => n._time > from && n._time < to);

        return {
            left: leftBlockers,
            right: rightBlockers
        }

    }


    analyseSaberPath() {
        const rightSaber = new Saber(this.chunkedDataRight[0]);
        const leftSaber = new Saber(this.chunkedDataLeft[0]);
        this.rightSaberPath = this.determineSaberPath(rightSaber);
        this.leftSaberPath = this.determineSaberPath(leftSaber);
    }


    determineSaberPath(saber) {
        let saberPath = [saber.position];

        for (const chunk of this.chunkedDataRight) {
            if (saberPath.length === 1)
                saberPath[0].time = 0;

            const orderedChunk = this.orderChunk(chunk, saber.position);
            saber.traverse(orderedChunk);
            orderedChunk.path.shift();
            saberPath = saberPath.concat(orderedChunk.path);
        }

        return saberPath;
    }

    orderChunk(chunk, saberPosition) {

        let minAngle = Infinity;
        let bestPermutation, bestTraversal;
        const chunkPermutations = this.permutations(chunk);
        for (const permutation of chunkPermutations) {

            const position = saberPosition || {
                x: permutation[0]._lineIndex,
                y: permutation[0]._lineLayer,
            };

            const traversalResults = this.traverseChunk(permutation, position);
            if (minAngle > traversalResults.sumAngle) {
                minAngle = traversalResults.sumAngle;
                bestTraversal = traversalResults.traversal;
                bestPermutation = permutation;
            }
        }

        return {
            angle: minAngle,
            chunk: bestPermutation,
            path: bestTraversal
        };
    }


    traverseChunk(chunk, startingPosition) {

        const traversal = [{
            x: startingPosition.x,
            y: startingPosition.y
        }];
        for (const note of chunk) {

            // If this is the first note add time to starting position
            if (traversal.length === 1) {
                traversal[0].time = BeatMap.beatToTime(note._time);
            }

            traversal.push({
                x: note._lineIndex,
                y: note._lineLayer,
                time: BeatMap.beatToTime(note._time)
            });

            if (note._cutDirection === 8)
                continue;

            // Append the position after the current note
            const after = this.getNoteAfter(note._lineIndex, note._lineLayer, note._cutDirection);
            traversal.push({
                x: after.x,
                y: after.y,
                time: BeatMap.beatToTime(note._time)
            });
        }

        let lastTravPos;
        let uniqueTraversal = [];
        for (const pos of traversal) {

            if (lastTravPos != null && pos.x === lastTravPos.x && pos.y === lastTravPos.y)
                continue;

            uniqueTraversal.push(pos);
            lastTravPos = pos;
        }

        let totalAngleChanges = 0;
        for (let i = 0; i < uniqueTraversal.length - 2; i++) {
            const dXA = uniqueTraversal[i + 1].x - uniqueTraversal[i].x;
            const dYA = uniqueTraversal[i + 1].y - uniqueTraversal[i].y;
            const dXB = uniqueTraversal[i + 2].x - uniqueTraversal[i + 1].x;
            const dYB = uniqueTraversal[i + 2].y - uniqueTraversal[i + 1].y;
            const dA = BeatMap.getAngleBetweenVectors(dXA, dYA, dXB, dYB);
            totalAngleChanges += dA;
        }

        return {
            traversal: uniqueTraversal,
            sumAngle: totalAngleChanges < 0.001 ? 0 : totalAngleChanges
        }
    }


    static getAngleBetweenVectors(x1, y1, x2, y2) {
        const angle = Math.acos((x1 * x2 + y1 * y2) / (Math.sqrt(x1 * x1 + y1 * y1) * Math.sqrt(x2 * x2 + y2 * y2)));
        return angle < 0.001 ? 0 : angle;
    }


    /**
     * Returns the position of saber before hitting the block (behind the block)
     * Its the position where the saber needs to go to make a good cut
     */
    static getNoteBehind(x, y, dir) {
        switch (dir) {
            case 0: return {
                x, y: y - 1
            }
            case 1: return {
                x, y: y + 1
            }
            case 2: return {
                x: x + 1, y
            }
            case 3: return {
                x: x - 1, y
            }
            case 4: return {
                x: x + 1, y: y - 1
            }
            case 5: return {
                x: x - 1, y: y - 1
            }
            case 6: return {
                x: x + 1, y: y + 1
            }
            case 7: return {
                x: x - 1, y: y + 1
            }
            default: return {
                x, y
            }
        }
    }


    getNoteAfter(x, y, dir) {
        switch (dir) {
            case 0: return {
                x, y: y + 1
            }
            case 1: return {
                x, y: y - 1
            }
            case 2: return {
                x: x - 1, y
            }
            case 3: return {
                x: x + 1, y
            }
            case 4: return {
                x: x - 1, y: y + 1
            }
            case 5: return {
                x: x + 1, y: y + 1
            }
            case 6: return {
                x: x - 1, y: y - 1
            }
            case 7: return {
                x: x + 1, y: y - 1
            }
            default: return {
                x, y
            }
        }
    }


    static getAngleBetweenDirectionCodes(noteA, noteB) {

        // Get angle difference
        const angles = [0, .5, .25, .25, .125, .125, .375, .375, 0];
        let dirA = noteA._cutDirection;
        let dirB = noteB._cutDirection;

        return Math.abs(angles[dirB] - angles[dirA]);
    }


    /**
     * Returns all permutation of a given array (without repetition)
     */
    permutations(xs) {
        let ret = [];

        for (let i = 0; i < xs.length; i = i + 1) {
            let rest = this.permutations(xs.slice(0, i).concat(xs.slice(i + 1)));

            if (!rest.length)
                ret.push([xs[i]])
            else
                for (let j = 0; j < rest.length; j = j + 1)
                    ret.push([xs[i]].concat(rest[j]))
        }
        return ret;
    }


    normalize(notes) {
        let lastNoteTime = 0;
        let chunk = [];
        let chunks = [];
        for (const note of notes) {
            if (note._time !== lastNoteTime && chunk.length > 0) {
                chunks.push(chunk);
                chunk = [];
            }
            chunk.push(note);
            lastNoteTime = note._time;
        }
        return chunks;
    }


    static beatToTime(beat) {
        return +beat * 60 / data.infos._beatsPerMinute;
    }


}

