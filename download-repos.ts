import { MY_REPOS_SEARCH_PARAMS, searchGithubRepos } from "./lib/github.ts";
import { exec, getExpectedDirectoryOfGitHubRepo, HOME } from "./lib/local.ts";

async function getRepos() {
	const repos = await searchGithubRepos(
		["fork:true", ...MY_REPOS_SEARCH_PARAMS].join(" "),
	);
	console.log("total repos", repos.length);
	return repos;
}

const allRepos = await getRepos();
const jobs = allRepos
	.map((repo) => ({
		localPath: getExpectedDirectoryOfGitHubRepo(repo),
		repo,
	}))
	.sort((a, b) => a.localPath.localeCompare(b.localPath));

for (const { localPath, repo } of jobs) {
	console.log(localPath.replace(HOME, "~"));
	try {
		await Deno.stat(localPath);
		// Path exists, probably fine
	} catch {
		// Path does not exist
		console.log(await exec("git", "clone", repo.ssh_url, localPath));
	}
}
