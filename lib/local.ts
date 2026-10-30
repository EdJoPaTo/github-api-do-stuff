import childProcess from "node:child_process";
import { env } from "node:process";
import util from "node:util";

// false positive? lint warning seems odd
// oxlint-disable-next-line strict-void-return
const execFile = util.promisify(childProcess.execFile);

export const HOME = env["HOME"]!;
if (!HOME) {
	throw new Error("Your shell should set your HOME directory as env");
}

const GIT_BASE_DIR = HOME + "/git";
const KNOWN_HOST_DIRS: Readonly<Record<string, string>> = {
	"aur.archlinux.org": "aur",
	"codeberg.org": "codeberg",
	"gist.github.com": "gist",
	"github.com": "hub",
};
export function getBaseDirForGitHost(host: string): string {
	const part = KNOWN_HOST_DIRS[host] ?? host;
	return GIT_BASE_DIR + "/" + part;
}

/// Split directory into parent folder and folder name
export function splitDir(dir: string): [string, string] {
	const splitted = dir.split("/");
	const last = splitted.pop();
	if (!last) throw new Error("splitDir input fishy: " + dir);
	return [splitted.join("/"), last];
}

export interface LocalRepo {
	readonly dir: string;
	readonly remoteUrl: string;
	readonly host: string;
	readonly path: string;
}

interface Remote {
	readonly remoteUrl: string;
	readonly host: string;
	readonly path: string;
}

function matchRemote(remoteUrl: string): Remote | undefined {
	const sshMatch = /^git@([^:]+):(.+)$/u.exec(remoteUrl);
	if (sshMatch) {
		const host = sshMatch[1]!;
		const path = sshMatch[2]!.replace(/\.git$/u, "");
		return { remoteUrl, host, path };
	}

	const parsed = URL.parse(remoteUrl);
	if (parsed) {
		const { host, pathname } = parsed;
		const path = pathname
			.split("/")
			.filter(Boolean)
			.join("/")
			.replace(/\.git$/u, "");
		return { remoteUrl, host, path };
	}

	return undefined;
}

export async function getLocalRepos(): Promise<LocalRepo[]> {
	const list: LocalRepo[] = [];

	const { stdout: fdOutput } = await execFile(
		"project-below",
		["--hidden", "--directory=.git", "--base-dir=" + GIT_BASE_DIR, "--canonical", "--print0"],
		{ encoding: "utf8" },
	);
	const directories = fdOutput
		.split("\0")
		.map((o) => o.trim())
		.filter(Boolean)
		.toSorted();
	for (const dir of directories) {
		const remotes: Record<string, Remote> = {};

		const { stdout: gitOutput } = await execFile("git", ["-C", dir, "remote", "--verbose"], {
			encoding: "utf8",
		});
		const gitOutputLines = gitOutput.split("\n").filter((o) => o.trim() !== "");
		for (const remoteLine of gitOutputLines) {
			const remoteMatch = /(\w+)\t(\S+)/u.exec(remoteLine);
			if (!remoteMatch) {
				throw new Error("unknown git remote line: " + remoteLine);
			}

			const name = remoteMatch[1]!;
			const url = remoteMatch[2]!;
			const info = matchRemote(url);
			if (info) {
				remotes[name] = info;
			} else {
				console.log("skip not parsable", dir.replace(HOME, "~"), remoteLine);
			}
		}

		const relevant = remotes["upstream"] ?? remotes["origin"];
		if (relevant) {
			list.push({ dir, ...relevant });
		} else if (Object.keys(remotes).length === 0) {
			console.log("no remotes", dir);
		} else {
			console.log("unknown remote names", dir);
		}
	}

	return list;
}

export interface GithubRepoInfo {
	readonly archived: boolean;
	readonly fork: boolean;
	readonly is_template?: boolean;
	readonly name: string;
	readonly owner: null | { readonly login: string };
	readonly private: boolean;
	readonly source?: {
		readonly name: string;
		readonly owner: { readonly login: string };
	};
}

export function getExpectedDirectoryOfGitHubRepo(data: GithubRepoInfo): string {
	if (data.fork && !data.source) {
		console.log("Warning: fork but no source", data.name);
	}

	const owner = data.owner?.login ?? "other";

	let folder = "";

	if (data.is_template) {
		folder = `template/${owner}`;
	} else if (data.archived && data.fork) {
		folder += ".archived-" + owner + "-fork";
	} else {
		if (data.archived) {
			folder += ".archived-";
		}

		if (data.source?.owner?.login && data.source.name === data.name) {
			folder += data.source.owner.login;
		} else if (data.fork) {
			folder += owner + "-fork";
		} else {
			folder += owner;
		}
	}

	if (!data.is_template) {
		folder += "/";
		folder += data.private ? "private" : "public";
	}

	const repoFolderName = data.name;
	const baseDir = getBaseDirForGitHost("github.com");
	return `${baseDir}/${folder}/${repoFolderName}`;
}
