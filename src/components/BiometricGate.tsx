import { ReactNode, useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Fingerprint, Loader2, KeyRound, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

const SESSION_OK = "bio_verified_session";
const CRED_KEY = (uid: string) => `bio_cred_${uid}`;
const PIN_KEY = (uid: string) => `bio_pin_${uid}`;

function b64u(buf: ArrayBuffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function fromB64u(s: string) {
  const p = s.replace(/-/g, "+").replace(/_/g, "/");
  const pad = p + "=".repeat((4 - (p.length % 4)) % 4);
  return Uint8Array.from(atob(pad), c => c.charCodeAt(0));
}

async function hashPin(uid: string, pin: string) {
  const data = new TextEncoder().encode(`${uid}:${pin}:camplink`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return b64u(digest);
}

const supported = () =>
  typeof window !== "undefined" &&
  window.isSecureContext &&
  !!(window as any).PublicKeyCredential &&
  !!navigator.credentials;

type Mode = "bio" | "pin-setup" | "pin-verify";

export const BiometricGate = ({ children }: { children: ReactNode }) => {
  const { user, signOut } = useAuth();
  const [verified, setVerified] = useState(
    () => sessionStorage.getItem(SESSION_OK) === "1"
  );
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<Mode>("bio");
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  const [bioAvailable, setBioAvailable] = useState(true);

  useEffect(() => {
    if (!user || verified) return;
    const hasPin = !!localStorage.getItem(PIN_KEY(user.id));
    if (!supported()) {
      setBioAvailable(false);
      setMode(hasPin ? "pin-verify" : "pin-setup");
      return;
    }
    // Auto-prompt biometric once
    void promptBio();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  if (!user || verified) return <>{children}</>;

  async function enroll(uid: string) {
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const userId = new TextEncoder().encode(uid);
    const cred = (await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: { name: "Camplink" },
        user: { id: userId, name: uid, displayName: "Camplink User" },
        pubKeyCredParams: [
          { type: "public-key", alg: -7 },
          { type: "public-key", alg: -257 },
        ],
        authenticatorSelection: {
          authenticatorAttachment: "platform",
          userVerification: "required",
          residentKey: "preferred",
        },
        timeout: 60000,
        attestation: "none",
      },
    })) as PublicKeyCredential | null;
    if (!cred) throw new Error("No credential");
    localStorage.setItem(CRED_KEY(uid), b64u(cred.rawId));
  }

  async function verify(uid: string, credIdB64: string) {
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const res = await navigator.credentials.get({
      publicKey: {
        challenge,
        timeout: 60000,
        userVerification: "required",
        allowCredentials: [{ type: "public-key", id: fromB64u(credIdB64) }],
      },
    });
    if (!res) throw new Error("No assertion");
  }

  async function promptBio() {
    if (!user) return;
    setBusy(true);
    try {
      const existing = localStorage.getItem(CRED_KEY(user.id));
      if (!existing) await enroll(user.id);
      else await verify(user.id, existing);
      sessionStorage.setItem(SESSION_OK, "1");
      setVerified(true);
    } catch (e: any) {
      const cancelled = e?.message?.includes("NotAllowed") || e?.name === "NotAllowedError";
      const unsupported = e?.name === "NotSupportedError" || e?.name === "SecurityError";
      if (unsupported) setBioAvailable(false);
      toast.error(cancelled ? "Biometric cancelled — use your PIN" : "Biometric unavailable — use your PIN");
      const hasPin = !!localStorage.getItem(PIN_KEY(user.id));
      setMode(hasPin ? "pin-verify" : "pin-setup");
    } finally {
      setBusy(false);
    }
  }

  async function submitPinSetup() {
    if (!user) return;
    if (!/^\d{4,8}$/.test(pin)) { toast.error("PIN must be 4–8 digits"); return; }
    if (pin !== pin2) { toast.error("PINs don't match"); return; }
    setBusy(true);
    try {
      const h = await hashPin(user.id, pin);
      localStorage.setItem(PIN_KEY(user.id), h);
      sessionStorage.setItem(SESSION_OK, "1");
      toast.success("PIN set");
      setVerified(true);
    } finally { setBusy(false); }
  }

  async function submitPinVerify() {
    if (!user) return;
    if (!/^\d{4,8}$/.test(pin)) { toast.error("Enter your PIN"); return; }
    setBusy(true);
    try {
      const h = await hashPin(user.id, pin);
      const stored = localStorage.getItem(PIN_KEY(user.id));
      if (h !== stored) { toast.error("Incorrect PIN"); setPin(""); return; }
      sessionStorage.setItem(SESSION_OK, "1");
      setVerified(true);
    } finally { setBusy(false); }
  }

  return (
    <div className="min-h-screen grid place-items-center p-6">
      <div className="max-w-sm w-full text-center rounded-3xl bg-card/80 border border-primary/20 shadow-lux p-8 backdrop-blur-xl">
        <div className="mx-auto w-16 h-16 rounded-2xl gradient-accent grid place-items-center mb-4">
          {mode === "bio" ? <Fingerprint className="h-8 w-8 text-white" /> : <ShieldCheck className="h-8 w-8 text-white" />}
        </div>
        <h2 className="font-serif text-2xl mb-1">Unlock Camplink</h2>
        <p className="text-sm text-muted-foreground mb-5">
          {mode === "bio" && "Verify with fingerprint, Face ID or device PIN."}
          {mode === "pin-setup" && "Create a backup PIN to unlock when biometrics aren't available."}
          {mode === "pin-verify" && "Enter your Camplink PIN to continue."}
        </p>

        {mode === "bio" && (
          <>
            <Button className="w-full gradient-accent shadow-neon" onClick={promptBio} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Fingerprint className="h-4 w-4 mr-2" />}
              {localStorage.getItem(CRED_KEY(user.id)) ? "Unlock" : "Enable & unlock"}
            </Button>
            <button
              onClick={() => setMode(localStorage.getItem(PIN_KEY(user.id)) ? "pin-verify" : "pin-setup")}
              className="mt-4 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
            >
              <KeyRound className="h-3 w-3" /> Use PIN instead
            </button>
          </>
        )}

        {mode === "pin-setup" && (
          <div className="space-y-3 text-left">
            <div>
              <Label>New PIN (4–8 digits)</Label>
              <Input inputMode="numeric" maxLength={8} type="password" value={pin}
                onChange={e => setPin(e.target.value.replace(/\D/g, ""))} placeholder="••••" />
            </div>
            <div>
              <Label>Confirm PIN</Label>
              <Input inputMode="numeric" maxLength={8} type="password" value={pin2}
                onChange={e => setPin2(e.target.value.replace(/\D/g, ""))} placeholder="••••" />
            </div>
            <Button className="w-full gradient-accent shadow-neon" onClick={submitPinSetup} disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Set PIN & unlock
            </Button>
          </div>
        )}

        {mode === "pin-verify" && (
          <div className="space-y-3 text-left">
            <div>
              <Label>Your PIN</Label>
              <Input inputMode="numeric" maxLength={8} type="password" value={pin} autoFocus
                onChange={e => setPin(e.target.value.replace(/\D/g, ""))}
                onKeyDown={e => { if (e.key === "Enter") submitPinVerify(); }}
                placeholder="••••" />
            </div>
            <Button className="w-full gradient-accent shadow-neon" onClick={submitPinVerify} disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Unlock
            </Button>
            {bioAvailable && (
              <button onClick={() => setMode("bio")}
                className="w-full text-center text-xs text-muted-foreground hover:text-primary">
                Try biometric instead
              </button>
            )}
          </div>
        )}

        <div className="mt-5 flex items-center justify-center gap-4 text-xs">
          <button
            onClick={() => { sessionStorage.setItem(SESSION_OK, "1"); setVerified(true); }}
            className="text-muted-foreground hover:text-primary"
          >
            Skip for now
          </button>
          <span className="text-muted-foreground/40">•</span>
          <button
            onClick={() => { void signOut(); }}
            className="text-muted-foreground hover:text-destructive"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
};
