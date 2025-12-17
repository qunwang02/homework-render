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
      console.log('✅ 已连接到功课数据库');
      return this.db;
    }
    
    if (this.connecting) {
      console.log('🔄 正在连接功课数据库，请稍候...');
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
    console.log('🔗 开始连接数据库...');
    
    try {
      const uri = process.env.MONGODB_URI || 'mongodb+srv://nanmo009:Wwx731217@cluster-fosheng.r3b5crc.mongodb.net/?retryWrites=true&w=majority&appName=cluster-fosheng';
      const dbName = process.env.DATABASE_NAME || 'homework_db';
      
      console.log(`🔗 连接到数据库: ${dbName}`);
      
      this.client = new MongoClient(uri, {
        serverApi: {
          version: ServerApiVersion.v1,
          strict: true,
          deprecationErrors: true,
        },
        connectTimeoutMS: 10000,
        socketTimeoutMS: 30000,
      });
      
      await this.client.connect();
      console.log('✅ MongoDB连接建立成功');
      
      this.db = this.client.db(dbName);
      this.isConnected = true;
      this.connecting = false;
      
      // 测试连接
      await this.db.command({ ping: 1 });
      console.log('✅ 数据库ping成功');
      
      // 初始化集合
      await this.initHomeworkCollections();
      
      console.log(`✅ 功课数据库连接成功: ${dbName}`);
      
      return this.db;
    } catch (error) {
      this.connecting = false;
      console.error('❌ 功课数据库连接失败:', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  // 初始化功课集合
  async initHomeworkCollections() {
    try {
      const collections = await this.db.listCollections().toArray();
      const collectionNames = collections.map(c => c.name);
      
      if (!collectionNames.includes('homework_records')) {
        await this.db.createCollection('homework_records');
        console.log('✅ 创建 homework_records 集合');
      } else {
        console.log('✅ homework_records 集合已存在');
      }
      
      if (!collectionNames.includes('homework_logs')) {
        await this.db.createCollection('homework_logs');
        console.log('✅ 创建 homework_logs 集合');
      } else {
        console.log('✅ homework_logs 集合已存在');
      }
      
      // 为 homework_records 创建索引
      await this.db.collection('homework_records').createIndex({ name: 1 });
      await this.db.collection('homework_records').createIndex({ date: 1 });
      await this.db.collection('homework_records').createIndex({ submittedAt: -1 });
      console.log('✅ 数据库索引创建完成');
      
    } catch (error) {
      console.error('❌ 初始化集合失败:', error.message);
    }
  }

  async disconnect() {
    try {
      if (this.client) {
        await this.client.close();
        this.isConnected = false;
        console.log('✅ 功课数据库连接已关闭');
      }
    } catch (error) {
      console.error('❌ 关闭功课数据库连接失败:', error.message);
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
