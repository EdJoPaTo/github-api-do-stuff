import {
	MY_REPOS_SEARCH_PARAMS,
	octokit,
	searchGithubRepos,
} from "./lib/github.ts";
import { logNonEmptyArray } from "./lib/log.ts";

async function doRepo(owner: string, repo: string) {
	console.log("\ndo repo", owner, repo);

	const [workflowsResponse, runsReponse] = await Promise.all([
		octokit.request("GET /repos/{owner}/{repo}/actions/workflows", {
			owner,
			repo,
			per_page: 100,
		}),
		octokit.request("GET /repos/{owner}/{repo}/actions/runs", {
			owner,
			repo,
			per_page: 100,
		}),
	]);

	const { workflows } = workflowsResponse.data;
	const nonActive = workflows.filter((o) => o.state !== "active");
	logNonEmptyArray(
		"non active workflows",
		nonActive.map((o) => ({
			state: o.state,
			name: o.name,
			path: o.path,
			html_url: o.html_url,
		})),
	);

	const { workflow_runs } = runsReponse.data;
	const nonFinished = workflow_runs
		.filter((run) => run.status !== "completed")
		.map((run) => ({
			name: run.name,
			status: run.status,
			run_started_at: run.run_started_at,
			html_url: run.html_url,
		}));
	logNonEmptyArray("not completed workflow runs", nonFinished);
}

const repos = await searchGithubRepos(
	["fork:true", "archived:false", ...MY_REPOS_SEARCH_PARAMS].join(" "),
);
console.log("total repos", repos.length);

logNonEmptyArray(
	"not main",
	repos
		.filter((o) => o.default_branch !== "main")
		.map((o) => `${o.default_branch} ${o.html_url}`),
);

logNonEmptyArray(
	"has projects",
	repos.filter((o) => o.has_projects).map((o) => o.html_url),
);

for (const repo of repos) {
	await doRepo(repo.owner!.login, repo.name);
}

console.log("\n\nall done");
