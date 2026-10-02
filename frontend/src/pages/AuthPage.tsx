import { useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { Auth } from "@/components/auth/auth";
import { api } from "@/lib/api";
import { UserCheck, Loader2, AlertCircle } from "lucide-react";

export default function AuthPage() {
  const { path } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [loadingGuest, setLoadingGuest] = useState(false);

  const authError = searchParams.get("error");
  const authErrorDesc = searchParams.get("error_description");

  const handleGuestLogin = async () => {
    try {
      setLoadingGuest(true);
      await api.loginAsGuest();
      navigate("/dashboard");
    } catch (err) {
      console.error("Guest login failed:", err);
    } finally {
      setLoadingGuest(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        {authError && (
          <div className="mb-4 p-3 rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
            <div>
              <p className="font-medium text-red-300">Sign-in Notice: {authError.replace(/_/g, " ")}</p>
              {authErrorDesc && <p className="mt-0.5 text-red-400/80">{authErrorDesc}</p>}
            </div>
          </div>
        )}
        <Auth path={path} />

        <div className="mt-4 text-center">
          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                or explore without an account
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleGuestLogin}
            disabled={loadingGuest}
            className="w-full inline-flex items-center justify-center gap-2 rounded-md border border-input bg-card/60 hover:bg-accent hover:text-accent-foreground px-4 py-2.5 text-sm font-medium transition-colors shadow-sm cursor-pointer"
          >
            {loadingGuest ? (
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            ) : (
              <UserCheck className="w-4 h-4 text-emerald-400" />
            )}
            Continue as Guest
          </button>
        </div>
      </div>
    </div>
  );
}