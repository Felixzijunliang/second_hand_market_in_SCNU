const express = require('express');
const ReportModel = require('../models/ReportModel');
const SingleReportModel = require('../models/SingleReportModel');
const CaseModel = require('../models/CaseModel');
const UserToDoModel = require('../models/UserToDoModel');
const UserModel = require('../models/UserModel');
const CaseFileModel = require('../models/CaseFileModel');
const sql = require('../db/sqlpool').pool;
const { query } = require('../db/sqlpool');
const multer = require('multer');
const checkTokenMiddleware = require('../middlewares/checkTokenMiddleware');
const { classifyAndStoreCaseList } = require('./todolistupdate');
const { updateReviewerTasks } = require('./reviewlistupdate');

const { v4: uuidv4 } = require('uuid');

const router = express.Router();
const fs = require('fs')
const path = require('path');


// 设置存储引擎
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/'); // 文件存储的目录
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// 创建 multer 实例
const upload = multer({ storage: storage });

// 文件上传接口
router.post('/upload', upload.single('file'), async (req, res) => {
  const { fileID } = req.body;
  const file = req.file;

  if (!file) {
    return res.status(400).json({
      statusID: -1,
      msg: '未选择文件'
    });
  }

  try {
    console.log('Received file:', file);
    console.log('Received fileID:', fileID);

    // 根据 fileID 查找对应的记录
    const existingCaseFile = await CaseFileModel.findOne({ FileID: fileID });
    console.log('Found existing case file:', existingCaseFile);

    if (!existingCaseFile) {
      return res.status(404).json({
        statusID: -1,
        msg: '未找到对应的文件记录'
      });
    }

    // 更新记录中的 File 字段为新文件的 URL
    existingCaseFile.File = file.filename;
    console.log('Updating case file with new file URL:', existingCaseFile);

    await existingCaseFile.save();
    console.log('Saved updated case file successfully');

    // 返回文件访问 URL
    res.json({
      statusID: 1,
      msg: '文件上传成功',
      fileURL: `http://localhost:8012/uploads/${file.filename}` // 返回文件访问 URL
    });
  } catch (err) {
    console.error('文件上传错误:', err);
    res.status(500).json({
      statusID: -1,
      msg: '文件上传失败',
      error: err.message
    });
  }
});

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

    // 检查用户是否存在
    const user = await UserModel.findOne({ userID: userID });

    if (!user) {
      // 如果用户不存在，创建新用户
      await UserModel.create({
        userID: userID,
        caseList: [uuid], // 初始化caseList
        isActive: true
      });
    } else {
      // 如果用户已存在，更新caseList
      await UserModel.updateOne(
        { userID: userID },
        { $push: { caseList: uuid } }
      );
    }

    // 调用分类和存储函数
    await classifyAndStoreCaseList(userID);

    // 调用更新审核员任务函数
    await updateReviewerTasks(newCaseFile);

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

// 更新case接口
router.post('/updatenewrecord', async (req, res) => {
  try {
    // 生成用于标识对象的uuid
    const uuid = uuidv4();
    let { FileID, userID, caseID, maxcls, midcls, mincls, point, page, file, priority ,categorycode} = req.body;
    
    // 把旧的标签改为false
    await CaseFileModel.updateMany(
      { FileID: FileID },
      { isActive: false },
      { new: true }
    );

    // 从用户的案例列表中移除旧的FileID
    await UserModel.updateMany(
      { userID: userID },
      { $pull: { caseList: FileID }}
    );

    // 创建新的案件文件记录
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
      isDone: false ,// 假设新创建的case文件isDone为false
      categorycode:categorycode
      
    });

    // 将新的uuid添加到用户模型的caseList中
    await UserModel.updateMany(
      { userID: userID },
      { $push: { caseList: uuid }},
      { upsert: true }
    );

    // 调用分类和存储函数
    await classifyAndStoreCaseList(userID);

    // 调用更新审核员任务函数
    await updateReviewerTasks(newCaseFile);

    // 成功修改数据库
    res.json({
      statusID: 1,
      msg: '成功写入数据库'
    });
  } catch (err) {
    console.error('Error during database operations:', err);
    res.json({
      statusID: -1,
      msg: 'mongo数据库错误'
    });
  }
});

// 删除case接口
router.post('/deleterecord', async (req, res) => {
  // 从请求体获得参数
  let { FileID, userID } = req.body;  // 确保userID也从req.body中提取

  try {
    // 将指定的案件文件标记为不活跃
    const deactivatedFile = await CaseFileModel.findOneAndUpdate(
      { FileID: FileID },
      { isActive: false },
      { new: true }
    );

    // 从用户的案例列表中移除FileID
    await UserModel.updateMany(
      { userID: userID },
      { $pull: { caseList: FileID }}
    );

    // 调用分类和存储函数
    await classifyAndStoreCaseList(userID);

    // 调用更新审核员任务函数
    await updateReviewerTasks(deactivatedFile);

    // 响应客户端请求
    res.json({
      statusID: 1,
      msg: '成功删除数据库'
    });
  } catch (err) {
    console.error('Error during database operations:', err);
    res.json({
      statusID: -1,
      msg: 'mongo数据库错误'
    });
  }
});

