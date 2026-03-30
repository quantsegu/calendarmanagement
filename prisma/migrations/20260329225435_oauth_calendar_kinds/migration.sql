-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CalendarSource" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kind" TEXT NOT NULL DEFAULT 'ICAL',
    "name" TEXT NOT NULL,
    "icalUrl" TEXT,
    "color" TEXT NOT NULL DEFAULT '#6366f1',
    "refreshToken" TEXT,
    "accessToken" TEXT,
    "accessTokenExpiresAt" DATETIME,
    "calendarId" TEXT,
    "accountHint" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_CalendarSource" ("color", "createdAt", "icalUrl", "id", "name", "updatedAt") SELECT "color", "createdAt", "icalUrl", "id", "name", "updatedAt" FROM "CalendarSource";
DROP TABLE "CalendarSource";
ALTER TABLE "new_CalendarSource" RENAME TO "CalendarSource";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
