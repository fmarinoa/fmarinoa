import { promises as fs } from 'node:fs'
import { LASTEST_LIMITS } from "./constants.js";
import { getActorInfo, getRepositoryInfo } from "./utils.js";

const fetchUserEvents = async () => {
    const url = 'https://api.github.com/users/fmarinoa/events';
    return await fetch(url, {
            headers: { 'Cache-Control': 'no-cache' }
        })
        .then(response => response.json())
        .catch(error => { throw new Error('Error fetching user events: ' + error.message) });
};

const getLatestPrs = async (events) => {
    const { type, maxLatest } = LASTEST_LIMITS.pullRequests;
    const ACTIONS_ACCEPTED = new Set(['opened', 'reopened', 'synchronize']);
    const filteredEvents = events.filter(event =>
                                event.type === type &&
                                ACTIONS_ACCEPTED.has(event.payload.action)
                            )
                            .slice(0, maxLatest);

    if (!filteredEvents.length) return [];

    return await Promise.all(filteredEvents.map(async (event) => {
        const response = await fetch(event.payload.pull_request.url, { hheaders: { 'Cache-Control': 'no-cache' } }).then(res => res.json());

        return {
            title: response.title,
            url: response.html_url,
            repository: getRepositoryInfo(event),
            actor: getActorInfo(event),
            compare: {
                head: response.head.label,
                base: response.base.label
            }
        };
    }));
};

const getLatestPushes = async (events) => {
    const { type, maxLatest } = LASTEST_LIMITS.push;
    const filteredEvents = events.filter(event => 
                                event.type === type &&
                                event.repo.name !== 'fmarinoa/fmarinoa' // ignorar los pushes de este repo
                            ).slice(0, maxLatest);

    if (!filteredEvents.length) return [];

    return await Promise.all(filteredEvents.map(async (event) => {
        const repository = getRepositoryInfo(event);

        const response = await fetch(`https://api.github.com/repos/fmarinoa/${repository.name}/compare/${event.payload.before}...${event.payload.head}`, { headers: { 'Cache-Control': 'no-cache' } }).then(res => res.json());

        return {
            repository: repository,
            commits: response.total_commits,
            actor: getActorInfo(event)
        };
    }));
};

const getLatestBranches = (events) => {
    const { type, maxLatest } = LASTEST_LIMITS.branches;
    const filteredEvents = events.filter(event => event.type === type).slice(0, maxLatest);
    
    if (!filteredEvents.length) return [];

    return filteredEvents.map(event => ({
        repository: getRepositoryInfo(event),
        branch: event.payload.ref,
        actor: getActorInfo(event)
    }));
};

const writeLatestPr = (data) => {
    if (!data.length) return 'Sin actividad reciente.';
    return data.map(pr => 
        `- 📝 [${pr.title}](${pr.url})  
        📦 Repo: [_${pr.repository.name}_](${pr.repository.url})  
        👤 Autor: [${pr.actor.name}](${pr.actor.urlProfile})  
        🔀 Branch: \`${pr.compare.head} → ${pr.compare.base}\``
    ).join('\n');
}

const writeLatestPushes = (data) => {
    if (!data.length) return 'Sin actividad reciente.';
    return data.map(push =>
        `- 📦 Repo: [_${push.repository.name}_](${push.repository.url})  
        🔢 Commits: **${push.commits}**  
        👤 Autor: [${push.actor.name}](${push.actor.urlProfile})`
    ).join('\n');
}

const writeLatestBranches = (data) => {
    if (!data.length) return 'Sin actividad reciente.';
    return data.map(branch =>
        `- 📦 Repo: [${branch.repository.name}](${branch.repository.url})  
        🌿 Rama: \`${branch.branch}\`  
        👤 Autor: [${branch.actor.name}](${branch.actor.urlProfile})`
    ).join('\n');
};

(async () => {
    await fetchUserEvents()
    .then(async events => {
        const latestPRs = await getLatestPrs(events);
        const latestPushes = await getLatestPushes(events);
        const latestBranches = getLatestBranches(events);
        return { latestPRs, latestPushes, latestBranches };
    })
    .then(async data => { 
        const template = await fs.readFile('src/README.md.tpl', 'utf-8');
        const output = template.replace('%{{latestPRs}}%', writeLatestPr(data.latestPRs))
                             .replace('%{{latestPushes}}%', writeLatestPushes(data.latestPushes))
                             .replace('%{{latestBranches}}%', writeLatestBranches(data.latestBranches))
        await fs.writeFile('README.md', output);
     })
    .catch(error =>  { throw error });
})();