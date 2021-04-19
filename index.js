"use strict";

$(document).ready(function () 
{
    const input = $("#username");
    input.on("input", () => {
        input.removeClass("text-danger input-error");
    });

    $("#generate-playlist").click(function() {
        const username = input.val().trim();

        // Error handling
        if (!username) {
            input.addClass("text-danger input-error");
            return;
        }
        else input.removeClass("text-danger input-error");
        window.location.href = "/player#" + encodeURIComponent(username);
    });

});