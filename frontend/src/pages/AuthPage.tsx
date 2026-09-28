import {
  useParams,
} from "react-router-dom";

import { Auth } from "@/components/auth/auth";

export default function AuthPage() {
  const { path } = useParams();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Auth path={path} />
    </div>
  );
}