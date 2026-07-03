import { ReactNode, useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Fingerprint, Loader2 } from "lucide-react";
import { toast } from "sonner";

const SESSION_OK = "bio_verified_session";
const CRED_KEY = (uid: string) => `bio_cred_${uid}`;

function b64u(buf: ArrayBuffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function fromB64u(s: string) {
  const p = s.replace(/-/g, "+").replace(/_/g, "/");
  const pad = p + "=".repeat((4 - (p.length % 4)) % 4);
  return Uint8Array.from(atob(pad), c => c.charCodeAt(0));
}

const supported = () =>
  typeof window !== "undefined" &&
  window.isSecureContext &&
  !!(window as any).PublicKeyCredential &&
  !!navigator.credentials;

export const BiometricGate = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [verified, setVerified] = useState(
    () => sessionStorage.getItem(SESSION_OK) === "1"
  );
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user || verified) return;
    if (!supported()) { setVerified(true); return; }
    // Auto-prompt once on mount
    void prompt();
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
        allowCredentials: [
          { type: "public-key", id: fromB64u(credIdB64) },
        ],
      },
    });
    if (!res) throw new Error("No assertion");
  }

  async function prompt() {
    if (!user) return;
    setBusy(true);
    try {
      const existing = localStorage.getItem(CRED_KEY(user.id));
      if (!existing) {
        await enroll(user.id);
      } else {
        await verify(user.id, existing);
      }
      sessionStorage.setItem(SESSION_OK, "1");
      setVerified(true);
    } catch (e: any) {
      toast.error(e?.message?.includes("NotAllowed")
        ? "Biometric cancelled"
        : "Biometric failed — try again");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen grid place-items-center p-6">
      <div className="max-w-sm w-full text-center rounded-3xl bg-card/80 border border-primary/20 shadow-lux p-8 backdrop-blur-xl">
        <div className="mx-auto w-16 h-16 rounded-2xl gradient-accent grid place-items-center mb-4">
          <Fingerprint className="h-8 w-8 text-white" />
        </div>
        <h2 className="font-serif text-2xl mb-1">Unlock Camplink</h2>
        <p className="text-sm text-muted-foreground mb-5">
          Verify with your fingerprint, Face ID or device PIN to continue.
        </p>
        <Button className="w-full gradient-accent shadow-neon" onClick={prompt} disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Fingerprint className="h-4 w-4 mr-2" />}
          {localStorage.getItem(CRED_KEY(user.id)) ? "Unlock" : "Enable & unlock"}
        </Button>
        <button
          onClick={() => { sessionStorage.setItem(SESSION_OK, "1"); setVerified(true); }}
          className="mt-4 text-xs text-muted-foreground hover:text-primary"
        >
          Skip for now
        </button>
      </div>
    </div>
  );
};
