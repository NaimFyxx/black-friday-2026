import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";

import { ErrorBox, Loading, PageHeader, Panel, SetupNotice } from "@/components/admin/AdminUi";
import { Switch } from "@/components/ui/switch";
import {
  getTrackingSettings,
  updateDeviceTracking,
  updateSiteTracking,
} from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/tracking")({
  component: TrackingPage,
});

function TrackingPage() {
  const queryClient = useQueryClient();
  const getFn = useServerFn(getTrackingSettings);
  const siteFn = useServerFn(updateSiteTracking);
  const deviceFn = useServerFn(updateDeviceTracking);

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-tracking"],
    queryFn: () => getFn(),
    retry: 1,
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["admin-tracking"] });

  const site = useMutation({
    mutationFn: (enabled: boolean) => siteFn({ data: { enabled } }),
    onSettled: refresh,
  });
  const device = useMutation({
    mutationFn: (excluded: boolean) => deviceFn({ data: { excluded } }),
    onSettled: refresh,
  });

  return (
    <>
      <PageHeader title="Tracking">
        Keep your own testing out of the numbers. Covers Google Analytics, Meta Pixel, Klaviyo,
        Microsoft Clarity and the visit log behind these dashboards. Changes apply on the next page
        load.
      </PageHeader>

      {error ? (
        <ErrorBox error={error} />
      ) : isLoading || !data ? (
        <Loading />
      ) : (
        <>
          {data.siteSetup === "missing" && (
            <SetupNotice title="The site-wide switch isn't set up yet">
              The <code>bf_settings</code> table hasn't been created, so tracking is ON for everyone
              and this switch can't be saved. Paste the prompt from{" "}
              <code>docs/LOVABLE-SETUP.md</code> into Lovable. (The “this device” switch below
              already works.)
            </SetupNotice>
          )}

          {data.siteSetup === "error" && (
            <SetupNotice title="Couldn't read the site-wide switch">
              The site couldn't reach the <code>bf_settings</code> table in Supabase, so tracking
              stays ON for everyone (it fails safe so Black Friday data is never lost). Try
              reloading; if it keeps happening, check the Supabase connection in Lovable.
            </SetupNotice>
          )}

          <Panel className="space-y-5">
            <Row
              title="Site-wide tracking"
              description={
                data.siteEnabled
                  ? "ON: every visitor is tracked."
                  : "OFF: nobody is tracked. Turn this on when Black Friday goes live!"
              }
              checked={data.siteEnabled}
              disabled={data.siteSetup !== "ok" || site.isPending}
              onChange={(v) => site.mutate(v)}
              tone={data.siteEnabled ? "on" : "off"}
            />
            <div className="border-t border-border" />
            <Row
              title="Track this device"
              description={
                data.deviceExcluded
                  ? "OFF: this browser is never tracked, even when site-wide tracking is on. Do this on each phone and laptop you and Lori test with."
                  : "ON: this browser is tracked like any visitor. Switch off on your own devices."
              }
              checked={!data.deviceExcluded}
              disabled={device.isPending}
              onChange={(v) => device.mutate(!v)}
              tone={data.deviceExcluded ? "off" : "on"}
            />
          </Panel>

          {(site.error || device.error) && <ErrorBox error={site.error ?? device.error} />}

          <p className="text-xs text-muted-foreground">
            “This device” is remembered by a cookie in this browser, so set it once per browser
            (clearing cookies or using a private window resets it). Errors are still logged on the
            Errors page either way, so you can see what breaks while testing.
          </p>
        </>
      )}
    </>
  );
}

function Row({
  title,
  description,
  checked,
  disabled,
  onChange,
  tone,
}: {
  title: string;
  description: string;
  checked: boolean;
  disabled: boolean;
  onChange: (v: boolean) => void;
  tone: "on" | "off";
}) {
  return (
    <div className="flex items-start justify-between gap-6">
      <div>
        <p className="font-medium">
          {title}{" "}
          <span
            className={
              tone === "on"
                ? "ml-1 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-800 uppercase"
                : "ml-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-800 uppercase"
            }
          >
            {checked ? "On" : "Off"}
          </span>
        </p>
        <p className="mt-1 max-w-xl text-sm text-muted-foreground">{description}</p>
      </div>
      <Switch
        checked={checked}
        disabled={disabled}
        onCheckedChange={onChange}
        aria-label={title}
        className="mt-1 shrink-0"
      />
    </div>
  );
}
