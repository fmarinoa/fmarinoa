import { promises as fs } from "node:fs";
import {
  GITHUB_USERNAME,
  LASTEST_LIMITS,
  REQUEST_HEADERS,
} from "./constants.js";
import { getActorInfo, getRepositoryInfo } from "./utils.js";

const fetchUserEvents = async () => {
  const url = `https://api.github.com/users/${GITHUB_USERNAME}/events`;
  return await fetch(url, { headers: REQUEST_HEADERS })
    .then((response) => response.json())
    .catch((error) => {
      throw new Error("Error fetching user events: " + error.message);
    });
};

const getLatestPrs = async (events) => {
  const { type, maxLatest } = LASTEST_LIMITS.pullRequests;
  const ACTIONS_ACCEPTED = new Set(["opened", "reopened", "synchronize"]);
  const filteredEvents = events
    .filter(
      (event) =>
        event.type === type && ACTIONS_ACCEPTED.has(event.payload.action)
    )
    .slice(0, maxLatest);

  if (!filteredEvents.length) return [];

  return await Promise.all(
    filteredEvents.map(async (event) => {
      const response = await fetch(event.payload.pull_request.url, {
        headers: REQUEST_HEADERS,
      }).then((res) => res.json());

      return {
        title: response.title,
        url: response.html_url,
        repository: getRepositoryInfo(event),
        actor: getActorInfo(event),
        compare: {
          head: response.head.label,
          base: response.base.label,
        },
      };
    })
  );
};

const getLatestPushes = async (events) => {
  const { type, maxLatest } = LASTEST_LIMITS.push;
  const filteredEvents = events
    .filter(
      (event) =>
        event.type === type &&
        event.repo.name !== `${GITHUB_USERNAME}/${GITHUB_USERNAME}` // ignorar los pushes de este repo
    )
    .slice(0, maxLatest);

  if (!filteredEvents.length) return [];

  return await Promise.all(
    filteredEvents.map(async (event) => {
      const repository = getRepositoryInfo(event);

      const response = await fetch(
        `https://api.github.com/repos/${GITHUB_USERNAME}/${repository.name}/compare/${event.payload.before}...${event.payload.head}`,
        { headers: REQUEST_HEADERS }
      ).then((res) => res.json());

      return {
        repository: repository,
        commits: response.total_commits,
        branch: event.payload.ref.replace("refs/heads/", ""),
        actor: getActorInfo(event),
      };
    })
  );
};

const getLatestBranches = (events) => {
  const { type, maxLatest } = LASTEST_LIMITS.branches;
  const filteredEvents = events
    .filter((event) => event.type === type)
    .slice(0, maxLatest);

  if (!filteredEvents.length) return [];

  return filteredEvents.map((event) => ({
    repository: getRepositoryInfo(event),
    branch: event.payload.ref,
    actor: getActorInfo(event),
  }));
};

const formats = {
  latestPRs: (pr) =>
    `📝 [${pr.title}](${pr.url}) · 📦 [_${pr.repository.name}_](${pr.repository.url}) · 🔀 \`${pr.compare.head} → ${pr.compare.base}\``,
  latestPushes: (push) =>
    `📦 [_${push.repository.name}_](${push.repository.url}) ${push.commits ? '· 🔢 **' + push.commits + '**' : '·'} 🌿 \`${push.branch}\``,
  latestBranches: (branch) =>
    `📦 [${branch.repository.name}](${branch.repository.url}) · 🌿 \`${branch.branch}\``,
};

const formatList = (data, formatter) => {
  if (!data.length) return "Sin actividad reciente.";
  return data.map(formatter).join("<br>");
};

const ghTrophiesUrl = {
  'ryo-ma': `https://github-profile-trophy.vercel.app?username=${GITHUB_USERNAME}`,
  'cyberbee-pro': `https://trophygithubreadmelang.cybee.dpdns.org?username=${GITHUB_USERNAME}`,
  adwitya: `https://github-profile-trophy-liard-delta.vercel.app?username=${GITHUB_USERNAME}`
};

const queryParamsTrophy = "&theme=tokyonight&no-frame=false&no-bg=true&margin-w=4";

const buildFullGhTrophiesUrl = async () => {
  for (const [key, url] of Object.entries(ghTrophiesUrl)) {
    try {
      const res = await fetch(url);
      if (res.ok) return `${url}${queryParamsTrophy}`;
    } catch (error) {
      console.error(`Failed to fetch URL for ${key}:`, error);
    }
  }
  return null;
};

const getCurrentTrophiesUrl = async () => {
  const readme = await fs.readFile("README.md", "utf-8");
  const candidates = readme.match(/!\[\]\((https?:[^\s)]+)\)/);
  for (const candidate of candidates ?? []) {
    if (candidate.includes(queryParamsTrophy)) return candidate;
  }
};

const main = async () => {
  const events = await fetchUserEvents();
  const [latestPRs, latestPushes, latestBranches, urlTrophies, currentTrophiesUrl, template] = await Promise.all([
    getLatestPrs(events),
    getLatestPushes(events),
    getLatestBranches(events),
    buildFullGhTrophiesUrl(),
    getCurrentTrophiesUrl(),
    fs.readFile("src/README.md.tpl", "utf-8"),
  ]);
  let formattedTemplate = template
    .replace("%{{latestPRs}}%", formatList(latestPRs, formats.latestPRs))
    .replace("%{{latestPushes}}%", formatList(latestPushes, formats.latestPushes))
    .replace(
      "%{{latestBranches}}%",
      formatList(latestBranches, formats.latestBranches)
    );
  formattedTemplate = formattedTemplate.replace(
    "%{{urlTrophies}}%",
    urlTrophies ?? currentTrophiesUrl
  );
  await fs.writeFile("README.md", formattedTemplate);
};

(async () => {
  await main();
})();
