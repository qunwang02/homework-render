const express = require('express');
const router = express.Router();
const database = require('./database');
const { ObjectId } = require('mongodb');

// 健康检查
router.get('/health', async (req, res) => {
  try {
    await database.connect();
    res.json({ 
      status: 'healthy', 
      timestamp: new Date().toISOString(),
      service: 'homework-collection-system'
    });
  } catch (error) {
    res.status(503).json({ 
      status: 'unhealthy', 
      error: error.message 
    });
  }
});

// 获取配置
router.get('/config', async (req, res) => {
  res.json({
    success: true,
    system: '功课收集系统',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    features: ['submit', 'query', 'stats', 'export']
  });
});

// 提交功课记录
router.post('/submit', async (req, res) => {
  try {
    await database.connect();
    const homeworkCollection = database.homeworkRecords();
    
    const record = {
      ...req.body,
      submitTime: new Date(),
      submittedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      deviceId: req.headers['user-agent'] || 'web',
      ip: req.ip,
      // 确保数字类型
      nineWord: parseInt(req.body.nineWord) || 0,
      buddhaWorship: parseInt(req.body.buddhaWorship) || 0,
      quietZen: parseInt(req.body.quietZen) || 0,
      activeZen: parseInt(req.body.activeZen) || 0,
      diamond: parseInt(req.body.diamond) || 0,
      amitabha: parseInt(req.body.amitabha) || 0,
      guanyin: parseInt(req.body.guanyin) || 0,
      puxian: parseInt(req.body.puxian) || 0,
      dizang: parseInt(req.body.dizang) || 0,
      remark: req.body.remark || '',
      storageMode: req.body.storageMode || 'both'
    };
    
    const result = await homeworkCollection.insertOne(record);
    
    // 记录日志
    await database.logs().insertOne({
      type: 'homework_submit',
      recordId: result.insertedId,
      name: record.name,
      date: record.date,
      timestamp: new Date(),
      ip: req.ip
    });
    
    res.json({
      success: true,
      message: '功课记录提交成功',
      recordId: result.insertedId,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('提交错误:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// 获取功课记录
router.get('/records', async (req, res) => {
  try {
    await database.connect();
    const homeworkCollection = database.homeworkRecords();
    
    const { page = 1, limit = 20, search = '', sortBy = 'submittedAt', sortOrder = 'desc' } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // 构建查询条件
    const query = {};
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { remark: { $regex: search, $options: 'i' } }
      ];
    }
    
    const [records, totalCount] = await Promise.all([
      homeworkCollection
        .find(query)
        .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
        .skip(skip)
        .limit(parseInt(limit))
        .toArray(),
      homeworkCollection.countDocuments(query)
    ]);
    
    res.json({
      success: true,
      data: records.map(record => ({
        ...record,
        _id: record._id.toString()
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        totalCount,
        totalPages: Math.ceil(totalCount / parseInt(limit))
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('查询错误:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 获取统计信息
router.get('/stats', async (req, res) => {
  try {
    await database.connect();
    const homeworkCollection = database.homeworkRecords();
    
    const today = new Date().toISOString().split('T')[0];
    
    const [totalRecords, todayRecords, nameStats, classicsStats] = await Promise.all([
      homeworkCollection.countDocuments({}),
      homeworkCollection.countDocuments({ date: today }),
      homeworkCollection.aggregate([
        { $group: {
          _id: '$name',
          count: { $sum: 1 },
          lastSubmit: { $max: '$submittedAt' }
        }},
        { $sort: { count: -1 } }
      ]).toArray(),
      homeworkCollection.aggregate([
        { $group: {
          _id: null,
          totalDiamond: { $sum: '$diamond' },
          totalAmitabha: { $sum: '$amitabha' },
          totalGuanyin: { $sum: '$guanyin' },
          totalPuxian: { $sum: '$puxian' },
          totalDizang: { $sum: '$dizang' },
          totalNineWord: { $sum: '$nineWord' },
          totalBuddhaWorship: { $sum: '$buddhaWorship' },
          totalQuietZen: { $sum: '$quietZen' },
          totalActiveZen: { $sum: '$activeZen' }
        }}
      ]).toArray()
    ]);
    
    const stats = classicsStats[0] || {
      totalDiamond: 0,
      totalAmitabha: 0,
      totalGuanyin: 0,
      totalPuxian: 0,
      totalDizang: 0,
      totalNineWord: 0,
      totalBuddhaWorship: 0,
      totalQuietZen: 0,
      totalActiveZen: 0
    };
    
    res.json({
      success: true,
      stats: {
        totalRecords,
        todayRecords,
        nameStats,
        classicsStats: stats,
        totalClassics: stats.totalDiamond + stats.totalAmitabha + stats.totalGuanyin + stats.totalPuxian + stats.totalDizang
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('统计错误:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 更新记录
router.put('/update', async (req, res) => {
  try {
    await database.connect();
    const homeworkCollection = database.homeworkRecords();
    
    const { id, ...updateData } = req.body;
    
    const result = await homeworkCollection.updateOne(
      { _id: new ObjectId(id) },
      { 
        $set: {
          ...updateData,
          updatedAt: new Date()
        }
      }
    );
    
    res.json({
      success: true,
      modifiedCount: result.modifiedCount,
      message: '记录更新成功'
    });
    
  } catch (error) {
    console.error('更新错误:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 删除记录
router.delete('/delete', async (req, res) => {
  try {
    await database.connect();
    const homeworkCollection = database.homeworkRecords();
    
    const { id } = req.body;
    
    const result = await homeworkCollection.deleteOne({ 
      _id: new ObjectId(id) 
    });
    
    res.json({
      success: true,
      deletedCount: result.deletedCount,
      message: '记录删除成功'
    });
    
  } catch (error) {
    console.error('删除错误:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
