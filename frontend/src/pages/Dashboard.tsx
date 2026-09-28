import { useNavigate } from "react-router-dom";
import { useSession, signOut } from "@/lib/auth-client";

export default function Dashboard() {
  const navigate = useNavigate();
  const { data: session, isPending } = useSession();

  if (isPending) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  if (!session) {
    navigate("/auth/sign-in");
    return null;
  }

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth/sign-in");
  };

  return (
    <div className="min-h-screen bg-background text-foreground p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">
              Welcome, {session.user.name || "User"} 👋
            </h1>

            <p className="text-muted-foreground mt-2">
              {session.user.email}
            </p>
          </div>

          <button
            onClick={handleSignOut}
            className="px-4 py-2 rounded-md bg-primary text-primary-foreground cursor-pointer"
          >
            Sign out
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="rounded-xl border bg-card p-6">
            <h2 className="font-semibold text-lg">Projects</h2>
            <p className="text-muted-foreground mt-2">
              Your projects will appear here.
            </p>
          </div>

          <div className="rounded-xl border bg-card p-6">
            <h2 className="font-semibold text-lg">Activity</h2>
            <p className="text-muted-foreground mt-2">
              Recent activity will appear here.
            </p>
          </div>

          <div className="rounded-xl border bg-card p-6">
            <h2 className="font-semibold text-lg">Account</h2>
            <p className="text-muted-foreground mt-2">
              Manage your account settings.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}