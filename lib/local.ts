export const HOME = Deno.env.get("HOME")!;
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

export async function exec(cmd: string, ...args: string[]): Promise<string> {
	const process = new Deno.Command(cmd, { args, stdout: "piped" }).spawn();
	const status = await process.status;
	if (!status.success) {
		throw new Error(`Command ${cmd} was not successful`);
	}

	const { stdout: outputBuffer } = await process.output();
	const output = new TextDecoder().decode(outputBuffer);
	return output;
}

/// Split directory into parent folder and folder name
export function splitDir(dir: string): [string, string] {
	const splitted = dir.split("/");
	const last = splitted.pop();
	if (!last) throw new Error("splitDir input fishy: " + dir);
	return [splitted.join("/"), last];
}

export type LocalRepo = {
	readonly dir: string;
	readonly remoteUrl: string;
	readonly host: string;
	readonly path: string;
};

type Remote = {
	readonly remoteUrl: string;
	readonly host: string;
	readonly path: string;
};

function matchRemote(remoteUrl: string): Remote | undefined {
	const sshMatch = /^git@([^:]+):(.+)$/.exec(remoteUrl);
	if (sshMatch) {
		const host = sshMatch[1]!;
		const path = sshMatch[2]!.replace(/\.git$/, "");
		return { remoteUrl, host, path };
	}

	const parsed = URL.parse(remoteUrl);
	if (parsed) {
		const { host, pathname } = parsed;
		const path = pathname
			.split("/")
			.filter(Boolean)
			.join("/")
			.replace(/\.git$/, "");
		return { remoteUrl, host, path };
	}

	return undefined;
}

export async function getLocalRepos(): Promise<LocalRepo[]> {
	const list: LocalRepo[] = [];

	const fdOutput = await exec(
		"project-below",
		"--hidden",
		"--directory=.git",
		"--base-dir=" + GIT_BASE_DIR,
		"--canonical",
		"--print0",
	);
	const directories = fdOutput
		.split("\0")
		.map((o) => o.trim())
		.filter(Boolean)
		.sort();
	for (const dir of directories) {
		const remotes: Record<string, Remote> = {};

		const gitOutput = await exec("git", "-C", dir, "remote", "--verbose");
		const gitOutputLines = gitOutput.split("\n").filter((o) => o.trim() !== "");
		for (const remoteLine of gitOutputLines) {
			const remoteMatch = /(\w+)\t(\S+)/.exec(remoteLine);
			if (!remoteMatch) {
				throw new Error("unknown git remote line: " + remoteLine);
			}

			const name = remoteMatch[1]!;
			const url = remoteMatch[2]!;
			const info = matchRemote(url);
			if (!info) {
				console.log("skip not parsable", dir.replace(HOME, "~"), remoteLine);
				continue;
			}

			remotes[name] = info;
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

export type GithubRepoInfo = {
	readonly archived: boolean;
	readonly fork: boolean;
	readonly is_template?: boolean;
	readonly name: string;
	readonly owner: null | { readonly login: string };
	readonly private: boolean;
};

export function getExpectedDirectoryOfGitHubRepo(data: GithubRepoInfo): string {
	const owner = data.owner?.login ?? "other";

	let folder = "";

	if (data.is_template) {
		folder = `template/${owner}`;
	} else {
		if (data.archived) {
			folder += ".archived-";
		}

		folder += owner;

		if (data.fork) {
			folder += "-fork";
		}

		folder += "/";
		folder += data.private ? "private" : "public";
	}

	const repoFolderName = data.name;
	const baseDir = getBaseDirForGitHost("github.com");
	return `${baseDir}/${folder}/${repoFolderName}`;
}
