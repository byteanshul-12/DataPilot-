import { ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Sparkles,
  LayoutDashboard,
  Layers,
  LogOut,
} from "lucide-react";
import { useSession, signOut } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";

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
    <div className="min-h-screen bg-black text-zinc-100 font-sans">

      {/* Navbar */}
      <header className="sticky top-0 z-50 bg-black/90 backdrop-blur-xl">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6">

          {/* Left side */}
          <div className="flex h-full items-center gap-8">
            {/* grid  */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.070]"
          style={{
            backgroundImage: `
              linear-gradient(to right, #ffffff 1px, transparent 1px),
              linear-gradient(to bottom, #ffffff 1px, transparent 1px)
            `,
            backgroundSize: "48px 48px",
          }}
        />

             {/* logo  */}
            <Link
              to="/dashboard"
              className="flex items-center gap-2.5 text-sm font-semibold tracking-tight text-white"
            >

              <span>
                <span className="text-lg" >Data Pilot</span>
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
                      text-base font-medium transition-colors
                      ${
                        active
                          ? "text-white"
                          : "text-zinc-500 hover:text-zinc-200"
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
          {session?.user && (
            <div className="flex items-center gap-3">


              {/* Avatar */}
              <div className="flex h-7.5 w-7.5 items-center justify-center rounded-full border border-zinc-800 bg-white text-[15px] font-medium text-black cursor-pointer">
                {(session.user.name || "U")
                  .charAt(0)
                  .toUpperCase()}
              </div>

              <div className="mx-1 h-5 w-px bg-zinc-800" />

              {/* sign out  */}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSignOut}
                className="h-10 rounded-md px-2.5 text-xs text-zinc-500 hover:bg-zinc-900 hover:text-zinc-200"
              >
                <LogOut className="mr-1.5 h-3.5 w-3.5" />
                Sign out
              </Button>

            </div>
          )}

        </div>
      </header>

      {/* Main */}
      <main className="min-h-[calc(100vh-3.5rem)]">
        {children}
      </main>

    </div>
  );
}

