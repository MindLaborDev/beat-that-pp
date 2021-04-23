"use strict";

const songsTable = {};
const WEIGHT_THRESHOLD = 0.85;
const STEPS = 11;
let step = 0;

$(document).ready(async function () {

    if (location.hash.length < 2) {
        window.location.href = "/";
        return;
    }

    // Show progress
    $(".progress").removeClass("u-none");

    const username = location.hash.substring(1);

    setStatus("Searching player");
    const playerId = await API.getPlayerId(username);

    setStatus("Fetching player stats");
    const player = await API.getPlayerData(playerId);

    setStatus("Fetching played map stats");
    const scores = await API.getScores(playerId, 1);
    const data = await buildRenderingData(player, scores);

    renderPlayer(data.player);
    renderSongs(data.songs);
})


async function buildRenderingData(player, scores) {
    const data = {
        player: player,
        songs: []
    }

    for (const i in scores) {
        const score = scores[i];

        setStatus(`Fetching song data (${+i + 1} of 8)`);
        const song = await API.getSongData(score.songHash, score.difficulty);
        const songData = Object.assign(song, score);
        console.log("score", songData);

        songData.author = songData.levelAuthorName;
        songData.pp = round(songData.pp);
        songData.njsOffset = round(songData.njsOffset);
        songData.durationMin = ~~(song.length / 60);
        songData.durationSec = song.length % 60;
        songData.color = difficulties[difficultiesMap[song.difficulty]]["color"];
        songData.difficultyDisplay = difficulties[difficultiesMap[song.difficulty]]["display"];
        songData.accuracy = round(score.score * 100 / score.maxScore);
        songData.weightedPP = round(score.weight * score.pp);
        songData.weightDisplay = round(score.weight * 100);
        songData.oneclick = `beatsaver://${songData.key}`;
        songData.nps = round(song.notes / song.length);
        data.songs.push(songData);
    }

    return data;
}


/**
 * Generates the html and shows it
 */
function renderSongs(songs) {
    const songsWrapper = $("#songs");

    for (const song of songs) {
        const html = generateSongTile(song);
        songsWrapper.append(html);
    }
}


/**
 * Generates the html and shows it
 */
function renderPlayer(player) {
    $("#player").html(generatePlayerProfile(player));
}


/**
 * Sets the progress bar message and value
 */
function setStatus(message) {
    step++;
    $("#progress").css("width", ~~(step / STEPS * 100) + "%");
    $("#progress-status").text(~~(step / STEPS * 100) + "%");
    $("#progress-message").text(message + `...`);

    if (~~(step / STEPS * 100) >= 100) {
        $("#generate-playlist").removeClass("loading hide-text");
        $(".progress").addClass("u-none");
    }
}

function generatePlayerProfile(player) {
    console.log(player);
    return `
        <figure class="avatar avatar--xlarge">
            <img src="https://new.scoresaber.com${clean(player.avatar)}">
        </figure>
        <h6 class="mb-0 mt-1 u-text-center">
            ${clean(player.playerName)}
        </h6>
        <div>
            <div class="u-flex mt-2" style="width: fit-content; margin: auto;" class="mt-1">
                <div class="tag-container group-tags mx-1 mb-0">
                    <div class="tag tag--dark"><img src="/assets/globe.png" width="16" height="16" /></div>
                    <div class="tag tag--link">#${clean(player.rank)}</div>
                </div>
                <div class="tag-container group-tags mx-1 mb-0">
                    <div class="tag tag--dark"><img src="https://scoresaber.com/imports/images/flags/${clean(player.country.toLowerCase())}.png" width="16" height="16" /></div>
                    <div class="tag tag--link">#${clean(player.countryRank)}</div>
                </div>
            </div>
            <div class="tag-container group-tags mb-0" style="width: fit-content; margin: auto;">
                <div class="tag tag--dark">PP</div>
                <div class="tag tag--link">${clean(round(player.pp))}</div>
            </div>
        </div>
    `;
}

function generateSongTile(song) {
    return `
    <div class="tile my-4 hover-grow">
        <div class="tile__icon mr-2">
            <figure class="avatar"><img src="${clean(song.cover)}" /></figure>
            <div class="tag tag--link mt-1">${clean(song.pp)}pp</div><br />
            <div class="tag">${clean(song.durationMin)}m ${clean(song.durationSec)}s</div><br />
        </div>
        <div class="tile__container">
            <lead class="tile__title m-0 truncate font-bold">${clean(song.name)}</lead>
            <p class="tile__subtitle m-0 truncate">
                <span>
                    <div class="tag tag--${clean(song.color)} mb-2">${clean(song.difficultyDisplay)}</div>
                    <div class="tag tag--${clean(song.color)} ml-1 mb-2 tooltip tooltip--right" data-tooltip="Accuracy">${clean(song.accuracy)}%</div><br />
                </span>
                <div id="song-data-table" class="col">
                    <div class="tooltip tooltip--right truncate" data-tooltip="Authors username">
                        ${clean(song.author) ? `<b class="info-category font-semibold">Mapper:</b>${clean(song.author)}` : ``}
                    </div>
                    <div class="tooltip tooltip--right truncate" data-tooltip="Average Notes per second">
                        ${clean(song.nps) ? `<b class="info-category font-semibold">NPS:</b>${clean(song.nps)}` : ``}
                    </div>
                    <div class="tooltip tooltip--right truncate" data-tooltip="Note Jump Speed">
                        ${clean(song.njs) ? `<b class="info-category font-semibold">NJS:</b>${clean(song.njs)}` : ``}
                    </div>
                    <div class="tooltip tooltip--right truncate" data-tooltip="Note Jump Offset">
                        ${clean(song.njsOffset) ? `<b class="info-category font-semibold">Offset:</b>${clean(song.njsOffset)}` : ``}
                    </div>
                    <div>
                        <b class="info-category font-semibold">Weighted PP:</b>${clean(song.weightedPP)} <small class="tag tag--white">(${clean(song.weightDisplay)}%)</small>
                    </div>
                </div>
            </p>
        </div>
        <div class="tile__buttons m-0">
            <button class="btn-small uppercase" onclick="preview('${clean(song.key)}')">Preview Map</button>
            <button class="js-listen btn-small" data-key="${clean(song.key)}" onclick="listen(this, '${clean(song.zip)}')">listen</button>
            <a href="${clean(song.zip)}"><button class="btn-primary btn-small uppercase">Download</button></a>
            <a href="${clean(song.oneclick)}"><button class="btn-primary btn-small uppercase">Install</button></a>
        </div>
    </div>`;
}
