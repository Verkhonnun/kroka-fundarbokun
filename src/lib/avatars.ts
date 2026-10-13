import avatar1 from "@/assets/avatars/avatar-1.png";
import avatar2 from "@/assets/avatars/avatar-2.png";
import avatar3 from "@/assets/avatars/avatar-3.png";
import avatar4 from "@/assets/avatars/avatar-4.png";
import avatar5 from "@/assets/avatars/avatar-5.png";
import avatar6 from "@/assets/avatars/avatar-6.png";
import avatar7 from "@/assets/avatars/avatar-7.png";
import avatar8 from "@/assets/avatars/avatar-8.png";
import avatar9 from "@/assets/avatars/avatar-9.png";
import avatar10 from "@/assets/avatars/avatar-10.png";

export const systemAvatars = [
  { id: 1, src: avatar1, alt: "Kaffibolli" },
  { id: 2, src: avatar2, alt: "Kaktus" },
  { id: 3, src: avatar3, alt: "Kleinuhringur" },
  { id: 4, src: avatar4, alt: "Lama" },
  { id: 5, src: avatar5, alt: "Avókadó" },
  { id: 6, src: avatar6, alt: "Ugla" },
  { id: 7, src: avatar7, alt: "Mörgæs" },
  { id: 8, src: avatar8, alt: "Sveppur" },
  { id: 9, src: avatar9, alt: "Vélmenni" },
  { id: 10, src: avatar10, alt: "Bangsi" },
];

export interface AvatarSource {
  avatar_choice?: string | null;
  system_avatar_id?: number | null;
  avatar_url?: string | null;
}

export const getAvatarUrl = (p?: AvatarSource | null): string | undefined => {
  if (!p) return undefined;
  if (p.avatar_choice === "custom" && p.avatar_url) return p.avatar_url;
  return systemAvatars.find((a) => a.id === p.system_avatar_id)?.src ?? p.avatar_url ?? undefined;
};

export const initials = (name?: string | null, email?: string | null) => {
  const source = (name || email || "?").trim();
  const parts = source.split(/\s+/);
  return (parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : source.slice(0, 2)).toUpperCase();
};
