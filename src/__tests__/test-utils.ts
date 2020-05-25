export function waitFor(delay: number) {
    return new Promise((resolve) => setTimeout(resolve, delay));
}

export function waitForNextTick() {
    return new Promise((resolve) => process.nextTick(resolve));
}
