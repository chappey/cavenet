/**
 * Time simulation config for testing.
 *
 * TIME_SCALE controls how fast simulated time passes relative to real time.
 * Default: 60 → every real minute = 1 simulated hour.
 *
 * Edit this file to adjust the rate. Set to 1 for real time.
 */

export const TIME_SCALE = 60; // 1 real minute = 1 simulated hour

/**
 * Returns the number of simulated days of inactivity between two real timestamps.
 * Uses TIME_SCALE to accelerate elapsed time.
 */
export const simulatedDaysBetween = (older: Date, newer: Date): number => {
  const realMs = newer.getTime() - older.getTime();
  if (realMs <= 0) return 0;

  const simulatedMs = realMs * TIME_SCALE;
  const simulatedDays = Math.floor(simulatedMs / 86_400_000);
  return simulatedDays;
};

/**
 * Returns current simulated time offset from a reference point.
 * Useful for future time-sensitive features.
 */
export const getSimulatedNow = (referenceStart: Date = new Date(0)): Date => {
  const realElapsed = Date.now() - referenceStart.getTime();
  const simulatedElapsed = realElapsed * TIME_SCALE;
  return new Date(referenceStart.getTime() + simulatedElapsed);
};
