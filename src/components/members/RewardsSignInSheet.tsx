import { useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { ArrowLeft, Loader2, Mail, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { useRewardsAuth } from "@/hooks/useRewardsAuth";
import { lookupEmail, sendCode, verifyCode } from "@/lib/rewards-auth";
import { trackTierPointsLoginTap } from "@/lib/analytics";
import { CREAM, INK, MUTED, SERIF, type RewardsWhere } from "./rewards-tiers";

/**
 * Fyxx Rewards passwordless sign-in / create-account sheet, ported from Fyxx
 * Cup 2026 and restyled to the Fyxx Rewards look. One email field checks
 * Shopify: a returning member is greeted and sent a code; a new email collects
 * a name first, then creates the account. The code step signs them in (see
 * src/lib/rewards-auth.ts). Bottom sheet on the phone, centred box on desktop.
 */

type Step = "email" | "details" | "code";

const inputStyle: React.CSSProperties = {
  background: "#fff",
  border: "1px solid rgba(35,31,32,0.2)",
  color: INK,
};

function Field({
  id,
  label,
  ...props
}: { id: string; label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label htmlFor={id} className="block text-left">
      <span
        className="mb-1 block text-[11px] font-semibold tracking-wide uppercase"
        style={{ color: MUTED }}
      >
        {label}
      </span>
      <input
        id={id}
        className="h-11 w-full rounded-xl px-3 text-sm outline-none focus:ring-2 focus:ring-black/20"
        style={inputStyle}
        {...props}
      />
    </label>
  );
}

function errorText(reason?: string): string {
  switch (reason) {
    case "rate_limited":
      return "Too many requests. Please wait a few minutes and try again.";
    case "too_many_attempts":
      return "Too many attempts. Request a new code.";
    case "session_error":
      return "We couldn't complete sign-in. Please try again.";
    case "invalid_or_expired":
    case "invalid":
      return "That code is invalid or expired. Try again.";
    default:
      return "Something went wrong. Please try again shortly.";
  }
}

function SignInDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [acceptsMarketing, setAcceptsMarketing] = useState(true);
  const [code, setCode] = useState("");
  const [isNewUser, setIsNewUser] = useState(false);
  const [greeting, setGreeting] = useState<string | null>(null);
  const [busy, setBusy] = useState<"continue" | "details" | "verify" | "resend" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const reset = () => {
    setStep("email");
    setCode("");
    setFirstName("");
    setLastName("");
    setGreeting(null);
    setError(null);
    setInfo(null);
    setIsNewUser(false);
  };

  const close = (o: boolean) => {
    onOpenChange(o);
    if (!o) setTimeout(reset, 200);
  };

  const doSend = async (forResend = false): Promise<boolean> => {
    setError(null);
    setInfo(null);
    setBusy(forResend ? "resend" : "details");
    const res = await sendCode(email.trim().toLowerCase());
    setBusy(null);
    if (!res.ok) {
      setError(errorText(res.reason));
      return false;
    }
    setStep("code");
    if (forResend) setInfo("A new code has been sent.");
    return true;
  };

  const onContinue = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy("continue");
    const found = await lookupEmail(email.trim().toLowerCase());
    if (found.exists) {
      setIsNewUser(false);
      setBusy(null);
      const ok = await doSend(false);
      if (ok) setGreeting(found.firstName ? `Welcome back, ${found.firstName}!` : "Welcome back!");
      return;
    }
    setIsNewUser(true);
    setBusy(null);
    setStep("details");
  };

  const onSendDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (firstName.trim().length < 1 || lastName.trim().length < 1) {
      setError("Please enter your first and last name.");
      return;
    }
    await doSend(false);
  };

  const onVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 6) {
      setError("Enter the 6-digit code from your email.");
      return;
    }
    setError(null);
    setBusy("verify");
    const res = await verifyCode({
      email: email.trim().toLowerCase(),
      code,
      ...(isNewUser
        ? { firstName: firstName.trim(), lastName: lastName.trim(), acceptsMarketing }
        : {}),
    });
    setBusy(null);
    if (!res.ok) {
      setError(errorText(res.reason));
      return;
    }
    close(false);
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={close}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          className={cn(
            "fixed inset-x-0 bottom-0 z-50 overflow-hidden rounded-t-2xl shadow-xl outline-none",
            "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom",
            "sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:w-full sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl",
            "sm:data-[state=open]:slide-in-from-bottom-0 sm:data-[state=closed]:slide-out-to-bottom-0 sm:data-[state=open]:zoom-in-95 sm:data-[state=closed]:zoom-out-95",
          )}
          style={{ background: CREAM, color: INK }}
        >
          <DialogPrimitive.Close
            className="absolute right-3 top-3 rounded-full p-1 opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-black/30"
            style={{ color: INK }}
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>

          <div className="px-5 pt-6 pb-6">
            <img
              src="/brand/fyxx-rewards-logo-black.svg"
              alt="Fyxx Rewards"
              width={746}
              height={392}
              loading="lazy"
              className="mx-auto h-7 w-auto"
            />

            {step === "email" && (
              <form onSubmit={onContinue} className="mt-4 space-y-3">
                <DialogPrimitive.Title style={SERIF} className="text-center text-xl">
                  Log in or join Fyxx Rewards
                </DialogPrimitive.Title>
                <DialogPrimitive.Description
                  className="text-center text-sm"
                  style={{ color: MUTED }}
                >
                  Use the same email as your Fyxx Rewards account, so your Friday points land in
                  your balance.
                </DialogPrimitive.Description>
                <Field
                  id="rw-email"
                  label="Email"
                  type="email"
                  required
                  autoFocus
                  maxLength={200}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@domain.com"
                />
                <SubmitBtn busy={busy === "continue"} label="Continue" />
                {error && <ErrorLine text={error} />}
              </form>
            )}

            {step === "details" && (
              <form onSubmit={onSendDetails} className="mt-4 space-y-3">
                <DialogPrimitive.Title style={SERIF} className="text-center text-xl">
                  Create your account
                </DialogPrimitive.Title>
                <DialogPrimitive.Description
                  className="text-center text-sm"
                  style={{ color: MUTED }}
                >
                  New here. Tell us who you are. <span style={{ color: INK }}>{email}</span>
                </DialogPrimitive.Description>
                <div className="grid grid-cols-2 gap-2">
                  <Field
                    id="rw-first"
                    label="First name"
                    required
                    autoFocus
                    maxLength={50}
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="First"
                  />
                  <Field
                    id="rw-last"
                    label="Last name"
                    required
                    maxLength={50}
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Last"
                  />
                </div>
                <label className="flex cursor-pointer items-start gap-2 text-left">
                  <input
                    type="checkbox"
                    checked={acceptsMarketing}
                    onChange={(e) => setAcceptsMarketing(e.target.checked)}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-black"
                  />
                  <span className="text-[11px] leading-relaxed" style={{ color: MUTED }}>
                    Email me Fyxx offers, results and rewards. Unsubscribe anytime.
                  </span>
                </label>
                <SubmitBtn busy={busy === "details"} label="Send me a code" icon />
                <BackLink
                  onClick={() => {
                    setStep("email");
                    setError(null);
                  }}
                />
                {error && <ErrorLine text={error} />}
              </form>
            )}

            {step === "code" && (
              <form onSubmit={onVerify} className="mt-4 space-y-3">
                <DialogPrimitive.Title style={SERIF} className="text-center text-xl">
                  Enter your code
                </DialogPrimitive.Title>
                <DialogPrimitive.Description
                  className="text-center text-sm"
                  style={{ color: MUTED }}
                >
                  {greeting ? `${greeting} ` : ""}We sent a 6-digit code to{" "}
                  <span style={{ color: INK }}>{email}</span>.
                </DialogPrimitive.Description>
                <input
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="\d*"
                  maxLength={6}
                  autoFocus
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value.replace(/\D/g, "").slice(0, 6));
                    setError(null);
                  }}
                  placeholder="000000"
                  className="mx-auto block h-14 w-48 rounded-xl text-center font-mono text-2xl tracking-[0.4em] outline-none focus:ring-2 focus:ring-black/20"
                  style={inputStyle}
                />
                <SubmitBtn
                  busy={busy === "verify"}
                  label="Verify code"
                  disabled={code.length !== 6}
                />
                <div className="flex items-center justify-between text-xs">
                  <BackLink
                    onClick={() => {
                      setStep("email");
                      setCode("");
                      setError(null);
                      setInfo(null);
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => doSend(true)}
                    disabled={busy !== null}
                    className="font-semibold underline underline-offset-2 disabled:opacity-50"
                    style={{ color: INK }}
                  >
                    {busy === "resend" ? "Sending..." : "Resend code"}
                  </button>
                </div>
                {info && (
                  <p className="text-center text-sm" style={{ color: MUTED }}>
                    {info}
                  </p>
                )}
                {error && <ErrorLine text={error} />}
              </form>
            )}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function SubmitBtn({
  busy,
  label,
  disabled,
  icon,
}: {
  busy: boolean;
  label: string;
  disabled?: boolean;
  icon?: boolean;
}) {
  return (
    <button
      type="submit"
      disabled={busy || disabled}
      className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full text-sm font-semibold text-white transition-opacity hover:opacity-85 disabled:opacity-50"
      style={{ background: INK }}
    >
      {busy ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <>
          {icon && <Mail className="h-4 w-4" />}
          {label}
        </>
      )}
    </button>
  );
}

