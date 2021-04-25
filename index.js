"use strict";

$(document).ready(function () 
{
    const input = $("#key");
    input.on("input", () => {
        input.removeClass("text-danger input-error");
    });

    $("#generate-song-report").click(async function() {
        $("#error-msg").addClass("u-none");
        let key = input.val().trim();
        key = key.replace(/!bsr\s*/g, "")

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
    });

});