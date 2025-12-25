export function setImmediateInterval(fn: () => void, delay: number) {
    fn();
    return setInterval(fn, delay);
}