function BackLink({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 text-xs"
      style={{ color: MUTED }}
    >
      <ArrowLeft className="h-3 w-3" /> Use a different email
    </button>
  );
}

function ErrorLine({ text }: { text: string }) {
  return (
    <p className="text-center text-sm" style={{ color: "#b00020" }}>
      {text}
    </p>
  );
}

/**
 * The button shown in the rewards strip / cart sheet. Signed out: opens the
 * sign-in sheet. Signed in: greets the member by name.
 */
export function RewardsLoginButton({
  where,
  className,
  label = "Log in",
  variant = "solid",
}: {
  where: RewardsWhere;
  className?: string;
  label?: string;
  variant?: "solid" | "outline";
}) {
  const { signedIn, firstName, signOut } = useRewardsAuth();
  const [open, setOpen] = useState(false);

  if (signedIn) {
    return (
      <button
        type="button"
        onClick={() => void signOut()}
        title="Sign out"
        className={cn(
          "group inline-flex h-9 items-center justify-center gap-1.5 rounded-full px-4 text-sm font-semibold transition-opacity hover:opacity-80",
          className,
        )}
        style={{ border: `1px solid ${INK}`, color: INK }}
      >
        Hi{firstName ? `, ${firstName}` : " there"} 👋
        <span className="text-[11px] font-normal opacity-60 group-hover:opacity-100">Sign out</span>
      </button>
    );
  }

  const style =
    variant === "solid"
      ? { background: INK, color: "#fff" }
      : { border: `1px solid ${INK}`, color: INK };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          trackTierPointsLoginTap(where);
          setOpen(true);
        }}
        className={cn(
          "inline-flex h-9 items-center justify-center rounded-full px-5 text-sm font-semibold transition-opacity hover:opacity-85",
          className,
        )}
        style={style}
      >
        {label}
      </button>
      <SignInDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
