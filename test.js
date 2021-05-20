const data = require('./test.json');
let bpm = 157.89999;
const notes = [
    {
        "_time": 4.25,
        "_lineIndex": 1,
        "_lineLayer": 2,
        "_type": 1,
        "_cutDirection": 6
    },
    {
        "_time": 4.25,
        "_lineIndex": 0,
        "_lineLayer": 0,
        "_type": 1,
        "_cutDirection": 6
    },
    {
        "_time": 5.25,
        "_lineIndex": 2,
        "_lineLayer": 0,
        "_type": 1,
        "_cutDirection": 5
    },
    {
        "_time": 5.25,
        "_lineIndex": 3,
        "_lineLayer": 1,
        "_type": 1,
        "_cutDirection": 5
    },
    {
        "_time": 6.5,
        "_lineIndex": 2,
        "_lineLayer": 2,
        "_type": 0,
        "_cutDirection": 7
    },
    {
        "_time": 6.5625,
        "_lineIndex": 3,
        "_lineLayer": 0,
        "_type": 0,
        "_cutDirection": 8
    },
    {
        "_time": 7.5,
        "_lineIndex": 1,
        "_lineLayer": 0,
        "_type": 0,
        "_cutDirection": 4
    },
    {
        "_time": 7.5,
        "_lineIndex": 3,
        "_lineLayer": 1,
        "_type": 1,
        "_cutDirection": 1
    }
];


// Split left and right
const leftNotes = data._notes.filter(n => n._type === 0);
const rightNotes = data._notes.filter(n => n._type === 1);
const chunkedLeft = chunkify(leftNotes);
const chunkedRight = chunkify(rightNotes);
const hitSortedNotesLeft = chunkedLeft.map(determineOrderOfNoteChunk).flat();
const hitSortedNotesRight = chunkedRight.map(determineOrderOfNoteChunk).flat();

const work = determineWork();
const workHistory = work.historyLeft.concat(work.historyRight).sort((a, b) => a.note._time - b.note._time);
console.log("Right Work", work.right);
console.log("Left Work", work.left);

const FATIGUE_THRESHOLD = 25;
const RESTING_INTENSITY = 1;
let fatigue = 0;
let maxFatigue = 0;
let permanentFatigue = 0;
let timeOfMaxFatigue = 0;
for (const noteWork of workHistory) {
    if (noteWork.note._time > 236 && noteWork.note._time <= 250) {
        console.log(noteWork.work)
    }
    if (noteWork.work > FATIGUE_THRESHOLD) {
        fatigue += noteWork.work - FATIGUE_THRESHOLD;
    } else {
        fatigue -= noteWork.work * RESTING_INTENSITY;
    }

    if (fatigue > maxFatigue) {
        maxFatigue = fatigue;
        timeOfMaxFatigue = noteWork.note._time;
        permanentFatigue = 0.25 * maxFatigue;
    }
}
console.log("Fatigue", fatigue);
console.log("Max Fatigue", maxFatigue, "at beat", timeOfMaxFatigue);
console.log("Perma Fatigue", permanentFatigue);


function determineWork() {
    let historyLeft = [];
    let historyRight = [];

    let rightTotalWork = 0;
    for (let i = 0; i < hitSortedNotesRight.length - 1; i++) {
        const work = getWorkBetweenNotes(hitSortedNotesRight[i], hitSortedNotesRight[i + 1]);
        historyRight.push({
            work,
            note: hitSortedNotesRight[i]
        });
        rightTotalWork += work;
    }
    
    let leftTotalWork = 0;
    for (let i = 0; i < hitSortedNotesLeft.length - 1; i++) {
        const work = getWorkBetweenNotes(hitSortedNotesLeft[i], hitSortedNotesLeft[i + 1]);
        historyLeft.push({
            work,
            note: hitSortedNotesLeft[i]
        });
        leftTotalWork += work;
    }

    return {
        left: leftTotalWork,
        right: rightTotalWork,
        historyLeft,
        historyRight
    }
}


function determineOrderOfNoteChunk(notes) {

    // We don't need to order array of length 1
    if (notes.length <= 1)
        return notes;

    // Get possible arrangements of hits
    const noteArrangements = permutations(notes);

    let minWork = Infinity;
    let bestArrangement;
    for (const arrangement of noteArrangements) {

        // Calculate work of chunk arrangement
        let totalWork = 0;
        for (let i = 0; i < arrangement.length - 1; i++) {
            totalWork += getWorkBetweenNotes(arrangement[i], arrangement[i + 1])
        }

        // Select best chunk with minimum work
        if (minWork > totalWork && totalWork !== 0) {
            minWork = totalWork;
            bestArrangement = arrangement;
        }
    }

    return bestArrangement;
}


