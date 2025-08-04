import { existsSync } from "node:fs";
import {
	MY_REPOS_SEARCH_PARAMS,
	octokit,
	searchGithubRepos,
} from "./lib/github.ts";
import {
	getBaseDirForGitHost,
	getExpectedDirectoryOfGitHubRepo,
	getLocalRepos,
	HOME,
	type LocalRepo,
	splitDir,
} from "./lib/local.ts";

const [localRepos, remoteRepos] = await Promise.all([
	getLocalRepos(),
	searchGithubRepos(["fork:true", ...MY_REPOS_SEARCH_PARAMS].join(" ")),
]);

async function getExpectedDirectory(localRepo: LocalRepo): Promise<string> {
	if (localRepo.host === "github.com") {
		const { remoteUrl } = localRepo;
		const remoteRepoInfo = remoteRepos.find(
			(r) => remoteUrl === r.ssh_url || remoteUrl === r.clone_url,
		);
		if (remoteRepoInfo) {
			return getExpectedDirectoryOfGitHubRepo(remoteRepoInfo);
		} else {
			const splitted = localRepo.path.split("/");
			const owner = splitted[0]!;
			const repo = splitted[1]!;
			const { data: repoInfo } = await octokit.request(
				"GET /repos/{owner}/{repo}",
				{ owner, repo },
			);

			if (remoteUrl !== repoInfo.ssh_url) {
				console.log("not in search result, remote is", repoInfo.ssh_url);
			}

			return getExpectedDirectoryOfGitHubRepo(repoInfo);
		}
	}

	const baseDir = getBaseDirForGitHost(localRepo.host);

	if (localRepo.host === "gist.github.com") {
		const [_, localName] = splitDir(localRepo.dir);
		return baseDir + "/" + localName;
	}

	return baseDir + "/" + localRepo.path;
}

for (const entry of localRepos) {
	try {
		const expectedDir = await getExpectedDirectory(entry);

		if (entry.dir === expectedDir) {
			// console.log("correct", fullPath.replace(HOME, "~"));
		} else if (existsSync(expectedDir)) {
			console.log(
				"duplica",
				entry.dir.replace(HOME, "~"),
				"→",
				expectedDir.replace(HOME, "~"),
			);
		} else {
			console.log(
				"rename ",
				entry.dir.replace(HOME, "~"),
				"→",
				expectedDir.replace(HOME, "~"),
			);
			const [parent] = splitDir(expectedDir);
			Deno.mkdirSync(parent, { recursive: true });
			Deno.renameSync(entry.dir, expectedDir);
		}
	} catch (error) {
		console.error(
			"failed ",
			entry.dir.replace(HOME, "~"),
			entry,
			error instanceof Error ? error.message : error,
		);
	}
}
