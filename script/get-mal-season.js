const fs = require('fs');
const { exec } = require('child-process-async');

if (process.argv.length < 4) {
  console.error('Expected two arguments (year and season)');
  process.exit(1);
}

require('dotenv').config();
const MAL_CLIENT_ID = process.env.MAL_CLIENT_ID;
const BASE_URL = "https://api.myanimelist.net/v2";
const FIELDS = '?fields=id,title,main_picture,alternative_titles,average_episode_duration,broadcast,genres,media_type,num_episodes,start_date,start_season,status,studios,source';

getSeasonalAnime(process.argv[2], process.argv[3]).catch(e => console.error(e));

async function curl(url) {
    const { stdout, stderr } = await exec(`curl -q '${BASE_URL}${url}' -w "%{http_code}" -H 'X-MAL-CLIENT-ID: ${MAL_CLIENT_ID}'`);
    const status = stdout.slice(-3)
    if (status !== "200") {
        throw new Error(`Received status ${status} from url ${url}`);
    }
    const result = JSON.parse(stdout.slice(0, -3));
    return result;
}

async function getSeasonalAnime(year, season) {
    const url = `/anime/season/${year}/${season}?limit=500`;

    console.info(url);
    const seasonResponse = await curl(url);

    const promises = [];
    for (const anime of seasonResponse.data) {
        promises.push(getAnimeDetails(anime.node.id));
    }

    const responses = await Promise.all(promises);
    const schedule = makeSchedule(responses.filter(anime =>
        anime.media_type === "tv" &&
        !anime.genres.some(g => g.name === "Kids"))
        .map(mapDetails));

    const filename = `${year}-${season}.json`;
    fs.writeFileSync(filename, JSON.stringify(schedule, null, 2));
    console.info(`Saved ${filename}`);
}

async function getAnimeDetails(id) {
    const url = `/anime/${id}`;
    console.info(url);
    return curl(url + FIELDS);
}

function mapDetails(anime) {
    const title = anime.alternative_titles && anime.alternative_titles.en ? anime.alternative_titles.en : anime.title;
    const day = anime.broadcast ? anime.broadcast.day_of_the_week : null;
    const jst = anime.broadcast ? anime.broadcast.start_time : null;

    return {
        id: anime.id,
        title,
        day,
        jst
    };
}

const daysEn = [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday"
];

const daysJp = [
    "日",
    "月",
    "火",
    "水",
    "木",
    "金",
    "土"
];

function makeSchedule(allAnime) {
    const schedule = {
        "日": [],
        "月": [],
        "火": [],
        "水": [],
        "木": [],
        "金": [],
        "土": [],
        "❓": []
    };

    for (const anime of allAnime) {
        let day = "❓";
        if (anime.day) {
            let i = daysEn.indexOf(anime.day);
            if (anime.jst && Number(anime.jst.substring(0, 2)) < 8) {
                i = (i + 6) % 7;
            }
            day = daysJp[i];
        }
        const time = jstToGmt(anime.jst);
        const out = `❓${time} ${anime.title}`;
        console.info(`${day} - ${out}`)
        schedule[day].push(out);
    }

    for (const arr of Object.values(schedule)) {
        arr.sort();
    }

    return schedule;
}

function jstToGmt(time) {
    if (!time) {
        return "????";
    }
    let hour = Number(time.substring(0, 2));
    hour -= 8;
    if (hour < 0) {
        hour += 24;
    }
    return String(hour).padStart(2, "0") + time.substring(3, 5);
}
