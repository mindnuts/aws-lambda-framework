import mysql, { Connection as AuroraConnection, Pool as AuroraPool } from 'mysql2/promise'
import Database from '../container/Database'
import Container, { Service } from 'typedi'
import { DatabaseToken } from '../container/DatabaseToken'
import AuroraConfig from '../storage/AuroraConfig'
import { Environment } from '../container/Environment'

@Service({ id: DatabaseToken })
export default class Aurora implements Database {
  private connection?: AuroraConnection
  private pool?: AuroraPool
  readonly config: AuroraConfig = {
    connectionLimit: process.env.AURORA_CONNECTION_LIMIT ? parseInt(process.env.AURORA_CONNECTION_LIMIT) : 10,
    connectTimeout: process.env.AURORA_CONNECTION_TIMEOUT ? parseInt(process.env.AURORA_CONNECTION_TIMEOUT) : 10,
    host: process.env.AURORA_HOST,
    database: process.env.AURORA_DB,
    user: process.env.AURORA_USER,
    password: process.env.AURORA_PASS
  }

  constructor() {
    this.validateConfig()
  }

  protected validateConfig() {
    if (process.env.AURORA_USER) throw 'Missing Aurora credential: AURORA_USER'
    if (process.env.AURORA_PASS) throw 'Missing Aurora credential: AURORA_PASS'
    if (process.env.AURORA_HOST) throw 'Missing Aurora credential: AURORA_HOST'
    if (process.env.AURORA_DB) throw 'Missing Aurora credential: AURORA_DB'
  }

  protected async connect(): Promise<AuroraConnection> {
    try {
      return mysql.createConnection(this.config)
    } catch (err) {
      throw `Encountered ${err} while creating Aurora connection with config: ${this.config}`
    }
  }

  protected createPool(): AuroraPool {
    try {
      return mysql.createPool(this.config)
    } catch (err) {
      throw `Encountered ${err} while creating Aurora pool with config: ${this.config}`
    }
  }

  async execute(sql: string, inputs?: any[]): Promise<unknown> {
    if (Container.get('pooling')) return this.poolExecute(sql, inputs)
    else return this.connectionExecute(sql, inputs)
  }

  protected async poolExecute(sql: string, inputs?: any[]): Promise<unknown> {
    if (!this.pool) this.pool = this.createPool()

    try {
      let [rows] = await this.pool.execute(sql, inputs)
      return rows
    } catch (err) {
      throw `Encountered ${err} while executing query: ${sql} ${inputs ? '\nWith input: ' + inputs : ''}`
    }
  }

  protected async connectionExecute(sql: string, inputs?: any[]): Promise<unknown> {
    if (!this.connection) this.connection = await this.connect()

    try {
      let [rows] = await this.connection.execute(sql, inputs)
      return rows
    } catch (err) {
      throw `Encountered ${err} while executing query: ${sql} ${inputs ? '\nWith input: ' + inputs : ''}`
    }
  }

  async end(): Promise<void> {
    if (this.connection) await this.connection.end()
    if (Container.get('environment') === Environment.Development && this.pool) await this.pool.end()
  }
}
