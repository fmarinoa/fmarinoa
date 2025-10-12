export const LASTEST_LIMITS = Object.freeze({
    pullRequests: { type: 'PullRequestEvent', maxLatest: 3 },
    push: { type: 'PushEvent', maxLatest: 3 },
    branches: { type: 'CreateEvent', maxLatest: 3 }
});