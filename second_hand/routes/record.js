const express = require('express');
const CaseFileModel = require('../models/CaseFileModel');
const sql = require('../db/sqlpool').pool;
const { query } = require('../db/sqlpool');
const multer = require('multer');



const { v4: uuidv4 } = require('uuid');

const router = express.Router();
const fs = require('fs')
const path = require('path');




// 创建case接口
router.post('/newrecord', async (req, res) => {
  try {
    // 生成用于标识对象的uuid
    const uuid = uuidv4();

    // 从请求体获得参数
    let { userID, caseID, maxcls, midcls, mincls, point, page, file, priority ,categorycode} = req.body;
    
    // 确保userID是Number类型
    userID = Number(userID);

    // 创建CaseFileModel文档
    const newCaseFile = await CaseFileModel.create({
      FileID: uuid,
      userID: userID,
      caseID: caseID,
      mainCLs: maxcls,
      cls1: midcls,
      cls2: mincls,
      point: point,
      page: page,
      file: file,
      priority: priority,
      isActive: true,
      isDone: false, // 假设新创建的case文件isDone为false
      categorycode:categorycode
    });

    // 如果所有操作都成功，则发送成功响应
    res.json({
      statusID: 1,
      msg: '成功写入数据库'
    });
  } catch (err) {
    // 如果任何一个Promise被拒绝，则进入这个catch块
    console.error(err);
    res.status(500).json({
      statusID: -1,
      msg: 'mongo数据库错误',
      error: err.message // 提供错误信息方便调试
    });
  }
});


module.exports = router ;