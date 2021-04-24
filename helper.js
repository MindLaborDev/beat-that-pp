

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
    const months = ["Jan", "Feb", "Mar","Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return date.getDate() + " " + months[date.getMonth()] + " " + date.getFullYear();
}


/**
 * Start preview of a map
 */
let modalVisible = false;
function preview(key) {
    const modal = $("#preview-map");
    const iframe = modal.find("> iframe");
    iframe.attr("src", `https://skystudioapps.com/bs-viewer/?id=${key}`);
    modalVisible = true;

    // Show modal after loading (i know there is a better solution - but lets keep it simple, aay)
    setTimeout(() => {
        if (modalVisible)
            modal.removeClass("u-none");
    }, 1500);
}


/**
 * Dismisses the preview modal
 */
function dismissModal() {
    modalVisible = false;

    const modal = $("#preview-map");
    modal.addClass("u-none");

    const iframe = modal.find("> iframe");
    iframe.attr("src", ``);
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
    static async getMapDetails(key) {
        const mapUrl = `https://beatsaver.com/api/maps/detail/${key}`;
        const data = await API.get(mapUrl);
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
                audio.onloadedmetadata = function () {
                    resolve(audio);
                }
            } else {
                const infoFile = zipBlob.file("info.dat") || zipBlob.file("Info.dat")
                const infoString = await infoFile.async("string")
                const infos = JSON.parse(infoString)

                const filename = infos._songFilename
                const blob = await zipBlob.file(filename).async("blob")

                audio.src = URL.createObjectURL(blob);
                audio.currentTime = infos._previewStartTime;
                audio.onloadedmetadata = function () {
                    resolve(audio);
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