"use strict";

$(document).ready(function () {

    // User has clicked on "Generate Playlist"
    $("#generate-playlist").click(function () {

        // Set loading animation to button
        $(this).addClass("loading hide-text");
        $(".progress").removeClass("u-none");

        const username = $("#username").val().trim();
        const playerUrl = `https://new.scoresaber.com/api/players/by-name/${username}`;

        $.get(playerUrl, async function (data, status) {
            if (status !== "success")
                return;

            if (data.players.length !== 1)
                return;

            const player = data.players[0];
            const finalData = await fetchUserData(player.playerId);
            console.log(finalData);

            $(".top-element").addClass("goup");
            const songsWrapper = $("#songs");
            for (const song of finalData.songs) {
                const html = generateSongTile({
                    cover: `https://new.scoresaber.com/api/static/covers/${song.hash}.png`,
                    title: song.name,
                    description: song.description,
                    oneclick: `beatsaver://${song.key}`,
                    difficulty: song.difficulty,
                    duration: Math.round(song.length),
                    pp: song.pp,
                    weight: song.weight,
                    accuracy: song.accuracy,
                    njs: song.njs,
                    njsOffset: round(song.njsOffset),
                });
                songsWrapper.append(html);
            }

        });

    });

})

const songsTable = {};
const WEIGHT_THRESHOLD = 0.6;
const STEPS = 3;
let step = 0;


/**
 * Sets the progress bar message and value
 */
function setStatus(message) {
    step++;
    $("#progress").css("width", ~~(step / STEPS * 100) + "%")
    $("#progress-status").text(~~(step / STEPS * 100) + "%");
    $("#progress-message").text(message + `... (${step}/${STEPS})`);

    if (~~(step / STEPS * 100) === 100) {
        $("#generate-playlist").removeClass("loading hide-text");
        $(".progress").addClass("u-none");
    }
}


/**
 * Fetch all data about a given user
 * @param {string} userId Scoresaber user id
 */
function fetchUserData(userId) {
    setStatus("Fetching your user data");
    return new Promise(resolve => {
        const player = {};
        $.get(`https://new.scoresaber.com/api/player/${userId}/full`, async function (data, status) {
            if (status !== "success")
                return;

            setStatus("Fetching your song data");

            console.log(data);

            player.pp = data.playerInfo.pp;
            player.rank = data.playerInfo.rank;
            player.name = data.playerInfo.playerName;
            player.plays = data.scoreStats.rankedPlayCount;
            player.songs = [];

            // Fetch songs til the pp weight threshold
            const maxPages = Math.ceil(player.plays / 8);
            let page = 1;
            let pageSongs;
            do {
                pageSongs = await fetchUserSongPage(userId, page);
                player.songs = player.songs.concat(pageSongs);
                page++;
            } while (page <= maxPages && pageSongs.length === 8);

            setStatus("Done!");
            resolve(player);
        });
    });
}


/**
 * Fetch songs from a scoresaber song page
 */
function fetchUserSongPage(playerId, page) {
    return new Promise(resolve => {
        $.get(`https://new.scoresaber.com/api/player/${playerId}/scores/top/${page}`, async function (data, status) {
            if (status !== "success")
                return;

            const songs = [];
            for (const score of data.scores) {
                if (score.weight < WEIGHT_THRESHOLD) {
                    break;
                }

                // Check if we already have the song
                if (songsTable[score.songHash]) {
                    songs.push(songsTable[score.songHash]);
                    continue;
                }

                console.log(score);

                songs.push(
                    await fetchSongData({
                        pp: score.pp,
                        weightedPP: score.pp * score.weight,
                        weight: score.weight,
                        hash: score.songHash,
                        mapper: score.levelAuthorName,
                        accuracy: round(score.score / score.maxScore * 100)
                    }, score.songHash, score.difficulty)
                );
            }

            resolve(songs);
        });
    })
}


/**
 * Fetch more song data like bpm, njs, stars ...
 */