// 查找case接口
router.post('/findrecord', (req, res) => {
  // 从请求参数获取查询条件
  const { FileID } = req.body;

  // 使用 CaseModel 模型执行查询操作
  CaseFileModel.find({ FileID: FileID })
    .then(docs => {
      // 查询成功，返回查询结果
      res.json({ statusID: 0, data: docs });
    })
    .catch(err => {
      // 查询失败，返回错误信息
      console.error('查询数据库时发生错误:', err);
      res.json({ statusID: -1, msg: '查询数据库错误' });
    });
});

// 获取用户统计数据接口
router.post('/userstatus', async (req, res) => {
  try {
    const { userID } = req.body; // 从请求体中获取 userID

    // 查找对应的 UserToDoModel
    let userToDo = await UserToDoModel.findOne({ userID: userID });

    if (!userToDo) {
      // 如果在 UserToDoModel 中未找到，则查找 UserModel
      let user = await UserModel.findOne({ userID: userID });

      if (!user) {
        // 如果 UserModel 也未找到，则创建 UserModel
        user = new UserModel({
          userID: userID,
          caseList: [],
          isActive: true,
          reviewer: false,
          level: 0
        });

        // 保存新的 UserModel
        await user.save();
      }

      // 创建对应的 UserToDoModel
      userToDo = new UserToDoModel({
        userID: user.userID,
        toDoList: [],
        doneList: [],
        finaldoneList: [],
        finaltodoList: [],
        reviewList: [],
        reviewtodoList: [],
        reviewdownList: []
      });

      // 保存新的 UserToDoModel
      await userToDo.save();
    }

    // 查找待初审、初审通过、待终审和终审通过的案件文件
    const reviewTodoCount = await CaseFileModel.countDocuments({
      FileID: { $in: userToDo.reviewtodoList },
      isDone: false, // 待初审
      finalDone: false // 初审未完成
    });

    const reviewDoneCount = await CaseFileModel.countDocuments({
      FileID: { $in: userToDo.reviewdownList },
      isDone: true, // 初审通过
      finalDone: false // 待终审
    });

    const finalTodoCount = await CaseFileModel.countDocuments({
      FileID: { $in: userToDo.finaltodoList },
      isDone: true, // 初审通过
      finalDone: false // 待终审
    });

    const finalDoneCount = await CaseFileModel.countDocuments({
      FileID: { $in: userToDo.finaldoneList },
      finalDone: true // 终审通过
    });

    // 返回统计数据
    res.json({
      statusID: 1,
      reviewTodoCount: reviewTodoCount, // 待初审
      reviewDoneCount: reviewDoneCount, // 初审通过
      finalTodoCount: finalTodoCount,   // 待终审
      finalDoneCount: finalDoneCount,   // 终审通过
      msg: '统计数据获取成功'
    });
  } catch (err) {
    console.error('获取用户统计数据时出错:', err);
    res.status(500).json({
      statusID: -1,
      msg: '服务器错误'
    });
  }
});
// 获取文件状态接口
router.post('/filestatus', async (req, res) => {
  try {
    const { FileID } = req.body; // 从请求体中获取 FileID

    // 查找对应的案件文件记录
    const caseFile = await CaseFileModel.findOne({ FileID: FileID });

    if (!caseFile) {
      return res.status(404).json({
        statusID: -1,
        msg: '未找到对应的案件文件'
      });
    }

    // 判断案件文件的状态
    let status;
    if (!caseFile.isDone && !caseFile.finalDone) {
      status = '待初审'; // isDone 为 false 且 finalDone 为 false
    } else if (caseFile.isDone && !caseFile.finalDone) {
      status = '初审通过'; // isDone 为 true 且 finalDone 为 false
    } else if (caseFile.isDone && caseFile.finalDone) {
      status = '终审通过'; // isDone 为 true 且 finalDone 为 true
    } else {
      status = '未知状态'; // 其他情况
    }

    // 返回文件状态信息
    res.json({
      statusID: 1,
      fileID: FileID,
      status: status,
      isDone: caseFile.isDone,
      finalDone: caseFile.finalDone,
      msg: '文件状态获取成功'
    });
  } catch (err) {
    console.error('获取文件状态时出错:', err);
    res.status(500).json({
      statusID: -1,
      msg: '服务器错误',
      error: err.message
    });
  }
});



module.exports = router ;