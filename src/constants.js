export const LASTEST_LIMITS = Object.freeze({
    pullRequests: { type: 'PullRequestEvent', maxLatest: 3 },
    push: { type: 'PushEvent', maxLatest: 3 },
    branches: { type: 'CreateEvent', maxLatest: 3 }
});

export const REQUEST_HEADERS = { 'Cache-Control': 'no-cache' };

export const GITHUB_USERNAME = 'fmarinoa';
