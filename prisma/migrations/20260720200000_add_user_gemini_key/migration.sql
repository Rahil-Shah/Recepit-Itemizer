-- AlterTable
ALTER TABLE "users" ADD COLUMN     "geminiKeyCiphertext" TEXT,
ADD COLUMN     "geminiKeyIv" TEXT,
ADD COLUMN     "geminiKeyAuthTag" TEXT;
