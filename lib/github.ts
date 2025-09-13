import { Octokit } from "npm:@octokit/core@7";
import type { Endpoints } from "npm:@octokit/types@14";

export const MY_REPOS_SEARCH_PARAMS = [
	"repo:grammyjs/stateless-question",
	"user:EdJoPaTo",
	"user:HAWHHCalendarbot",
] as const;

// Create a personal access token at https://github.com/settings/tokens/new?scopes=repo
// Then use `export GITHUB_PAT='ghp_…'`
const GITHUB_PAT = Deno.env.get("GITHUB_PAT")!;
if (!GITHUB_PAT) {
	throw new Error("GITHUB_PAT is not defined");
}

export const octokit = new Octokit({ auth: GITHUB_PAT });

export type GithubSearchRepoInfo =
	Endpoints["GET /search/repositories"]["response"]["data"]["items"][0];

export async function searchGithubRepos(
	query: string,
): Promise<GithubSearchRepoInfo[]> {
	const repos: GithubSearchRepoInfo[] = [];

	for (let page = 1;; page++) {
		const response = await octokit.request("GET /search/repositories", {
			per_page: 100,
			sort: "updated",
			page,
			q: query,
		});
		const { items, total_count } = response.data;
		repos.push(...items);
		if (items.length < 100 || repos.length >= total_count) {
			break;
		}
	}

	return repos;
}
