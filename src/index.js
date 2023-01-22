"use strict";

const { API } = require("./helper");

$(document).ready(function () {
    const input = $("#key");
    input.on("input", () => {
        input.removeClass("text-danger input-error");
        fetch("https://skillsaber.vercel.app/api/player?id=76561198436848521").then(console.log);
    });

    $("#generate-song-report").click(() => onAnalyseMap(input));
    input.on("keyup", event => {
        if (event.key === "Enter") {
            onAnalyseMap(input);
        }
    });

    $("#upload-file").click(() => {
        window.location.href = "/map#upload";
    });

});

async function onAnalyseMap(input) {
    $("#error-msg").addClass("u-none");

    let key = input.val().trim();
    key = key.replace(/!bsr\s*/g, "")
    key = key.replace(/https?:\/\//g, "")
    key = key.replace(/beatsaver.com\/beatmap\//g, "")

    // Error handling
    if (!key) {
        input.addClass("text-danger input-error");
        return;
    }
    else input.removeClass("text-danger input-error");

    const map = await API.getMapDetails(key, false);
    if (map == null) {
        input.addClass("text-danger input-error");
        $("#error-msg").text("I couldn't find that map!").removeClass("u-none");
        return;
    }

    window.location.href = "/map#" + key;
}