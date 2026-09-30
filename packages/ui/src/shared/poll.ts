export function poll<Result>(
  read: () => Promise<Result>,
  onResult: (result: Result) => void,
  intervalMilliseconds: number,
): () => void {
  let cancelled = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const readAndSchedule = async () => {
    const result = await read();
    if (cancelled) return;
    onResult(result);
    timer = setTimeout(() => void readAndSchedule(), intervalMilliseconds);
  };
  void readAndSchedule();

  return () => {
    cancelled = true;
    clearTimeout(timer);
  };
}
