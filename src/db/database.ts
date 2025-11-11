import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Database connection singleton for RevelAI Journey Engine
 * Uses SQLite with better-sqlite3 for zero-config persistence
 */
class DatabaseManager {
  private static instance: Database.Database | null = null;
  private static readonly DB_PATH = join(process.cwd(), 'journeys.db');

  /**
   * Get or create database connection
   */
  public static getConnection(): Database.Database {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new Database(DatabaseManager.DB_PATH);
      DatabaseManager.initializeSchema();
      console.log(`📊 Database initialized at: ${DatabaseManager.DB_PATH}`);
    }
    return DatabaseManager.instance;
  }

  /**
   * Initialize database schema from schema.sql file
   */
  private static initializeSchema(): void {
    if (!DatabaseManager.instance) {
      throw new Error('Database connection not established');
    }

    try {
      const schemaPath = join(__dirname, 'schema.sql');
      const schemaSql = readFileSync(schemaPath, 'utf8');
      
      // Execute entire schema SQL at once (better-sqlite3 can handle multiple statements)
      DatabaseManager.instance.exec(schemaSql);

      console.log('✅ Database schema initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize database schema:', error);
      throw error;
    }
  }

  /**
   * Close database connection
   */
  public static close(): void {
    if (DatabaseManager.instance) {
      DatabaseManager.instance.close();
      DatabaseManager.instance = null;
      console.log('📊 Database connection closed');
    }
  }

  /**
   * Begin a database transaction
   */
  public static beginTransaction(): Database.Transaction {
    const db = DatabaseManager.getConnection();
    return db.transaction(() => {
      // Transaction body will be provided by caller
    });
  }

  /**
   * Execute multiple statements in a transaction
   */
  public static executeInTransaction(callback: (db: Database.Database) => void): void {
    const db = DatabaseManager.getConnection();
    const transaction = db.transaction(() => callback(db));
    transaction();
  }
}

// Export singleton instance getter
export const getDatabase = () => DatabaseManager.getConnection();
export const closeDatabase = () => DatabaseManager.close();
export const executeInTransaction = DatabaseManager.executeInTransaction;

export default DatabaseManager;