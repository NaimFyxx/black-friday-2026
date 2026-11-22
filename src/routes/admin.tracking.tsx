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
        Switches that decide who gets counted, so the team&apos;s own testing stays out of the
        numbers. They cover Google Analytics, the Meta pixel, Klaviyo, Microsoft Clarity and the
        visits on these pages. Changes apply the next time a page loads.
      </PageHeader>

      {error ? (
        <ErrorBox error={error} />
      ) : isLoading || !data ? (
        <Loading />
      ) : (
        <>
          {data.siteSetup === "missing" && (
            <SetupNotice title="The switch for the whole site isn't set up yet">
              The settings table (<code>bf_settings</code>) doesn&apos;t exist yet, so everyone is
              counted and this switch can&apos;t be saved. Paste the prompt from{" "}
              <code>docs/LOVABLE-SETUP.md</code> into Lovable. (The &quot;this device&quot; switch
              below already works.)
            </SetupNotice>
          )}

          {data.siteSetup === "error" && (
            <SetupNotice title="Couldn't read the switch for the whole site">
              The site couldn&apos;t reach its settings in the database, so everyone stays counted
              (on purpose, so no campaign numbers are lost). Try reloading; if it keeps happening,
              check the Supabase connection in Lovable.
            </SetupNotice>
          )}

          <Panel className="space-y-5">
            <Row
              title="Count visitors on the whole site"
              description={
                data.siteEnabled
                  ? "ON: every visitor is counted."
                  : "OFF: nobody is counted. Turn this on before Fyxx Friday goes live!"
              }
              checked={data.siteEnabled}
              disabled={data.siteSetup !== "ok" || site.isPending}
              onChange={(v) => site.mutate(v)}
              tone={data.siteEnabled ? "on" : "off"}
            />
            <div className="border-t border-border" />
            <Row
              title="Count this device"
              description={
                data.deviceExcluded
                  ? "OFF: this browser is never counted, even when the whole site is. Do this on every phone and laptop the team tests with."
                  : "ON: this browser is counted like any visitor. Switch it off on the team's own devices."
              }
              checked={!data.deviceExcluded}
              disabled={device.isPending}
              onChange={(v) => device.mutate(!v)}
              tone={data.deviceExcluded ? "off" : "on"}
            />
          </Panel>

          {(site.error || device.error) && <ErrorBox error={site.error ?? device.error} />}

          <p className="text-xs text-muted-foreground">
            &quot;This device&quot; is remembered in this browser, so set it once per browser
            (clearing cookies or a private window resets it). Errors are still saved on the Errors
            page either way, so you can see what breaks while testing.
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
