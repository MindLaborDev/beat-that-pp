"use strict";


let progressElement;
let progressStatusElement;
let progressMessageElement;
let progressWrapper;
let difficulty;
$(document).ready(async function () {

    const args = location.hash.split("#");
    if (args.length < 3) {
        window.location.href = "/";
        return;
    }

    const key = args[1];
    difficulty = +args[2];

    const map = await API.getMapDetails(key);
    if (map === 404)
        return;
    console.log(map);



    // Download map
    progressElement = $("#progress");
    progressStatusElement = $("#progress-status");
    progressMessageElement = $("#progress-message");
    progressWrapper = $(".progress");
    progressWrapper.removeClass("not-loaded");
    const zip = `https://beatsaver.com${map.directDownload}`;
    const blob = await download(zip);
    const data = await decodeZippedMap(blob, zip.endsWith(".audica"));

    // Show song informations
    renderSongHero({
        cover: `https://beatsaver.com${map.coverURL}`,
        title: map.name,
        mapper: map.metadata.levelAuthorName,
        likes: map.stats.upVotes,
        dislikes: map.stats.downVotes,
        oneclick: `beatsaver://${key}`,
        zip
    })

    renderDifficultyMenu();

    console.log(data);
})


function renderDifficultyMenu() {
    $(`#difficulty-menu li`).removeClass("selected");
    $(`#difficulty-menu li[data-did="${difficulty}"]`).addClass("selected");
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

        const beatmap = infos._difficultyBeatmapSets.find(dbs => dbs._beatmapCharacteristicName === "Standard");
        if (!beatmap)
            return;

        const map = beatmap._difficultyBeatmaps.find(db => db._difficultyRank === difficulty);
        if (!map)
            return;

        const mapFile = zipBlob.file(map._beatmapFilename);
        const mapString = await mapFile.async("string");
        const mapData = JSON.parse(mapString);

        return {
            infos,
            map,
            mapData
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
            const progress = round(receivedLength * 100 / contentLength);
            setStatus(`Downloading map ${bytesToSize(receivedLength)} of ${bytesToSize(contentLength)}`, progress);
        }
        i++;
    }
    setStatus(`Downloading map ${bytesToSize(contentLength)} of ${bytesToSize(contentLength)}`, 100);

    // Concatenate chunks into single Uint8Array
    const chunksAll = new Uint8Array(receivedLength);
    let position = 0;
    for (const chunk of chunks) {
        chunksAll.set(chunk, position);
        position += chunk.length;
    }

    return new Blob([chunksAll]);
}