
$(document).ready(function () {
    $("#toast-close").click(() => {
        $(".toast").removeClass("show persist-show");
    });
});


/**
 * Strip html tags from string
 */
function clean(string) {
    return `${string}`.replace(/<[^>]+>/g, '');
}


/**
 * Round a number to 2 decimal points
 */
function round(number, n = 2) {
    return ~~(number * Math.pow(10, n)) / Math.pow(10, n);
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


function convertDate(string) {
    const date = new Date(string);
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return date.getDate() + " " + months[date.getMonth()] + " " + date.getFullYear();
}


let interval;
function showToast(msg, options) {
    $("#toast-msg").text(msg)
    $(".toast")
    .removeClass((_, className) => (className.match(/(^|\s)toast--\S+/g) || []).join(' '))
    .addClass(options.color ? "toast--" + options.color : "toast--danger")
    .addClass("show");

    if (interval)
        clearInterval(interval)

    if (!options.persist) {
        interval = setInterval(() => {
            $(".toast").removeClass("show persist-show");
        }, 3000);
    } else {
        $(".toast").addClass("persist-show");
    }
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
     * Fetches data about a map
     */
    static async getMapDetails(key, include_stars = true) {
        const mapUrl = `https://beatsaver.com/api/maps/detail/${key}`;
        const data = await API.get(mapUrl);
        if (data === 404)
            return;

        if (include_stars) {
            const diffs = await API.get(`https://deep-beat.000webhostapp.com/?hash=${data.hash}`);
            data._diffs = JSON.parse(diffs)
        }
        return data;
    }


    /**
     * Converts a zipBlob from jsZip to an Audio
     */
    static getAudioBlob(zipBlob, audica = false) {
        return new Promise(async resolve => {
            const audio = new Audio;
            audio.volume = .2;

            if (audica) {
                showToast("Audica files are not supported!");
            } else {
                const infoFile = zipBlob.file("info.dat") || zipBlob.file("Info.dat")
                const infoString = await infoFile.async("string")
                const infos = JSON.parse(infoString)

                const filename = infos._songFilename
                const blob = await zipBlob.file(filename).async("blob")
                const cfilename = infos._coverImageFilename
                const cblob = await zipBlob.file(cfilename).async("blob")

                audio.src = URL.createObjectURL(blob);
                audio.currentTime = infos._previewStartTime;
                audio.onloadedmetadata = function () {
                    resolve({
                        audio,
                        cover: cblob
                    });
                }
            }
        });
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
            try {
                $.ajax({
                    url,
                    type: "get",
                    success: async function (data, status) {
                        if (status !== "success") {

                            // Do something with status
                            console.error(status);

                            resolve({
                                error: status
                            });
                            return;
                        }

                        resolve(data);
                    },
                    error: response => resolve(response.status)
                });
            } catch {
                resolve();
            }
        });
    }
}


module.exports = {
    clean,
    round,
    bytesToSize,
    convertDate,
    showToast,
    API
}