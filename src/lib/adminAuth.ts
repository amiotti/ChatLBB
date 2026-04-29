import { cookies } from "next/headers";

export async function isAdminRequest() {
  const cookieStore = await cookies();

  return cookieStore.get("chat_admin")?.value === "1";
}
