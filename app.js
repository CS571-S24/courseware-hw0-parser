import fs from 'fs';

const TOK = fs.readFileSync('token.secret').toString().trim();

const COURSE_ID = '395938';
const ASSIGNMENT_ID = '2173230';
const RUBRIC_ID = '_3631';

console.log("Beginning parsing...");
const persErrs = {};
let clazz = [];
fs.readdirSync('submissions').forEach(submission => {
    persErrs[submission] = [];
    if (!fs.existsSync(`submissions/${submission}/me.json`)) {
        persErrs[submission].push("me.json could not be found in the project's root directly. Is it named incorrectly or located in another folder?");
    } else {
        const contents = fs.readFileSync(`submissions/${submission}/me.json`);
        try {
            const json = JSON.parse(contents);
            if (isnu(json.name)) {
                persErrs[submission].push("Missing the 'name' property. Did you forget it, or is it mispelled?")
            } else if (typeof json.name !== 'object') {
                persErrs[submission].push(`'name' property is of the incorrect type; expected object but got ${typeof json.name}`)
            }
            if (json.name && isnu(json.name.first)) {
                persErrs[submission].push("Missing the 'first' property on the 'name' property. Did you forget it, or is it mispelled?")
            } else if (json.name && typeof json.name.first !== 'string') {
                persErrs[submission].push(`'first' property of 'name' property is of the incorrect type; expected string but got ${typeof json.name.first}`)
            }
            if (json.name && isnu(json.name?.last)) {
                persErrs[submission].push("Missing the 'last' property on the 'name' property. Did you forget it, or is it mispelled?")
            } else if (json.name && typeof json.name.last !== 'string') {
                persErrs[submission].push(`'last' property of 'name' property is of the incorrect type; expected string but got ${typeof json.name.last}`)
            }
            if (isnu(json.fromWisconsin)) {
                persErrs[submission].push("Missing the 'fromWisconsin' property. Did you forget it, or is it mispelled?")
            } else if (typeof json.fromWisconsin !== 'boolean') {
                persErrs[submission].push(`'fromWisconsin' property is of the incorrect type; expected boolean but got ${typeof json.fromWisconsin}`)
            }
            if (isnu(json.numCredits)) {
                persErrs[submission].push("Missing the 'numCredits' property. Did you forget it, or is it mispelled?")
            } else if (typeof json.numCredits !== 'number') {
                persErrs[submission].push(`'numCredits' property is of the incorrect type; expected number but got ${typeof json.numCredits}`)
            }
            if (isnu(json.major)) {
                persErrs[submission].push("Missing the 'major' property. Did you forget it, or is it mispelled?")
            } else if (typeof json.major !== 'string') {
                if (typeof json.major === 'object' && Array.isArray(json.major)) {
                    persErrs[submission].push(`'major' property is of the incorrect type; expected string but got ${typeof json.major}. If you have multiple majors, simply combine them with an & or the word 'and'`)
                } else {
                    persErrs[submission].push(`'major' property is of the incorrect type; expected string but got ${typeof json.major}`)
                }
            }
            if (isnu(json.interests)) {
                persErrs[submission].push("Missing the 'interests' property. Did you forget it, or is it mispelled?")
            } else if (!Array.isArray(json.interests)) {
                persErrs[submission].push(`'interests' property is of the incorrect type; expected a list of strings but got ${typeof json.interests}`)
            } else if (!json.interests.every(interest => typeof interest === 'string')) {
                persErrs[submission].push(`'interests' property is of the incorrect type; expected a list of strings but got a list of many types`)
            }
            if (Object.keys(json).length !== 5) {
                persErrs[submission].push(`Your json does not have the expected number of keys; expected 5 (name, fromWisconsin, numCredits, major, interests) but got ${Object.keys(json).length} (${Object.keys(json).join(', ')})`);
            }
            if (json.name && Object.keys(json.name).length !== 2) {
                persErrs[submission].push(`Your name does not have the expected number of keys; expected 2 (first, last) but got ${Object.keys(json.name).length} (${Object.keys(json).join(', ')})`);
            }
            clazz[submission] = json;
        } catch (e) {
            persErrs[submission].push("Your me.json file does not contain valid JSON!")
        }
    }
});

console.log("Parsing complete!");
clazz = Object.entries(persErrs).filter(pers => pers[1].length === 0).map(pers => clazz[pers[0]]);
shuffleArray(clazz);

