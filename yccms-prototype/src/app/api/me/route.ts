import { withAuth } from "@/lib/api/api-route-helpers";

export const GET = withAuth(async (_req, auth) => ({ id: auth.user.id, ...auth.profile }));
