"use strict";

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

    analysedBeatmap = new BeatMap(data.mapData, data.infos._beatsPerMinute);

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
    renderBasicMapInfos();

    const npmHistory = getNPMHistory();
    setupCharts(npmHistory);

})


function getNPMHistory() {

    let historyItems = [];
    let lastSongChunkIndex = Infinity;
    let currentNoteCount = 0;

    for (const note of analysedBeatmap.notes) {
        let currentSongChunkIndex = ~~(note._time * 60 / analysedBeatmap.bpm / 5);

        if (lastSongChunkIndex !== currentSongChunkIndex) {
            lastSongChunkIndex = currentSongChunkIndex;
            historyItems.push(currentNoteCount / 5);
            currentNoteCount = 1;
            continue;
        }

        currentNoteCount++;
    }

    return historyItems;
}


function setupCharts(npmHistory) {

    let seconds = 0;
    let labels = [];
    for (const npmItem of npmHistory) {
        seconds += 5;
        labels.push(seconds + "s");
    }
    
    const ctx = document.getElementById('chart');
    chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: 'Notes per second',
                data: npmHistory,
                backgroundColor: '#f03d4d',
                borderColor: '#f03d4d',
                borderWidth: 1
            }]
        },
        options: {
            scales: {
                y: {
                    beginAtZero: true
                }
            },
            elements: {
                line: {
                    tension: 0.2,
                    cubicInterpolationMode: "monotone"
                }
            },
            normalized: true,
            animation: false
        }
    });

    $("#chart-wrapper").removeClass("u-none");
}

function rerenderCharts() {
    analysedBeatmap = new BeatMap(data.mapData, data.infos._beatsPerMinute);
    const npmHistory = getNPMHistory();
    chart.data.datasets[0].data = npmHistory;
    chart.update();
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

    renderBasicMapInfos();

    $("#difficulty-menu li").removeClass("selected");
    $(`#difficulty-menu li[data-did="${difficulty}"]`).addClass("selected");

    rerenderCharts();
}


function renderDifficultyMenu(beatmap) {
    const html = beatmap._difficultyBeatmaps.reduce((acc, cv) => {
        const selected = difficulty === cv._difficultyRank ? `class="selected"` : "";
        const d = cv._customData._difficultyLabel || difficultyDisplayMap[cv._difficulty] || cv._difficulty;
        return acc + `<li data-did="${cv._difficultyRank}" ${selected} onclick="selectDifficulty(${cv._difficultyRank})"><div class="tab-item-content">${d}</div></li>`
    }, "");

    $("#difficulty-menu").html(`<ul>${html}</ul>`);
    $("#difficulty-menu").removeClass("not-loaded");
}

function renderSongHero(data) {
    $("#song-hero").html(`
        <div class="song-img">
            <img class="u-circle u-center" src="${data.cover}" />
            <button class="js-listen-mobile btn-small u-center" onclick="listen(this)">listen</button>
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
                        <li class="menu-item" onclick="downloadMap()"><a>Download Map</a></li>
                        <li class="menu-item" onclick="copyTextToClipboard('!bsr ${map.key}')"><a>Copy !bsr</a></li>
                    </ul>
                </div>
            </div>
            <div class="my-2">
                <button class="js-listen btn-small" onclick="listen(this)">listen</button>
            </div>
        </div>
    `);
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
    a.download = `(${map.key}) - ${data.infos._songName}.zip`;
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

    constructor(rawData, bpm) {
        this.bpm = bpm;
        this.notes = rawData._notes.filter(n => n._type !== 3);
        this.leftNotes = this.notes.filter(n => n._type === 0);
        this.rightNotes = this.notes.filter(n => n._type === 1);
        this.bombs = rawData._notes.filter(n => n._type === 3);

        this.chunkedDataLeft = this.normalize(this.leftNotes);
        this.chunkedDataRight = this.normalize(this.rightNotes);

        const rightSaber = new Saber(this.chunkedDataRight[0]);
        const rightSaberPath = this.determineSaberPath(rightSaber);

        const leftSaber = new Saber(this.chunkedDataLeft[0]);
        const leftSaberPath = this.determineSaberPath(leftSaber);

        //console.log(rightSaberPath);
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

        //console.log("Chunk");

        let minAngle = Infinity;
        let bestPermutation, bestTraversal;
        const chunkPermutations = this.permutations(chunk);
        for (const permutation of chunkPermutations) {
            //console.log(permutation[0]._time);
            //console.log(permutation.map(n => `${n._lineIndex} : ${n._lineLayer} (${n._cutDirection})`));

            const position = saberPosition || {
                x: permutation[0]._lineIndex,
                y: permutation[0]._lineLayer,
            };

            const traversalResults = this.traverseChunk(permutation, position);
            //console.log(traversalResults);
            //console.log();
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
            const dA = this.getAngleBetweenVectors(dXA, dYA, dXB, dYB);
            totalAngleChanges += dA;
        }

        return {
            traversal: uniqueTraversal,
            sumAngle: totalAngleChanges < 0.001 ? 0 : totalAngleChanges
        }
    }


    getAngleBetweenVectors(x1, y1, x2, y2) {
        return Math.acos((x1 * x2 + y1 * y2) / (Math.sqrt(x1 * x1 + y1 * y1) * Math.sqrt(x2 * x2 + y2 * y2)));
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
        //console.log(this.bpm);
        return +beat * 60 / +this.bpm;
    }


}

