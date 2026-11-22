import { useEffect, useState } from "react";
import { BellRing, CalendarPlus } from "lucide-react";

import { ReminderForm } from "@/components/reminder/ReminderForm";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { googleCalendarUrl, icsDataUrl } from "@/lib/calendar";
import { hasReminder } from "@/lib/reminder";
import type { TeaserInfo } from "@/lib/teaser";

/** Under the hero countdown: "Remind me at 10:00" and "Add to calendar". */
export function HeroReminder({ info }: { info: TeaserInfo }) {
  const copy = info.reminder;
  // Signed up already (now or earlier): keep the dialog open for the thank-you,
  // but don't offer the link again on later visits.
  const [open, setOpen] = useState(false);
  const [reminded, setReminded] = useState(false);
  useEffect(() => {
    setReminded(hasReminder());
  }, [open]);
  const canCalendar = !!info.sale_start && !!info.sale_end;
  if (!copy?.enabled && !canCalendar) return null;
  const link =
    "ff-small inline-flex items-center gap-1.5 text-sm text-ff-cream underline underline-offset-4 hover:text-ff-red";

  return (
    <div className="mt-3 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 lg:justify-start">
      {copy?.enabled && copy.list_id && (!reminded || open) && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger className={link}>
            <BellRing className="h-4 w-4" aria-hidden />
            {copy.hero_link}
          </DialogTrigger>
          <DialogContent className="border-ff-black/15 bg-ff-cream sm:max-w-md">
            <DialogTitle className="ff-headline text-xl text-ff-black">{copy.title}</DialogTitle>
            <DialogDescription className="sr-only">
              Leave your email and we will send you a reminder when the sale starts.
            </DialogDescription>
            <ReminderForm copy={copy} source="hero" showTitle={false} />
          </DialogContent>
        </Dialog>
      )}
      {canCalendar && (
        <Popover>
          <PopoverTrigger className={link}>
            <CalendarPlus className="h-4 w-4" aria-hidden />
            {copy?.calendar || "Add to calendar"}
          </PopoverTrigger>
          <PopoverContent className="w-56 border-ff-black/15 bg-ff-cream p-2">
            <a
              href={googleCalendarUrl(info.sale_start!, info.sale_end!)}
              target="_blank"
              rel="noopener noreferrer"
              className="ff-subline block rounded-md px-3 py-2 text-sm text-ff-black hover:bg-ff-warm-cream"
            >
              Google Calendar
            </a>
            <a
              href={icsDataUrl(info.sale_start!, info.sale_end!)}
              download="fyxx-friday.ics"
              className="ff-subline block rounded-md px-3 py-2 text-sm text-ff-black hover:bg-ff-warm-cream"
            >
              Apple or Outlook (.ics)
            </a>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
