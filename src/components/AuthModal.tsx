import { AnimatePresence, motion } from "motion/react";
import { LoaderCircle, Mail, X } from "lucide-react";

type AuthModalPhase = "idle" | "sending" | "sent" | "callback";

interface AuthModalProps {
  email: string;
  error: string | null;
  isOpen: boolean;
  onClose: () => void;
  onEmailChange: (value: string) => void;
  onSubmit: () => void;
  pendingStart: boolean;
  phase: AuthModalPhase;
}

export function AuthModal({
  email,
  error,
  isOpen,
  onClose,
  onEmailChange,
  onSubmit,
  pendingStart,
  phase,
}: AuthModalProps) {
  const isBusy = phase === "sending" || phase === "callback";

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 px-4 backdrop-blur-xl"
        >
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.98 }}
            className="relative w-full max-w-md rounded-[2rem] border border-white/10 bg-[#050505] p-8 text-white shadow-[0_0_120px_rgba(0,0,0,0.6)]"
          >
            <button
              type="button"
              onClick={onClose}
              disabled={phase === "callback"}
              className="absolute right-4 top-4 rounded-full border border-white/10 bg-white/5 p-2 text-zinc-400 transition hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="mb-8 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
                {phase === "callback" ? (
                  <LoaderCircle className="h-5 w-5 animate-spin text-white" />
                ) : (
                  <Mail className="h-5 w-5 text-white" />
                )}
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-zinc-500">
                  Supabase Auth
                </p>
                <h2 className="font-serif text-2xl italic tracking-tight text-white">
                  {phase === "callback"
                    ? "Completing sign in"
                    : pendingStart
                      ? "Sign in to continue"
                      : "Access your workspace"}
                </h2>
              </div>
            </div>

            {phase === "sent" ? (
              <div className="space-y-4">
                <p className="text-sm leading-6 text-zinc-400">
                  Magic link sent to <span className="text-white">{email}</span>. Open the email on this device to complete sign-in.
                </p>
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-600">
                  Invite-only access is enforced. Unknown emails will not get workspace access.
                </p>
              </div>
            ) : phase === "callback" ? (
              <div className="space-y-4">
                <p className="text-sm leading-6 text-zinc-400">
                  Restoring your session and unlocking the private document flow.
                </p>
              </div>
            ) : (
              <form
                className="space-y-5"
                onSubmit={(event) => {
                  event.preventDefault();
                  void onSubmit();
                }}
              >
                <p className="text-sm leading-6 text-zinc-400">
                  Use your invited email address to receive a one-time magic link. Passwords are not used in this workspace.
                </p>
                <label className="block space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-zinc-500">
                    Email Address
                  </span>
                  <input
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(event) => onEmailChange(event.target.value)}
                    placeholder="you@example.com"
                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-white/30 focus:bg-white/[0.08]"
                  />
                </label>

                {error && (
                  <p className="rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={isBusy}
                  className="w-full rounded-full bg-white px-6 py-4 text-[10px] font-bold uppercase tracking-[0.35em] text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {phase === "sending" ? "Sending Link..." : "Send Magic Link"}
                </button>
              </form>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
