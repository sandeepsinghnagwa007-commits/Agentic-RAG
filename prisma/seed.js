const { PrismaClient } = require("@prisma/client");
const { PrismaBetterSqlite3 } = require("@prisma/adapter-better-sqlite3");

// Connect using the url option parameter configuration for Prisma v7
const databaseUrl = process.env.DATABASE_URL || "file:./prisma/dev.db";
const adapter = new PrismaBetterSqlite3({ url: databaseUrl });
const prisma = new PrismaClient({ adapter });

async function main() {
  const email = "student@learnrag.edu";
  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (!existingUser) {
    const hashedPassword = await bcryptHash("password123");
    await prisma.user.create({
      data: {
        email,
        name: "Demo Student",
        password: hashedPassword,
        progress: {
          createMany: {
            data: [
              { stepName: "INGESTION", status: "NOT_STARTED" },
              { stepName: "RETRIEVAL", status: "NOT_STARTED" },
              { stepName: "GENERATION", status: "NOT_STARTED" },
            ],
          },
        },
      },
    });
    console.log("Database seeded! Default student account: student@learnrag.edu / password123");
  } else {
    console.log("Default student account already exists in database.");
  }
}

// Simple async bcrypt hash inside JS helper (or bcryptjs standard)
async function bcryptHash(password) {
  const bcrypt = require("bcryptjs");
  return bcrypt.hash(password, 10);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
