import { verifyToken } from "@clerk/backend";
import type { ApiRequest } from "./http";
import { getHeaderValue, HttpError } from "./http";

export type AuthContext = {
  userId: string;
};

export async function requireAuth(req: ApiRequest): Promise<AuthContext> {
  const authorization = getHeaderValue(req.headers.authorization);
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];

  if (!token) {
    throw new HttpError(401, "Authentication required.");
  }

  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) {
    throw new HttpError(500, "CLERK_SECRET_KEY is not configured.");
  }

  try {
    const payload = await verifyToken(token, { secretKey });
    const userId = payload.sub;

    if (!userId) {
      throw new HttpError(401, "Invalid Clerk session.");
    }

    return { userId };
  } catch (error) {
    if (error instanceof HttpError) {
      throw error;
    }

    throw new HttpError(401, "Invalid or expired Clerk session.");
  }
}
