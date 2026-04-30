import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DB_PATH = ROOT / "prisma" / "dev.db"

DB_PATH.parent.mkdir(parents=True, exist_ok=True)

conn = sqlite3.connect(DB_PATH)
conn.execute("PRAGMA foreign_keys=ON")
conn.executescript(
    """
CREATE TABLE IF NOT EXISTS ImportBatch (
  id TEXT NOT NULL PRIMARY KEY,
  fileName TEXT NOT NULL,
  totalRows INTEGER NOT NULL,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS Review (
  id TEXT NOT NULL PRIMARY KEY,
  platform TEXT,
  productName TEXT,
  rating REAL,
  author TEXT,
  content TEXT NOT NULL,
  createdAt DATETIME,
  importedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  importBatchId TEXT,
  CONSTRAINT Review_importBatchId_fkey FOREIGN KEY (importBatchId) REFERENCES ImportBatch (id) ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE TABLE IF NOT EXISTS AnalysisResult (
  id TEXT NOT NULL PRIMARY KEY,
  reviewId TEXT NOT NULL UNIQUE,
  sentiment TEXT NOT NULL,
  topics TEXT NOT NULL,
  intent TEXT NOT NULL,
  urgency TEXT NOT NULL,
  summary TEXT NOT NULL,
  confidence REAL NOT NULL,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT AnalysisResult_reviewId_fkey FOREIGN KEY (reviewId) REFERENCES Review (id) ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE IF NOT EXISTS ReplyDraft (
  id TEXT NOT NULL PRIMARY KEY,
  reviewId TEXT NOT NULL,
  replyText TEXT NOT NULL,
  editedText TEXT,
  tone TEXT NOT NULL,
  riskFlags TEXT NOT NULL,
  reasoningSummary TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  generationParams TEXT NOT NULL,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT ReplyDraft_reviewId_fkey FOREIGN KEY (reviewId) REFERENCES Review (id) ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE IF NOT EXISTS BrandProfile (
  id TEXT NOT NULL PRIMARY KEY,
  name TEXT NOT NULL,
  tone TEXT NOT NULL,
  audience TEXT NOT NULL,
  forbiddenWords TEXT NOT NULL,
  servicePolicy TEXT NOT NULL,
  replyLength TEXT NOT NULL DEFAULT 'medium',
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS PromptVersion (
  id TEXT NOT NULL PRIMARY KEY,
  name TEXT NOT NULL,
  version TEXT NOT NULL,
  purpose TEXT NOT NULL,
  content TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT 1,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS PromptVersion_name_version_key ON PromptVersion(name, version);
CREATE TABLE IF NOT EXISTS AiConfig (
  id TEXT NOT NULL PRIMARY KEY DEFAULT 'default',
  baseUrl TEXT,
  model TEXT,
  apiKey TEXT,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
"""
)
conn.commit()
conn.close()

print(f"SQLite database ready: {DB_PATH}")
