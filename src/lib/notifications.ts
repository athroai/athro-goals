/**
 * Schedule local notifications for pathway milestones.
 * 7 days before, 3 days before, 1 day before, and on the day.
 * Only runs on native (iOS/Android).
 */

function hashId(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h) % 2147483647;
}

function getNotificationId(pathwayId: string, stepId: string, offset: string): number {
  return hashId(`${pathwayId}-${stepId}-${offset}`);
}

const OFFSETS = [
  { days: 7, label: "7 days" },
  { days: 3, label: "3 days" },
  { days: 1, label: "1 day" },
  { days: 0, label: "today" },
] as const;

export interface StepForNotification {
  id: string;
  title: string;
  definiteDateIso: string | null;
  definiteDate: string | null;
}

function parseDateToIso(iso: string | null, definiteDate: string | null): string | null {
  if (iso && /^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  if (!definiteDate) return null;
  const months: Record<string, number> = {
    jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
    jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
  };
  const yearMatch = definiteDate.match(/(\d{4})/);
  if (!yearMatch) return null;
  const year = parseInt(yearMatch[1], 10);
  let month = 1;
  const monthMatch = definiteDate.match(/(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*/i);
  if (monthMatch) month = months[monthMatch[1].toLowerCase().slice(0, 3)] ?? 1;
  return `${year}-${String(month).padStart(2, "0")}-01`;
}

export async function schedulePathwayNotifications(
  pathwayId: string,
  goalTitle: string,
  steps: StepForNotification[],
  customDates: Record<string, string>
): Promise<void> {
  if (typeof window === "undefined") return;
  const cap = (window as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  if (!cap?.isNativePlatform?.()) return;

  try {
    const { LocalNotifications } = await import("@capacitor/local-notifications");

    const permissions = await LocalNotifications.checkPermissions();
    if (permissions.display !== "granted") {
      const request = await LocalNotifications.requestPermissions();
      if (request.display !== "granted") return;
    }

    const idsToCancel: number[] = [];
    const toSchedule: { id: number; title: string; body: string; at: Date }[] = [];

    for (const step of steps) {
      const custom = customDates[step.id];
      let dateIso: string | null = null;
      if (custom && /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(custom)) {
        const [d, m, y] = custom.split("/");
        dateIso = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
      } else {
        dateIso = step.definiteDateIso ?? parseDateToIso(null, step.definiteDate);
      }
      if (!dateIso) continue;

      const targetDate = new Date(dateIso + "T09:00:00");
      if (isNaN(targetDate.getTime()) || targetDate < new Date()) continue;

      for (const off of OFFSETS) {
        const notifyDate = new Date(targetDate);
        notifyDate.setDate(notifyDate.getDate() - off.days);
        if (notifyDate < new Date()) continue;

        const id = getNotificationId(pathwayId, step.id, off.label);
        idsToCancel.push(id);

        const body =
          off.days === 0
            ? `Today: ${step.title}`
            : `${off.label} until ${step.title}`;

        toSchedule.push({
          id,
          title: goalTitle,
          body,
          at: notifyDate,
        });
      }
    }

    if (idsToCancel.length > 0) {
      await LocalNotifications.cancel({ notifications: idsToCancel.map((id) => ({ id })) });
    }

    if (toSchedule.length > 0) {
      await LocalNotifications.schedule({
        notifications: toSchedule.map((n) => ({
          id: n.id,
          title: n.title,
          body: n.body,
          schedule: { at: n.at },
        })),
      });
    }
  } catch (err) {
    console.warn("Could not schedule notifications:", err);
  }
}