function fetchSongData(song, songHash, difficulty) {
    return new Promise(resolve => {
        $.get(`https://beatsaver.com/api/maps/by-hash/${songHash}`, function (data, status) {
            if (status !== "success")
                return;

            const difficulties = {
                1: "easy",
                3: "normal",
                5: "hard",
                7: "expert",
                9: "expertPlus"
            };
            data.metadata.characteristics = data.metadata.characteristics.filter(c => c.name === "Standard");
            const moreSongData = data.metadata.characteristics[0].difficulties[difficulties[difficulty]];

            song = Object.assign(song, {
                cover: data.coverURL,
                description: data.description,
                zip: data.directDownload,
                key: data.key,
                name: data.name,
                heat: data.stats.heat,
                downloads: data.stats.downloads,
                difficulty: difficulties[difficulty]
            }, moreSongData);

            resolve(song);
        });
    });
}

function generateSongTile(data) {

    // Generate difficulty badge
    const difficulties = {
        easy: {
            color: "info",
            display: "Easy"
        },
        normal: {
            color: "success",
            display: "Normal"
        },
        hard: {
            color: "warning",
            display: "Hard"
        },
        expert: {
            color: "danger",
            display: "Expert"
        },
        expertPlus: {
            color: "link",
            display: "Expert+"
        }
    };

    return `
    <div class="tile my-2 hover-grow">
        <div class="tile__icon mr-2">
            <figure class="avatar"><img src="${data.cover}" /></figure>
            <div class="tag tag--link">${round(data.pp)}pp</div><br />
        </div>
        <div class="tile__container">
            <p class="tile__title m-0 truncate">${data.title}</p>
            <p class="tile__subtitle m-0 truncate">
                <span>
                    <div class="tag tag--${difficulties[data.difficulty]["color"]}">${difficulties[data.difficulty]["display"]}</div>
                    <div class="tag tag--${difficulties[data.difficulty]["color"]} ml-1">${data.accuracy}%</div><br />
                </span>
                <span><b class="info-category">Duration:</b> ${~~(data.duration / 60)}m ${data.duration % 60}s<br /></span>
                <span>${data.njs ? `<b class="info-category">Njs:</b> ${data.njs}<br />` : ``}</span>
                <span>${data.njsOffset ? `<b class="info-category">Offset:</b> ${data.njsOffset}<br />` : ``}</span>
                <span class="tooltip" data-tooltip=""><b class="info-category">Weight:</b> ${round(data.weight * 100)}%<br /></span>
            </p>
        </div>
        <div class="tile__buttons m-0">
            <a href="${data.oneclick}"><button class="btn-primary btn-small uppercase">Install</button></a>
            <button onclick="previewSong(this, 'https://beatsaver.com/cdn/${data.key}/247e7cd970f32fafd9a14de4904ee20ef19ea745.zip')">listen</button>
        </div>
    </div>
    `;
}

function round(number) {
    return ~~(number * 100) / 100;
}


/**
 * Snagged from beastsaber.com
 */
let audio = new Audio;
audio.volume = .3;
let previewSong = (() => {
    let e = (e, t) => {
        let n = URL.createObjectURL(e);
        audio.src = n,
            audio.currentTime = t,
            audio.play()
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
                e(l, d)
            }
            )(o) : (async t => {
                let n = t.file("info.dat") || t.file("Info.dat")
                let a = await n.async("string")
                let o = JSON.parse(a)
                let r = o._songFilename
                let i = await t.file(r).async("blob")
                let s = o._previewStartTime;
                e(i, s)
            }
            )(o)
        }
    }
        ;
    return async (e, n) => {
        if (audio.pause(),
            "playing" == e.dataset.state)
            e.dataset.state = "";
        else {
            for (const e of document.querySelectorAll(".js-listen"))
                e.dataset.state = "";
            e.dataset.state = "loading",
                t(n),
                e.dataset.state = "playing"
        }
    }
}
)();
/**
 * Snagged from beastsaber.com
 */