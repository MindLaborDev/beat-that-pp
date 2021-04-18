"use strict";

$(document).ready(function () {

    // User has clicked on "Generate Playlist"
    $("#generate-playlist").click(function () {

        // Set loading animation to button
        $(this).addClass("loading hide-text");
        $(".progress").removeClass("u-none");

        const username = $("#username").val().trim();
        const playerUrl = `https://new.scoresaber.com/api/players/by-name/${username}`;
        
        $.get(playerUrl, function(data, status) 
        {
            if (status !== "success") 
                return;

            if (data.players.length !== 1) 
                return;

            const player = data.players[0];
            const finalData = fetchUserData(player.playerId);

        });

        // Analyse own songs (stars, pp, accuracy, njs, nps -> playstyle values)
        // Get "better" players
        // Analyse their best 20% songs
        // Compare their playstyle values with own
        // Make best suggestions
        

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
    $("#progress").css("width", ~~(step/STEPS*100) + "%")
    $("#progress-status").text(~~(step/STEPS*100) + "%");
    $("#progress-message").text(message + `... (${step}/${STEPS})`);

    if (~~(step/STEPS*100) === 100) {
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
        $.get(`https://new.scoresaber.com/api/player/${userId}/full`, async function(data, status) 
        {
            if (status !== "success") 
                return;

            setStatus("Fetching your song data");
            
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
                pageSongs = await fetchUserSongPage(page);
                player.songs = player.songs.concat(pageSongs);
                page++;
            } while (page <= maxPages && pageSongs.length === 8);

            setStatus("Done!");

            console.log("Final Data", player);
            resolve(player);
        });
    });
}


/**
 * Fetch songs from a scoresaber song page
 */
function fetchUserSongPage(page) {
    return new Promise(resolve => {
        $.get(`https://new.scoresaber.com/api/player/76561198436848521/scores/top/${page}`, async function(data, status) 
        {
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
                
                //console.log("difficulty", score.difficulty, score.difficultyRaw);

                songs.push(
                    await fetchSongData({
                        pp:         score.pp,
                        weightedPP: score.pp * score.weight,
                        weight:     score.weight,
                        hash:       score.songHash,
                        mapper:     score.levelAuthorName
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
        $.get(`https://beatsaver.com/api/maps/by-hash/${songHash}`, function(data, status) 
        {
            if (status !== "success") 
                return;

            const difficulties = {
                1: "easy",
                3: "normal",
                5: "hard",
                7: "expert",
                9: "expertPlus"
            };
            const moreSongData = data.metadata.characteristics[0].difficulties[difficulties[difficulty]];

            song = Object.assign(song, {
                cover:          data.coverURL,
                description:    data.description,
                zip:            data.directDownload,
                key:            data.key,
                name:           data.name,
                heat:           data.stats.heat,
                downloads:      data.stats.downloads,
                difficulty:     difficulties[difficulty]
            }, moreSongData);

            resolve(song);
        });
    });
}
