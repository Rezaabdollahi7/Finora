import { siteConfig } from "@/config/site";

/**
 * The header's greeting, by the hour on the household's clock rather than
 * the server's: a container running in UTC would otherwise say "good
 * morning" to someone in Tehran at half past eleven.
 */
export function hourInZone(
  instant: Date,
  timeZone: string = siteConfig.timeZone,
): number {
  const hour = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    hourCycle: "h23",
  }).format(instant);

  return Number(hour);
}

export function greetingForHour(hour: number): string {
  if (hour >= 4 && hour < 11) return "صبح بخیر";
  if (hour >= 11 && hour < 15) return "ظهر بخیر";
  if (hour >= 15 && hour < 19) return "عصر بخیر";
  return "شب بخیر";
}
