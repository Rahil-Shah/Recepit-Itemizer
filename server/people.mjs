// The people an account splits receipts with.
//
// Shared by the people routes (server/app.mjs) and the MCP tools
// (server/mcp-tools.mjs), which both need the owner's own entry to exist.

/**
 * The account owner's own participant row. A receipt split three ways should
 * only put a third of the bill in the owner's budget, which needs them to be
 * one of the people it is split between. Created on first use rather than at
 * signup so existing accounts pick one up too.
 */
export async function ensureSelfPerson(prisma, userId) {
  const existing = await prisma.accountPerson.findFirst({
    where: { userId, isSelf: true }
  });
  if (existing) return existing;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true }
  });
  // Fall back through name, the local part of the email, then a plain label:
  // the column is only unique per user, so a collision with a person the user
  // already added by the same name is the one case that needs a distinct name.
  const preferred = (user?.name ?? "").trim() || (user?.email ?? "").split("@")[0].trim() || "Me";
  const candidates = [preferred, `${preferred} (me)`, "Me", "Myself"];

  for (const name of candidates) {
    const taken = await prisma.accountPerson.findUnique({
      where: { userId_name: { userId, name } }
    });
    if (taken) {
      // An ordinary person already holds this name; promote it rather than
      // leaving the user with two rows that mean the same person.
      if (name === preferred) {
        return prisma.accountPerson.update({ where: { id: taken.id }, data: { isSelf: true } });
      }
      continue;
    }
    return prisma.accountPerson.create({ data: { userId, name, isSelf: true } });
  }

  // Every candidate was taken by someone else; fall back to a unique suffix.
  return prisma.accountPerson.create({
    data: { userId, name: `Me ${Date.now().toString(36)}`, isSelf: true }
  });
}
