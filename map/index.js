"use strict";


let progressElement;
let progressStatusElement;
let progressMessageElement;
let progressWrapper;
let difficulty;
$(document).ready(async function () {

    const args = location.hash.split(",");
    if (args.length < 2) {
        //window.location.href = "/";
        return;
    }

    const key = args[0].substring(1);
    difficulty = +args[1];

    const map = await API.getMapDetails(key);
    if (map === 404)
        return;
    //console.log(map);

    // Download map
    progressElement = $("#progress");
    progressStatusElement = $("#progress-status");
    progressMessageElement = $("#progress-message");
    progressWrapper = $(".progress");
    progressWrapper.removeClass("not-loaded");
    const zip = `https://beatsaver.com${map.directDownload}`;
    const blob = await download(zip);

    const data = await decodeZippedMap(blob, zip.endsWith(".audica"));
    console.log(data);

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
    renderBasicMapInfos(data, map);

})


function renderBasicMapInfos(data, map) {

    let reqHTML = [];
    for (const req of data.map._customData._requirements) {
        const link = modLinks[req] ? `href="${modLinks[req]}" target="_blank"` : "";
        reqHTML.push(`<a ${link}>${req}</a>`);
    }
    let requires = reqHTML.length > 0 ? `Requires <span>${reqHTML.join(", ")}</span><br />` : "";

    let min = ~~(~~data.audio.duration / 60);
    let sec = ~~data.audio.duration % 60;

    $("#map-general-info-wrapper").html(`
        <!-- https://cdn.wes.cloud/beatstar/bssb/v2-all.json -->
        Version <span>${data.infos._version}</span> <span class="date pl-1">(${convertDate(map.uploaded)})</span><br />
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
                    <span class="key-1 u-text-ellipsis">Author</span><span class="value-1">${data.infos._songAuthorName}</span>
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
                <div>
                    <span class="key-2 u-text-ellipsis">Star difficulty</span><span class="value-2">??</span>
                </div>
                <div>
                    <span class="key-2 u-text-ellipsis">Notes per second</span><span class="value-2">${round(data.mapData._notes.length / data.audio.duration)}</span>
                </div>
                <div>
                    <span class="key-2 u-text-ellipsis">Note jump speed</span><span class="value-2">${round(data.map._noteJumpMovementSpeed)}</span>
                </div>
                <div>
                    <span class="key-2 u-text-ellipsis">Note beat offset</span><span class="value-2">${round(data.map._noteJumpStartBeatOffset)}</span>
                </div>
                <div>
                    <span class="key-2 u-text-ellipsis">Beats per minute</span><span class="value-2">${round(data.infos._beatsPerMinute)}</span>
                </div>
                <div>
                    <span class="key-2 u-text-ellipsis">&nbsp;</span>
                </div>
                <div>
                    <span class="key-2 u-text-ellipsis">Max pp</span><span class="value-2">??</span>
                </div>
                <div>
                    <span class="key-2 u-text-ellipsis">Max score</span><span class="value-2">??</span>
                </div>
            </div>
        </div>
    `);
}


function renderDifficultyMenu(beatmap) {
    const html = beatmap._difficultyBeatmaps.reduce((acc, cv) => {
        const selected = difficulty === cv._difficultyRank ? `class="selected"` : "";
        const d = difficultyDisplayMap[cv._difficulty] || cv._difficulty;
        return acc + `<li data-did="${cv._difficultyRank}" ${selected}><div class="tab-item-content">${d}</div></li>`
    }, "");

    $("#difficulty-menu").html(`<ul>${html}</ul>`);
    $("#difficulty-menu").removeClass("not-loaded");
}


function renderSongHero(data) {
    $("#song-hero").html(`
        <div class="song-img">
            <img class="u-circle" src="${data.cover}" importance="high" />
        </div>
        <div>
            <h4>${data.title}</h4>
            <p>Uploaded by ${data.mapper}</p>
            <span>
                ${data.likes} <i class="fas fa-heart"></i> &nbsp;&nbsp;
                ${data.dislikes} <i class="fas fa-heart-broken"></i>
            </span>
        </div>
        <div class="song-footer">
            <div class="my-2">
                <a class="p-0" href="${data.oneclick}">
                    <button class="btn-primary btn-small uppercase">Install</button>
                </a>
            </div>
            <div class="my-2">
                <button class="js-listen btn-small" data-key="${data.key}" onclick="listen(this, '${data.zip}')">listen</button>
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

        const map = beatmap._difficultyBeatmaps.find(db => db._difficultyRank === difficulty);
        if (!map)
            return;

        const mapFile = zipBlob.file(map._beatmapFilename);
        const mapString = await mapFile.async("string");
        setStatus(`Analysing your map...`, 94);
        
        const mapData = JSON.parse(mapString);
        const audio = await API.getAudioBlob(zipBlob);
        setStatus(`Analysing your map...`, 100);

        // Split bombs and notes
        mapData._bombs = mapData._notes.filter(n => n._type === 3);
        mapData._notes = mapData._notes.filter(n => n._type !== 3);

        return {
            infos,
            map,
            beatmap,
            mapData,
            audio
        }
    }
}


async function download(url) {
    const response = await fetch(url, { importance: "low" });
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