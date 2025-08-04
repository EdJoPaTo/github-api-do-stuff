import { octokit } from "./lib/github.ts";

const SECOND = 1000;
const HOUR = 60 * 60 * SECOND;

const readUntil = new Date(Date.now() - 6 * HOUR).toISOString();
console.log("mark as read until", readUntil);

// https://docs.github.com/en/rest/activity/notifications?apiVersion=2022-11-28#mark-notifications-as-read
console.log(
	await octokit.request("PUT /notifications", {
		last_read_at: readUntil,
	}),
);
