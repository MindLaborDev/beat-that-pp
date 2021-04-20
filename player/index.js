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

        setStatus(`Fetching song data (${+i+1} of 8)`);
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
            <button class="js-listen btn-small" data-key="${clean(song.key)}" onclick="listen(this, '${clean(song.zip)}')">listen</button>
            <a href="${clean(song.oneclick)}"><button class="btn-primary btn-small uppercase">Install</button></a>
        </div>
    </div>`;
}


function clean(string) {
    return `${string}`.replace(/<[^>]+>/g, '');
}


function round(number) {
    return ~~(number * 100) / 100;
}


function listen(me, url) {

    // If programm fetches the song don't iterrupt anything
    if (fetching)
        return;

    const amIPlaying = $(me).attr("data-key") === playingSong;

    // If the button that has been click was playing: Stop the song
    if (amIPlaying) {
        songFinished(me);
        currentPlayedButton = null;
    }

    // If user clicked on another button wihtout stopping the last one
    if (playing && !amIPlaying) {
        songFinished();
        previewSong(me, url);
        currentPlayedButton = me;
    }

    // If nothing is playing, just start the song
    if (!playing) {
        previewSong(me, url);
        currentPlayedButton = me;
    }
}



/**
 * Snagged from beastsaber.com
 */
let audio = new Audio;
let playing = false;
let playingSong = "";
let fetching = false;
let currentPlayedButton = null;
audio.volume = .2;
let previewSong = (() => {
    let e = async (blob, startTime) => {
        console.log(e);
        audio.src = URL.createObjectURL(blob);
        audio.currentTime = startTime;
        await audio.play();
        songStarted(currentPlayedButton);
    }
    let t = async t => {
        t.endsWith(".audica") && (t = `https://bsaber-cors-anywhere.herokuapp.com/${t}`);
        let n = await fetch(t);
        if (200 == n.status) {
            let a = new JSZip
            let o = await a.loadAsync(n.blob());
            t.endsWith(".audica") ? (async t => {
                let n = await t.file("song.desc").async("string")
                let a = JSON.parse(n)
                let o = a.moggSong
                let r = o.substring(0, o.length - 4)
                let i = await t.file(r).async("uint8array")
                let s = Array.from(i.slice(4, 8));
                s = (s = s.map(e => {
                    let t = e.toString(16);
                    return 1 == t.length && (t = "0" + t),
                        t
                }
                )).reverse(),
                    s = parseInt(s.join(""), 16);
                let c = i.slice(s, i.size)
                let l = new Blob([c], {
                    type: "application/ogg"
                })
                let d = a.previewStartSeconds;
                await e(l, d)
            }
            )(o) : (async t => {
                let n = t.file("info.dat") || t.file("Info.dat")
                let a = await n.async("string")
                let o = JSON.parse(a)
                let r = o._songFilename
                let i = await t.file(r).async("blob")
                let s = o._previewStartTime;
                await e(i, s)
            }
            )(o)
        }
    }

    return async (e, n) => {
        if (audio.pause(), "playing" == e.dataset.state)
            e.dataset.state = "";
        else {
            for (const e of document.querySelectorAll(".js-listen"))
                e.dataset.state = "";

            fetching = true
            e.dataset.state = "loading"
            $(e).addClass("animated loading hide-text");
            t(n).then(() => {

                // Add finished event listener
                audio.addEventListener("ended", () => songFinished(e));
            })
        }
    }
}
)();
/**
 * Snagged from beastsaber.com
 */



function songStarted(e) {
    $(e).text("Stop");
    $(e).removeClass("animated loading hide-text");

    e.dataset.state = "playing";
    playing = true;
    playingSong = $(e).attr("data-key");
    fetching = false;
}


function songFinished() {
    audio.pause();
    audio.currentTime = 0;
    $(".js-listen").text("Listen");

    playing = false;
    playingSong = "";
    fetching = false;
}

class API {

    static songs = [];
    static rankedSongs = [];

    static async getPlayerId(username) {
        const playerUrl = `https://new.scoresaber.com/api/players/by-name/${username}`;
        const data = await API.get(playerUrl);

        if (!data)
            return -1;

        if (data.players.length !== 1)
            return -2;

        const player = data.players[0];
        return player.playerId;
    }


    static async getPlayerData(playerId) {
        const playerUrl = `https://new.scoresaber.com/api/player/${playerId}/full`;
        const data = await API.get(playerUrl);
        return Object.assign(data.playerInfo, data.scoreStats);
    }


    static async getScores(playerId, page) {
        const playerUrl = `https://new.scoresaber.com/api/player/${playerId}/scores/top/${page}`;
        const data = await API.get(playerUrl);
        return data.scores;
    }


    static async getSongData(hash, difficulty) {

        // Check if we already have the song
        if (API.songs[hash])
            return API.songs[hash];

        const playerUrl = `https://beatsaver.com/api/maps/by-hash/${hash}`;
        const data = await API.get(playerUrl);

        // For now only standard maps are supported
        data.metadata.characteristics = data.metadata.characteristics.filter(c => c.name === "Standard");
        if (!data.metadata.characteristics.length)
            return;

        // For now only standard difficulties are supported
        const moreSongData = data.metadata.characteristics[0].difficulties[difficultiesMap[difficulty]];
        if (!moreSongData)
            return;

        return Object.assign(
            moreSongData,
            {
                cover: `https://beatsaver.com${data.coverURL}`,
                description: data.description,
                zip: `https://beatsaver.com${data.directDownload}`,
                key: data.key,
                name: data.name,
                heat: data.stats.heat,
                downloads: data.stats.downloads,
                difficulty: difficultiesMap[difficulty]
            }
        );
    }



    static async getStars(hash, difficulty) {
        // TODO
        // const stars = await API.getStars(score.songHash, difficultiesMap[song.difficulty]);
    }


    static get(url) {
        return new Promise(resolve => {
            $.get(url, async function (data, status) {
                if (status !== "success") {

                    // Do something with status
                    console.error(status);

                    resolve({
                        error: status
                    });
                    return;
                }

                resolve(data);
            });
        });
    }


}