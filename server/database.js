const { MongoClient, ServerApiVersion } = require('mongodb');

class HomeworkDatabase {
  constructor() {
    this.client = null;
    this.db = null;
    this.isConnected = false;
    this.connecting = false;
  }

  async connect() {
    if (this.isConnected && this.db) {
      console.log('📊 [数据库] 已连接');
      return this.db;
    }
    
    if (this.connecting) {
      console.log('🔄 [数据库] 正在连接中...');
      return new Promise(resolve => {
        const checkConnection = () => {
          if (this.isConnected) {
            resolve(this.db);
          } else {
            setTimeout(checkConnection, 100);
          }
        };
        checkConnection();
      });
    }
    
    this.connecting = true;
    console.log('🔗 [数据库] 开始连接...');
    
    try {
      const uri = process.env.MONGODB_URI || 'mongodb+srv://nanmo009:Wwx731217@cluster-fosheng.r3b5crc.mongodb.net/?retryWrites=true&w=majority&appName=cluster-fosheng';
      const dbName = process.env.DATABASE_NAME || 'homework_db';
      
      console.log(`🔗 [数据库] 连接字符串: ${uri.substring(0, 50)}...`);
      console.log(`🔗 [数据库] 数据库名称: ${dbName}`);
      
      this.client = new MongoClient(uri, {
        serverApi: {
          version: ServerApiVersion.v1,
          strict: false, // 改为 false 避免严格模式问题
          deprecationErrors: true,
        },
        connectTimeoutMS: 15000,
        socketTimeoutMS: 45000,
        maxPoolSize: 10,
        minPoolSize: 0,
      });
      
      console.log('🔗 [数据库] 正在建立连接...');
      await this.client.connect();
      console.log('✅ [数据库] MongoDB客户端连接成功');
      
      this.db = this.client.db(dbName);
      this.isConnected = true;
      this.connecting = false;
      
      // 测试连接
      console.log('🔍 [数据库] 正在ping数据库...');
      const pingResult = await this.db.command({ ping: 1 });
      console.log(`✅ [数据库] 数据库ping成功: ${JSON.stringify(pingResult)}`);
      
      // 列出所有数据库
      const adminDb = this.client.db('admin');
      const dbList = await adminDb.admin().listDatabases();
      console.log(`📋 [数据库] 可用的数据库: ${dbList.databases.map(d => d.name).join(', ')}`);
      
      // 检查当前数据库的集合
      const collections = await this.db.listCollections().toArray();
      console.log(`📋 [数据库] homework_db中的集合: ${collections.map(c => c.name).join(', ') || '无'}`);
      
      // 初始化集合
      await this.initHomeworkCollections();
      
      console.log(`✅ [数据库] 连接完全就绪: ${dbName}`);
      
      return this.db;
    } catch (error) {
      this.connecting = false;
      console.error('❌ [数据库] 连接失败:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      throw error;
    }
  }

  // 初始化功课集合
  async initHomeworkCollections() {
    try {
      console.log('🔧 [数据库] 正在初始化集合...');
      
      // 检查集合是否存在，如果不存在则创建
      const collections = await this.db.listCollections().toArray();
      const collectionNames = collections.map(c => c.name);
      
      console.log(`📋 [数据库] 现有集合: ${collectionNames.join(', ')}`);
      
      if (!collectionNames.includes('homework_records')) {
        console.log('🔧 [数据库] 创建 homework_records 集合...');
        await this.db.createCollection('homework_records');
        console.log('✅ [数据库] homework_records 集合创建成功');
      } else {
        console.log('✅ [数据库] homework_records 集合已存在');
      }
      
      if (!collectionNames.includes('homework_logs')) {
        console.log('🔧 [数据库] 创建 homework_logs 集合...');
        await this.db.createCollection('homework_logs');
        console.log('✅ [数据库] homework_logs 集合创建成功');
      } else {
        console.log('✅ [数据库] homework_logs 集合已存在');
      }
      
      // 创建索引
      const recordsCollection = this.db.collection('homework_records');
      await recordsCollection.createIndex({ name: 1 });
      await recordsCollection.createIndex({ date: 1 });
      await recordsCollection.createIndex({ submittedAt: -1 });
      console.log('✅ [数据库] 索引创建完成');
      
    } catch (error) {
      console.error('❌ [数据库] 初始化集合失败:', error.message);
    }
  }

  async disconnect() {
    try {
      if (this.client) {
        await this.client.close();
        this.isConnected = false;
        console.log('✅ [数据库] 连接已关闭');
      }
    } catch (error) {
      console.error('❌ [数据库] 关闭连接失败:', error.message);
    }
  }

  getCollection(name) {
    if (!this.db) {
      throw new Error('功课数据库未连接，请先调用connect()方法');
    }
    return this.db.collection(name);
  }

  // 功课记录集合
  homeworkRecords() {
    if (!this.db) {
      throw new Error('数据库未连接');
    }
    return this.db.collection('homework_records');
  }

  // 功课日志集合
  homeworkLogs() {
    if (!this.db) {
      throw new Error('数据库未连接');
    }
    return this.db.collection('homework_logs');
  }
}

const homeworkDatabase = new HomeworkDatabase();

module.exports = homeworkDatabase;
