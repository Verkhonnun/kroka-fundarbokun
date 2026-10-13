import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getAvatarUrl, initials, type AvatarSource } from "@/lib/avatars";
import { cn } from "@/lib/utils";

interface UserAvatarProps {
  profile?: (AvatarSource & { full_name?: string | null; email?: string | null }) | null;
  className?: string;
}

const UserAvatar = ({ profile, className }: UserAvatarProps) => (
  <Avatar className={cn("h-8 w-8", className)}>
    <AvatarImage src={getAvatarUrl(profile)} alt={profile?.full_name ?? ""} className="object-cover" />
    <AvatarFallback className="bg-secondary text-[0.7em] font-semibold text-secondary-foreground">
      {initials(profile?.full_name, profile?.email)}
    </AvatarFallback>
  </Avatar>
);

export default UserAvatar;
