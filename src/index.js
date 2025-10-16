import { promises as fs } from 'fs'
import { LASTEST_LIMITS } from "./constants.js";
import { capitalizeFirstLetter, getActorInfo, getRepositoryInfo } from "./utils.js";

const fetchUserEvents = async () => {
    const url = 'https://api.github.com/users/fmarinoa/events';
    return await fetch(url, {
            headers: { 'Cache-Control': 'no-cache' }
        })
        .then(response => response.json())
        .catch(error => { throw new Error('Error fetching user events: ' + error.message) });
};

const getLatestPrs = (events) => {
    const { type, maxLatest } = LASTEST_LIMITS.pullRequests;
    const ACTIONS_ACCEPTED = ['opened', 'reopened', 'synchronize'];
    const filteredEvents = events.filter(event =>
                                event.type === type &&
                                ACTIONS_ACCEPTED.includes(event.payload.action)
                            )
                            .slice(0, maxLatest);

    if (!filteredEvents.length) return [];

    return filteredEvents.map(event => ({
        title: event.payload.pull_request.title,
        url: event.payload.pull_request.html_url,
        action: capitalizeFirstLetter(event.payload.action),
        repository: getRepositoryInfo(event),
        actor: getActorInfo(event),
        compare: {
            head: event.payload.pull_request.head.label,
            base: event.payload.pull_request.base.label
        }
    }));
};

const getLatestPushes = (events) => {
    const { type, maxLatest } = LASTEST_LIMITS.push;
    const filteredEvents = events.filter(event => 
                                event.type === type &&
                                event.repo.name !== 'fmarinoa/fmarinoa' // ignorar los pushes de este repo
                            ).slice(0, maxLatest);

    if (!filteredEvents.length) return [];

    return filteredEvents.map(event => ({
        repository: getRepositoryInfo(event),
        commits: event.payload.size,
        actor: getActorInfo(event)
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
    fetchUserEvents()
    .then(events => {
        const latestPRs = getLatestPrs(events);
        const latestPushes = getLatestPushes(events);
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