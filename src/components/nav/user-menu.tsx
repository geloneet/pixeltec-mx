"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { ChevronDown, LogOut, Moon, Sun, User } from "lucide-react";
import { signOut } from "next-auth/react";
import { useTheme } from "next-themes";
import { useUser } from "@/hooks/use-user";
import { useUserProfile } from "@/hooks/use-user-profile";
import { isRestrictedRole } from "@/lib/routes/reviewer-access";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/** Segunda línea del topbar (D-8): el rol real de la sesión, nunca un texto fijo. */
const ROLE_LABEL: Record<string, string> = {
  admin: "Administrador",
  staff: "Staff",
  reviewer: "Revisor",
};

function getInitials(displayName: string | null, email: string | null): string {
  if (displayName && displayName.trim().length > 0) {
    return displayName.trim()[0].toUpperCase();
  }
  if (email) return email[0].toUpperCase();
  return "U";
}

export function UserMenu() {
  const router = useRouter();
  const user = useUser();
  const { userProfile } = useUserProfile();
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme !== "light";

  const handleLogout = async () => {
    await signOut({ redirectTo: "/login" });
  };

  if (!user) return null;

  const initials = getInitials(user.displayName, user.email);
  const isAdmin = userProfile?.role === "admin";
  // WO-2026-00051: el reviewer no tiene /perfil (bloqueado en middleware);
  // se oculta el enlace — presentación, no enforcement.
  const canOpenProfile = !userProfile || !isRestrictedRole(userProfile.role);
  const roleLabel = userProfile?.role ? ROLE_LABEL[userProfile.role] ?? null : null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Menú de usuario"
          className="flex flex-shrink-0 items-center gap-2.5 rounded-lg py-1 pl-1 pr-2 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <div className="relative h-9 w-9 flex-shrink-0 overflow-hidden rounded-full">
            {user.photoURL ? (
              <Image
                src={user.photoURL}
                alt={user.displayName ?? "Avatar"}
                fill
                className="object-cover"
                sizes="40px"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-primary">
                <span className="select-none text-xs font-semibold uppercase text-primary-foreground">
                  {initials}
                </span>
              </div>
            )}
          </div>
          <span className="hidden min-w-0 flex-col leading-tight xl:flex">
            <span className="max-w-[140px] truncate text-[13px] font-semibold text-foreground">
              {user.displayName ?? user.email ?? "Usuario"}
            </span>
            {roleLabel && <span className="text-[11px] text-muted-foreground">{roleLabel}</span>}
          </span>
          <ChevronDown className="hidden h-4 w-4 text-muted-foreground xl:block" aria-hidden />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="w-64 bg-popover/95 backdrop-blur-xl border border-border shadow-xl dark:shadow-[0_0_60px_-15px_rgba(0,0,0,0.6)] rounded-xl p-1"
      >
        {/* Header con foto grande */}
        <DropdownMenuLabel className="flex items-center gap-3 px-2 py-2">
          <div className="relative h-12 w-12 rounded-full overflow-hidden flex-shrink-0">
            {user.photoURL ? (
              <Image
                src={user.photoURL}
                alt={user.displayName ?? "Avatar"}
                fill
                className="object-cover"
                sizes="48px"
              />
            ) : (
              <div className="h-full w-full flex items-center justify-center bg-gradient-to-br from-sky-500 to-indigo-600">
                <span className="text-white text-sm font-semibold uppercase select-none">
                  {initials}
                </span>
              </div>
            )}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-foreground font-semibold text-sm truncate">
              {user.displayName ?? "Usuario"}
            </span>
            <span className="text-muted-foreground text-xs truncate">{user.email}</span>
            {isAdmin && (
              <span className="mt-0.5 self-start text-[10px] font-bold bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 rounded-full px-1.5 py-0.5 leading-none">
                admin
              </span>
            )}
          </div>
        </DropdownMenuLabel>

        <DropdownMenuSeparator className="bg-border" />

        {canOpenProfile && (
        <DropdownMenuItem
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground focus:text-foreground focus:bg-accent rounded-lg cursor-pointer px-2 py-2 text-sm"
          onClick={() => router.push("/perfil")}
        >
          <User className="h-4 w-4 flex-shrink-0" />
          Perfil y seguridad
        </DropdownMenuItem>
        )}

        {/* D-15: el toggle de tema vive aquí (antes solo en el header público). */}
        <DropdownMenuItem
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground focus:text-foreground focus:bg-accent rounded-lg cursor-pointer px-2 py-2 text-sm"
          onSelect={(e) => {
            e.preventDefault();
            setTheme(isDark ? "light" : "dark");
          }}
        >
          {isDark ? <Sun className="h-4 w-4 flex-shrink-0" /> : <Moon className="h-4 w-4 flex-shrink-0" />}
          {isDark ? "Modo claro" : "Modo oscuro"}
        </DropdownMenuItem>

        <DropdownMenuSeparator className="bg-border" />

        <DropdownMenuItem
          className="flex items-center gap-2 text-rose-500 dark:text-rose-400 hover:text-rose-600 dark:hover:text-rose-300 focus:text-rose-600 dark:focus:text-rose-300 focus:bg-rose-500/10 rounded-lg cursor-pointer px-2 py-2 text-sm"
          onClick={handleLogout}
        >
          <LogOut className="h-4 w-4 flex-shrink-0" />
          Cerrar sesión
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
