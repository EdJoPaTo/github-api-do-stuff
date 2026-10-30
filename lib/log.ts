export function logArray(description: string, array: readonly unknown[]): void {
	console.log(description, array.length, array);
}

export function logNonEmptyArray(description: string, array: readonly unknown[]): void {
	if (array.length > 0) logArray(description, array);
}