console.log(`Writing clazz with ${clazz.length} students...`);
fs.writeFileSync('clazz.json', JSON.stringify(clazz, null, 2));
console.log("Clazz file wrote!");

const ppl = unravel(await fetchLinkableData(`https://canvas.wisc.edu/api/v1/courses/${COURSE_ID}/assignments/${ASSIGNMENT_ID}/submissions?include[]=user`))
    .map(per => {
        return {
            id: per.user.id,
            name: per.user.name
        }
    })

const matches = Object.keys(persErrs).filter(p => ppl.some(pp => pp.name.toLowerCase() === p.toLowerCase()))
const noMatches = Object.keys(persErrs).filter(p => !ppl.some(pp => pp.name.toLowerCase() === p.toLowerCase()))
const noMatchesOpp = ppl.filter(p => !Object.keys(persErrs).some(pp => p.name.toLowerCase() === pp.toLowerCase()))

console.log(`Found matches for ${matches.length} people.`)

console.log(`Could not find Canvas matches for ${noMatches.length} people... Did they drop the class?`)
for (let m of noMatches) {
    console.log(m)
}

console.log(`Could not find Git matches for ${noMatchesOpp.length} people... Did they submit their username?`)
for (let m of noMatchesOpp) {
    console.log(m)
    persErrs[m.name] = [];
    persErrs[m.name].push("We could not find your Git repository. Did you submit your GitHub username? Please email your instructor directly with your GitHub username.")
}

console.log("Writing error log...")
fs.writeFileSync('errors.json', JSON.stringify(persErrs, null, 2))
console.log("Error log complete!");

for(let p in persErrs) {
    const res = ppl.find(pp => p == pp.name)
    const evall = persErrs[res.name];
    let pts, comments;
    if(evall.length === 0) {
        pts = 1;
        comments = "Well done!"
    } else {
        comments = evall.join("\n")
        if (evall[0].startsWith("We could not find your Git repository.") ||
            evall[0].startsWith("me.json could not be found") ||
            evall[0].startsWith("Your me.json file does not contain valid JSON")
        ) {
            pts = 0;
        } else {
            pts = 0.5;
        }
    } 

    const resp = await fetch(`https://canvas.wisc.edu/api/v1/courses/${COURSE_ID}/assignments/${ASSIGNMENT_ID}/submissions/${res.id}?rubric_assessment[${RUBRIC_ID}][points]=${pts}&rubric_assessment[${RUBRIC_ID}][comments]=${encodeURIComponent(comments)}`, {
        method: 'PUT',
        headers: {
            'Authorization': 'Bearer ' + TOK
        }
    })

    if (resp.status === 200) {
        console.log("Successfully submitted for " + res.name);
    } else {
        console.log("!!! Recieved non-200 for " + res.name);
    }
    
    await delay(250 + Math.random() * 500)
}

function isnu(o) {
    return o === null || o === undefined;
}

// https://masteringjs.io/tutorials/fundamentals/wait-1-second-then
async function delay(time) {
    return new Promise(resolve => setTimeout(resolve, time));
}


function unravel(data, attr) {
    return data.map(d => attr ? d[attr] : d).reduce((acc, curr) => [...acc, ...curr], [])
}

async function fetchLinkableData(url) {
    const resp = await fetch(url, {
        method: 'GET',
        headers: {
            'Authorization': 'Bearer ' + TOK
        }
    })
    const lnks = parse_link_header(resp.headers.get('Link'));
    const data = [await resp.json()];
    if (lnks.next) {
        return data.concat(await fetchLinkableData(lnks.next));
    } else {
        return data;
    }
}

// https://gist.github.com/niallo/3109252?permalink_comment_id=1474669#gistcomment-1474669
function parse_link_header(header) {
    if (header.length === 0) {
        throw new Error("input must not be of zero length");
    }

    // Split parts by comma
    var parts = header.split(',');
    var links = {};
    // Parse each part into a named link
    for (var i = 0; i < parts.length; i++) {
        var section = parts[i].split(';');
        if (section.length !== 2) {
            throw new Error("section could not be split on ';'");
        }
        var url = section[0].replace(/<(.*)>/, '$1').trim();
        var name = section[1].replace(/rel="(.*)"/, '$1').trim();
        links[name] = url;
    }
    return links;
}

// https://stackoverflow.com/questions/2450954/how-to-randomize-shuffle-a-javascript-array
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        let j = Math.floor(Math.random() * (i + 1));
        let temp = array[i];
        array[i] = array[j];
        array[j] = temp;
    }
}
