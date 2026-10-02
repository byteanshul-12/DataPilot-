import { ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Layers,
  LogOut,
  LogIn,
} from "lucide-react";
import { useSession, signOut } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";

export function AppLayout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { data: session } = useSession();

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth/sign-in");
  };

  const navItems = [
    {
      label: "Dashboard",
      href: "/dashboard",
      icon: LayoutDashboard,
    },
    {
      label: "Workflows",
      href: "/workflows",
      icon: Layers,
    },
  ];

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black text-zinc-900 dark:text-zinc-100 font-sans transition-colors duration-200">

      {/* Navbar */}
      <header className="sticky top-0 z-50 border-b border-zinc-200/80 dark:border-white/5 bg-white/80 dark:bg-black/90 backdrop-blur-xl transition-colors duration-200">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6">

          {/* Left side */}
          <div className="flex h-full items-center gap-8">
            {/* grid  */}
            <div
              className="pointer-events-none absolute inset-0 opacity-[0.03] dark:opacity-[0.07]"
              style={{
                backgroundImage: `
                  linear-gradient(to right, currentColor 1px, transparent 1px),
                  linear-gradient(to bottom, currentColor 1px, transparent 1px)
                `,
                backgroundSize: "48px 48px",
              }}
            />

            {/* logo  */}
            <Link
              to="/dashboard"
              className="flex items-center gap-2.5 text-sm font-semibold tracking-tight text-zinc-900 dark:text-white"
            >
              <span>
                <span className="text-lg">Data Pilot</span>
              </span>
            </Link>

            {/* navigation  */}
            <nav className="flex h-full items-center gap-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = location.pathname.startsWith(item.href);

                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    className={`
                      relative flex h-full items-center gap-2 px-3
                      text-sm font-medium transition-colors
                      ${
                        active
                          ? "text-zinc-900 dark:text-white font-semibold"
                          : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
                      }
                    `}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* right side  */}
          <div className="flex items-center gap-2.5">
            <ThemeToggle />

            {session?.user ? (
              <>
                <div className="mx-1 h-5 w-px bg-zinc-200 dark:bg-zinc-800" />

                {/* Avatar */}
                <div className="flex h-8 w-8 items-center justify-center rounded-full border border-zinc-300 dark:border-zinc-800 bg-zinc-900 dark:bg-white text-xs font-semibold text-white dark:text-black">
                  {(session.user.name || session.user.email || "U")
                    .charAt(0)
                    .toUpperCase()}
                </div>

                {/* sign out  */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSignOut}
                  className="h-9 cursor-pointer rounded-md px-2.5 text-xs text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-200"
                >
                  <LogOut className="mr-1.5 h-3.5 w-3.5" />
                  Sign out
                </Button>
              </>
            ) : (
              <>
                <div className="mx-1 h-5 w-px bg-zinc-200 dark:bg-zinc-800" />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate("/auth/sign-in")}
                  className="h-8 gap-1.5 text-xs rounded-md"
                >
                  <LogIn className="h-3.5 w-3.5" />
                  Sign in
                </Button>
              </>
            )}
          </div>

        </div>
      </header>

      {/* Main */}
      <main className="min-h-[calc(100vh-3.5rem)]">
        {children}
      </main>

    </div>
  );
}

