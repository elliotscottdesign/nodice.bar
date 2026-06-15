import AdminPageHeader from "@/components/admin/AdminPageHeader";
import MediaLibraryClient from "./MediaLibraryClient";

export const metadata = { title: "Media library — No Dice Admin" };

export default function MediaLibraryPage() {
  return (
    <>
      <AdminPageHeader
        title="Media library"
        description="Upload and manage images, video and files. Copy a URL to use anywhere on the site, or delete what you no longer need."
      />
      <MediaLibraryClient />
    </>
  );
}
