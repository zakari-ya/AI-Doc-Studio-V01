import type { ApiRequest } from "./http";
import { getSupabaseAdmin } from "./supabase";
import { getHeaderValue, HttpError } from "./http";

export type AuthContext = {
  userId: string;
  email: string | null;
};

export async function requireAuth(req: ApiRequest): Promise<AuthContext> {
  const authorization = getHeaderValue(req.headers, "authorization");
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];

  if (!token) {
    throw new HttpError(401, "Authentication required.");
  }

  const supabase = getSupabaseAdmin();

  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);

    if (error || !user?.id) {
      throw new HttpError(401, "Invalid Supabase session.");
    }

    return {
      userId: user.id,
      email: user.email ?? null,
    };
  } catch (error) {
    if (error instanceof HttpError) {
      throw error;
    }

    throw new HttpError(401, "Invalid or expired Supabase session.");
  }
}