function getWorkBetweenNotes(noteA, noteB) {


    // Get ideal positions of sabers before and after hitting A and B
    let noteAfterB = {
        x: noteB._lineIndex,
        y: noteB._lineLayer
    }
    if (noteA._cutDirection === 8) {
        noteAfterB = getNoteAfter(noteB._lineIndex, noteB._lineLayer, noteB._cutDirection);
    }

    let noteBehindA = getNoteBehind(noteA._lineIndex, noteA._lineLayer, noteA._cutDirection);
    if (noteAfterB.x === noteBehindA.x && noteAfterB.y === noteBehindA.y) {
        noteBehindA = {
            x: noteA._lineIndex,
            y: noteA._lineLayer
        }
        noteAfterB = getNoteAfter(noteB._lineIndex, noteB._lineLayer, noteB._cutDirection);
    }
    
    // Calculate the saber distance between notes 
    const dAngle = getAngleBetweenDirectionCodes(noteA, noteB);
    const dist = saberDist(noteBehindA.x, noteBehindA.y, noteAfterB.x, noteAfterB.y, dAngle);
    //console.log("DIST", dist)

    // Calculate work needed to hit both notes optimally
    const dBeat = noteB._time - noteA._time;
    let dt = dBeat * 60 / bpm;
    //console.log("DELTA", dt)
    if (dt < 0.2) 
        dt = 0.2;

    const hz = 1 / dt;
    const a = hz * Math.PI;
    const GRAVITY_PENALTY = 0.2;
    const dHeight = gravityPenalty(noteBehindA.y, noteAfterB.y)
    //console.log("GRAV_FACTOR", dHeight)
    const work = dist * dist * (a * a * dt / 2 - a * Math.sin(2 * a * dt) / 4) * dHeight;

    //console.log("Dist is ", dist);
    //console.log("Work is ", work);
    //console.log();
    return work;
}


function gravityPenalty(noteA, noteB) {
    const dh = noteB - noteA;

    switch(dh) {
        case -4: return 1.1;
        case -3: return 0.95;
        case -2: return 0.7;
        case -1: return 0.6;
        case 1: return 1.08;
        case 2: return 1.25;
        case 3: return 1.42;
        case 4: return 1.65;
        default: return 1;
    }

}


/**
 * Returns the position of saber before hitting the block (behind the block)
 * Its the position where the saber needs to go to make a good cut
 */
 function getNoteBehind(x, y, dir) {
    switch (dir) {
        case 0: return {
            x, y: y - 1
        }
        case 1: return {
            x, y: y + 1
        }
        case 2: return {
            x: x + 1, y
        }
        case 3: return {
            x: x - 1, y
        }
        case 4: return {
            x: x + 1, y: y - 1
        }
        case 5: return {
            x: x - 1, y: y - 1
        }
        case 6: return {
            x: x + 1, y: y + 1
        }
        case 7: return {
            x: x - 1, y: y + 1
        }
        default: return {
            x, y
        }
    }
}


function getNoteAfter(x, y, dir) {
    switch (dir) {
        case 0: return {
            x, y: y + 1
        }
        case 1: return {
            x, y: y - 1
        }
        case 2: return {
            x: x - 1, y
        }
        case 3: return {
            x: x + 1, y
        }
        case 4: return {
            x: x - 1, y: y + 1
        }
        case 5: return {
            x: x + 1, y: y + 1
        }
        case 6: return {
            x: x - 1, y: y - 1
        }
        case 7: return {
            x: x + 1, y: y - 1
        }
        default: return {
            x, y
        }
    }
}


/**
 * Get an approximate distance from one saber state to the other (used to calculate the work between notes)
 */
function saberDist(x1, y1, x2, y2, dAngle) {
    const dX = x2 - x1;
    const dY = y2 - y1;
    const dist = Math.sqrt(dX * dX + dY * dY);
    return dAngle * dist;
}



function getAngleBetweenDirectionCodes(noteA, noteB) {

    // Get angle difference
    const angles = [0, .5, .25, .25, .125, .125, .375, .375, 0];
    let dirA = noteA._cutDirection;
    let dirB = noteB._cutDirection;
    
    return Math.abs(angles[dirB] - angles[dirA]) + .5;
}


/**
 * Returns all permutation of a given array (without repetition)
 */
function permutations(xs) {
    let ret = [];

    for (let i = 0; i < xs.length; i = i + 1) {
        let rest = permutations(xs.slice(0, i).concat(xs.slice(i + 1)));

        if (!rest.length)
            ret.push([xs[i]])
        else
            for (let j = 0; j < rest.length; j = j + 1)
                ret.push([xs[i]].concat(rest[j]))
    }
    return ret;
}


/**
 * Groups notes together which spawn at the same time
 */
function chunkify(notes) {
    let lastNoteTime = 0;
    let chunk = [];
    let chunks = [];
    for (const note of notes) {
        if (note._time !== lastNoteTime && chunk.length > 0) {
            chunks.push(chunk);
            chunk = [];
        }
        chunk.push(note);
        lastNoteTime = note._time;
    }
    return chunks;
}

