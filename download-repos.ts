#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

import { MY_REPOS_SEARCH_PARAMS, octokit, searchGithubRepos } from "./lib/github.ts";
import { getExpectedDirectoryOfGitHubRepo, HOME } from "./lib/local.ts";

async function getRepos() {
	const repos = await searchGithubRepos(["fork:true", ...MY_REPOS_SEARCH_PARAMS].join(" "));
	console.log("total repos", repos.length);
	return Promise.all(
		repos.map(async (result) => {
			if (result.fork) {
				const { data: repoInfo } = await octokit.request("GET /repos/{owner}/{repo}", {
					owner: result.owner!.login,
					repo: result.name,
				});
				return repoInfo;
			}

			return result;
		}),
	);
}

const allRepos = await getRepos();
const jobs = allRepos
	.map((repo) => ({ repo, localPath: getExpectedDirectoryOfGitHubRepo(repo) }))
	.toSorted((a, b) => a.localPath.localeCompare(b.localPath));

for (const { localPath, repo } of jobs) {
	console.log(localPath.replace(HOME, "~"));
	if (!existsSync(localPath)) {
		spawnSync("git", ["clone", repo.ssh_url, localPath], {
			stdio: ["ignore", "inherit", "inherit"],
		});
	}
}
