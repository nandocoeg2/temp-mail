export type MutableClock = {
  now: () => Date;
  set: (date: Date) => void;
};

export function fixedClock(isoDate: string): MutableClock {
  let current = new Date(isoDate);
  return {
    now: () => new Date(current),
    set: (date: Date) => {
      current = new Date(date);
    }
  };
}

export function advanceClock(clock: MutableClock, milliseconds: number): void {
  clock.set(new Date(clock.now().getTime() + milliseconds));
}
