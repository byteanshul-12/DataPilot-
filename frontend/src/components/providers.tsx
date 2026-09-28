import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";

import { AuthProvider } from "@/components/auth/auth-provider";
import { authClient } from "@/lib/auth-client";

type AuthLinkProps = ComponentPropsWithoutRef<"a"> & {
  href: string;
  to?: string;
};

function AuthLink({
  href,
  children,
  ...props
}: AuthLinkProps) {
  return (
    <Link to={href} {...props}>
      {children}
    </Link>
  );
}

export function Providers({ children }: { children: ReactNode }) {
  const routerNavigate = useNavigate();

  const navigate = ({
    to,
    replace,
  }: {
    to: string;
    replace?: boolean;
  }) => {
    routerNavigate(to, { replace });
  };

  return (
    <AuthProvider
      authClient={authClient}
      navigate={navigate}
      Link={AuthLink}
      redirectTo="/dashboard"
      socialProviders={["google", "github", "apple"]}
    >
      {children}
    </AuthProvider>
  );
}