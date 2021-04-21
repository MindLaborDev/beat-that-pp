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
            <button class="js-listen btn-small" data-key="${clean(song.key)}" onclick="listen(this, '${clean(song.zip)}')">listen</button>
            <a href="${clean(song.oneclick)}"><button class="btn-primary btn-small uppercase">Install</button></a>
        </div>
    </div>`;
}


/**
 * Strip html tags from string
 */
function clean(string) {
    return `${string}`.replace(/<[^>]+>/g, '');
}


/**
 * Round a number to 2 decimal points
 */
function round(number) {
    return ~~(number * 100) / 100;
}


/**
 * Runs when user clicked on "listen"
 */
function listen(me, url) {

    // If programm fetches the song don't iterrupt anything
    if (fetching)
        return;

    const amIPlaying = $(me).attr("data-key") === playingSong;

    // If the button that has been click was playing: Stop the song
    if (amIPlaying) {
        songFinished(me);
        currentPlayedButton = null;
        return;
    }

    // If user clicked on another button wihtout stopping the last one
    if (playing && !amIPlaying) {
        songFinished();
        previewSong(me, url);
        currentPlayedButton = me;
        return;
    }

    // If nothing is playing, just start the song
    if (!playing) {
        previewSong(me, url);
        currentPlayedButton = me;
        return;
    }
}


/**
 * Plays audio preview of a map
 */
let audio = new Audio;
let playing = false;
let playingSong = "";
let fetching = false;
let currentPlayedButton = null;
async function previewSong(e, url) {
    if (audio.pause(), "playing" == e.dataset.state)
        e.dataset.state = "";
    else {
        for (const e of document.querySelectorAll(".js-listen"))
            e.dataset.state = "";

        e.dataset.state = "loading"
        $(e).addClass("animated loading hide-text");
        songFinished();
        fetching = true
        
        // Download map and play audio
        const zipBlob = await API.downloadMap(url);
        audio = await API.getAudioBlob(zipBlob, url.endsWith(".audica"));
        await audio.play();
        
        songStarted(currentPlayedButton);

        // Add finished event listener
        audio.addEventListener("ended", () => songFinished(e));
    }
}


/**
 * Handles logic for audio preview start
 */
function songStarted(e) {
    $(e).text("Stop");
    $(e).removeClass("animated loading hide-text");

    e.dataset.state = "playing";
    playing = true;
    playingSong = $(e).attr("data-key");
    fetching = false;
}


/**
 * Handles logic for audio preview end/stop
 */
function songFinished() {
    audio.pause();
    audio.currentTime = 0;
    $(".js-listen").text("Listen");

    playing = false;
    playingSong = "";
    fetching = false;
}


/**
 * Convert number of bytes into a readable size string
 */
function bytesToSize(bytes) {
    var sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    if (bytes == 0) return '0 Byte';
    var i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
    return round(bytes / Math.pow(1024, i)) + ' ' + sizes[i];
}



/**
 * Handles API Requests
 */
class API {

    static songs = [];
    static rankedSongs = [];


    /**
     * Searches for a username and returns the player id
     */
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


    /**
     * Fetches data of the player
     */
    static async getPlayerData(playerId) {
        const playerUrl = `https://new.scoresaber.com/api/player/${playerId}/full`;
        const data = await API.get(playerUrl);
        return Object.assign(data.playerInfo, data.scoreStats);
    }


    /**
     * Fetches the scores of a player
     */
    static async getScores(playerId, page) {
        const playerUrl = `https://new.scoresaber.com/api/player/${playerId}/scores/top/${page}`;
        const data = await API.get(playerUrl);
        return data.scores;
    }


    /**
     * Fetches the data of a map
     */
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

    
    /**
     * Converts a zipBlob from jsZip to an Audio
     */
    static async getAudioBlob(zipBlob, audica=false) {

        const audio = new Audio;
        audio.volume = .2;

        if (audica) {
            const descFile = await zipBlob.file("song.desc").async("string")
            const description = JSON.parse(descFile)
            const filename = description.moggSong.substring(0, description.moggSong.length - 4)
            const bytes = await zipBlob.file(filename).async("uint8array")
            let s = Array.from(bytes.slice(4, 8));
            s = (s = s.map(e => {
                let t = e.toString(16);
                return 1 == t.length && (t = "0" + t), t
            }
            )).reverse(), s = parseInt(s.join(""), 16);

            const chunk = bytes.slice(s, bytes.size)
            const blob = new Blob([chunk], {
                type: "application/ogg"
            })

            audio.src = URL.createObjectURL(blob);
            audio.currentTime = description.previewStartSeconds;
            return audio;
        } else {
            const infoFile = zipBlob.file("info.dat") || zipBlob.file("Info.dat")
            const infoString = await infoFile.async("string")
            const infos = JSON.parse(infoString)

            const filename = infos._songFilename
            const blob = await zipBlob.file(filename).async("blob")

            audio.src = URL.createObjectURL(blob);
            audio.currentTime = infos._previewStartTime;
            return audio;
        }
    }


    /**
     * Downloads the map
     */
    static async downloadMap(url) {
        url.endsWith(".audica") && (url = `https://bsaber-cors-anywhere.herokuapp.com/${url}`);

        const response = await fetch(url);
        const bytes = response.headers.get("content-length");
        const size = bytesToSize(bytes);
        console.log(size);

        if (200 != response.status)
            return;

        const zip = new JSZip;
        const zipBlob = await zip.loadAsync(response.blob());
        return zipBlob;
    }


    /**
     * Just an HTTP Request
     */
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
