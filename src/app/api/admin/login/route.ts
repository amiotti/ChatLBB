import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const COOKIE_NAME = "chat_admin";

export async function POST(request: Request) {
  const formData = await request.formData();
  const password = String(formData.get("password") ?? "");
  const expected = process.env.ADMIN_PASSWORD ?? "admin";

  if (password !== expected) {
    return NextResponse.json(
      { ok: false, error: "Clave incorrecta" },
      { status: 401 },
    );
  }

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, "1", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8,
  });

  return NextResponse.redirect(new URL("/admin", request.url));
}

export async function DELETE() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);

  return NextResponse.json({ ok: true });
}
