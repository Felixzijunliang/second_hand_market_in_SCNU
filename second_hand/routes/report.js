const express = require('express');
const ReportModel = require('../models/ReportModel');
const UserToDoModel = require('../models/UserToDoModel');
const SingleReportModel = require('../models/SingleReportModel');
const sql = require('../db/sqlpool').pool;
const { query } = require('../db/sqlpool');
const multer = require('multer');
const checkTokenMiddleware = require('../middlewares/checkTokenMiddleware');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();
const fs = require('fs')

// 转换为同专业不同班级
function swapEnding(str) {
  return str.slice(0, -1) + (str.endsWith('1') ? '2' : '1');
}

function createReport(studentID, uuid, year, adminID, st, detail, stepID){
  return new Promise((resolve, reject) => {
    const updateTime = Math.floor(Date.now() / 1000);
    // console.log(req.body)
    ReportModel.create({
      userID: studentID,
      uuid,
      updateTime,
      Year: year,
      latestUpdateBy: adminID,
      status: st,
      detail,
      // 默认状态为0，即提交给本班班委审核
      stepID,
    })
      .then(data => {
        resolve(data);
      })
      .catch(err => {
        reject(err);
      }); 
  })
}


router.post('/ip', (req, res) => {
  var currentTimeStampInSeconds = Math.floor(Date.now() / 1000)
  const ip = req.ip
  // console.log('Warn:',ip,'触发了自动报告')
  res.json({
    status: 0
  })
});


router.post('/new', checkTokenMiddleware, (req, res) => {
  const { userID, items } = req.body;

  // 验证必需参数
  if (!userID || !items) {
    return res.status(400).json({
      statusID: -1,
      msg: '参数缺失'
    });
  }

  // 验证 items 数组的每个对象结构
  for (const item of items) {
    if (!item.categoryCode || !item.materials || !item.timestamp) {
      return res.status(400).json({
        statusID: -1,
        msg: 'items 数组中对象结构错误'
      });
    }
  }

  const updateTime = Math.floor(Date.now() / 1000);
  const uuid = uuidv4();

  // 创建新的报告
  ReportModel.create({
    uuid,
    updateTime,
    Year: 2023,
    latestUpdateBy: "None",
    userID: items.map(item => item.categoryCode),  // 将 categoryCode 存储在 userID 字段中
    status: 'pending',
    detail: items,  // items 数组保存在 detail 字段中
    stepID: 0
  })
    .then(data => {
      res.json({
        statusID: 1,
        msg: '成功写入数据库',
        data
      });
    })
    .catch(err => {
      res.json({
        statusID: -1,
        msg: 'mongo数据库错误'
      });
    });

  // 2. 寻找本班所有班委，将report的uuid写入班委的待办事项
  sql.getConnection((err, connection) => {
    if (err) {
      console.error('Error getting connection:', err);
      res.json({
        statusID: -1,
        msg: '数据库连接错误',
      });
      return;
    }
    const classValue = req.query.class;
    // 执行查询
    connection.query('SELECT * FROM userinfo WHERE class = ? AND permlevel = 1', [classValue], (queryErr, results) => {
      // 释放连接
      connection.release();

      if (queryErr) {
        console.error('Error executing query:', queryErr);
        res.json({
          statusID: -1,
          msg: '数据库查询错误',
        });
        return;
      }
      if (results.length == 0) {
        console.error('Error executing query:', queryErr);
        res.json({
          statusID: -1,
          msg: '班级不存在,请输入类似ai1或se1格式',
        });
        return;
      }
      // 随机选择一位班委
      const randomIndex = Math.floor(Math.random() * results.length);
      const admin = results[randomIndex].userID;

      // 将uuid加入到待办事项数组中
      UserToDoModel.findOneAndUpdate(
        { userID: admin },
        { $push: { toDoList: uuid } },
        { upsert: true, new: true }
      )
        .then(() => console.log(admin, '插入待办事项成功'))
        .catch(() => {
          console.log(admin, '插入待办事项失败');
          return;
        });
      res.json({
        statusID: 0,
        reportID: uuid
      });
    });
  });
});


router.post('/audit', checkTokenMiddleware, async (req, res) => {
  /**stepID
   * 0: 提交给本班班委审核
   * -1：本班班委初审失败，打回修改
   * 1：班委初审成功，提交给同专业不同班级班委交叉复审
   * 2：两次审核无分歧，返回给本人确认
   * 3：两次审核有分歧，传递至年级委员审核
   * 4：年级委员审核完毕，返回给本人确认
   * 5：级委审核完毕之后本人提出异议，交由超管进行审核
   * 6：级委审核完毕后本人确认完毕
   * 7：超管审核完毕之后交由本人确认
   * 8：超管审核完毕之后本人确认完毕
   */

  /**permlevel
   * 0: 学生
   * 1: 班委
   * 2: 级委
   * 3: 超管
   */

  // body
  // 返回成功与否
  try {
    const st = req.query.stepID;
    const targetID = req.query.targetID;

    // 根据uuid找到report主人的学号studentID
    let studentID = '';
    const report = await ReportModel.findOne({ uuid: targetID });
    // 注意：findOne()方法返回一个单一的文档对象，而.find()方法返回一个文档对象数组
    //       因此，这里不能使用report.length === 0来判断是否找到对应文档
    if (report) {
      studentID = report.userID;
    } else {
      res.json({
        statusID: -1,
        msg: '没有找到对应文档'
      })
      return;
    }

    // 根据学号studentID找到学生的班级classValue和年级year
    let classValue = '', year = '', history = '';
    const student = await query('SELECT * FROM userinfo WHERE userID = ?', [studentID]);
    if (student.length === 0) {
      res.json({
        statusID: -1,
        msg: '没有找到对应学生',
      })
      return;
    } else {
      classValue = student[0].Class;
      year = student[0].Year;
      history = student[0].history ? student[0].history : '{}';
    }

    /** 在mongo的report表下新建一行，用于储存传进来的新report */
    let uuid = uuidv4();
    let status = (st == '6' || st == '8') ? 'accepted' : 'pending';
    await createReport(studentID, uuid, year, req.query.ID, status, req.body, st);

    /** 在mySQL的userinfo表中更新history字段，用于储存已审核的report的uuid */
    // 通过传入的targetID查找
    // 将JSON字符串解析为JavaScript对象
    var jsonObject = JSON.parse(history);
    // 对JavaScript对象进行操作，例如修改其中的值
    jsonObject[st] = uuid;
    // 将JavaScript对象转换回JSON字符串
    var newJsonString = JSON.stringify(jsonObject);
    // 将history字符串重新存入数据库
    let sqlQuery = 'UPDATE userinfo SET history = ? WHERE userID = ?';
    let sqlParams = [newJsonString, studentID];
    const results = await query(sqlQuery, sqlParams);
    console.log('更改了 ' + results.changedRows + ' 条数据');

    /** 根据userID将report加入到mongo的usertodo表doneList数组中, 并将该report从todoList中删除 */
    const updatedDoneList = await UserToDoModel.findOneAndUpdate(
      { userID: studentID },
      { $push: { doneList: targetID },
        $pull: { toDoList: targetID } },
      { upsert: true, new: true }
    )

    // status = -1: 班委审核不通过，打回本人
    if (st == '-1') {
      // 通过加入到该学生的待办事项数组中实现打回本人
      const updatedTodoList = await UserToDoModel.findOneAndUpdate(
        { userID: studentID },
        { $push: { toDoList: uuid } },
        { upsert: true, new: true }
      )
      res.json({
        statusID: 0,
        msg: '打回本人成功'
      })

    // status = 0: 提交给本班班委审核
    } else if (st == '0') {
      const sqlQuery = 'SELECT * FROM userinfo WHERE permlevel = ? AND Class = ? AND Year = ?';
      const sqlParams = [1, classValue, year]; // 班委权限为1
      const results = await query(sqlQuery, sqlParams); // 找到所有班委

      if (results.length == 0) {
        res.json({
          statusID: -1,
          msg: '没有找到班委'
        })
        return;
      }
      // 随机选择一个班委
      const randomIndex = Math.floor(Math.random() * results.length);
      const admin = results[randomIndex].userID;
      // 将report的uuid加入到班委的待办事项数组中
      const updatedTodoList = await UserToDoModel.findOneAndUpdate(
        { userID: admin },
        { $push: { toDoList: uuid } },
        { upsert: true, new: true }
      )
      res.json({
        statusID: 0,
        msg: '提交班委审核成功'
      })

      // status = 1: 班委审核通过，提交给同专业不同班级班委交叉复审
    } else if (st == '1') {
      classValue = swapEnding(classValue); // 转换为同专业不同班级
      let sqlQuery = 'SELECT * FROM userinfo WHERE permlevel = ? AND Class = ? AND Year = ?';
      let sqlParams = [1, classValue, year]; // 班委权限为1
      const results = await query(sqlQuery, sqlParams); // 找到所有班委
      if (results.length == 0) {
        res.json({
          statusID: -1,
          msg: '没有找到班委'
        })
        return;
      }
      // 随机选择一个班委
      const randomIndex = Math.floor(Math.random() * results.length);
      const admin = results[randomIndex].userID;
      // 将report的uuid加入到班委的待办事项数组中
      const updatedTodoList = await UserToDoModel.findOneAndUpdate(
        { userID: admin },
        { $push: { toDoList: uuid } },
        { upsert: true, new: true }
      )
      res.json({
        statusID: 0,
        msg: '提交交叉复审成功'
      })

      // status = 2: 交叉复审无分歧，返回核算表给本人确认
    } else if (st == '2') {
      // 通过加入到该学生的待办事项数组中实现返回本人
      const updatedTodoList = await UserToDoModel.findOneAndUpdate(
        { userID: studentID },
        { $push: { toDoList: uuid } },
        { upsert: true, new: true }
      )
      res.json({
        statusID: 0,
        msg: '返回本人成功'
      })

      // status = 3: 交叉复审有分歧，提交给年级委员审核
    } else if (st == '3') {
      // 交叉复审有分歧，提交给年级委员审核
      const sqlQuery = 'SELECT * FROM userinfo WHERE permlevel = ? AND Year = ?';
      const sqlParams = [2, year]; // 级委权限为2
      const results = await query(sqlQuery, sqlParams); // 找到所有级委
      if (results.length == 0) {
        res.json({
          statusID: -1,
          msg: '没有找到级委'
        })
        return;
      }
      // 随机选择一个级委
      const randomIndex = Math.floor(Math.random() * results.length);
      const admin = results[randomIndex].userID;
      // 将report的uuid加入到级委的待办事项数组中
      const updatedTodoList = await UserToDoModel.findOneAndUpdate(
        { userID: admin },
        { $push: { toDoList: uuid } },
        { upsert: true, new: true }
      )
      res.json({
        statusID: 0,
        msg: '提交年级委员审核成功'
      })

      // status = 4: 年级委员审核完毕，返回给本人确认
    } else if (st == '4') {
      // 通过加入到该学生的待办事项数组中实现返回本人
      const updatedTodoList = await UserToDoModel.findOneAndUpdate(
        { userID: studentID },
        { $push: { toDoList: uuid } },
        { upsert: true, new: true }
      )
      res.json({
        statusID: 0,
        msg: '返回本人成功'
      })

      // status = 5: 年级委员审核完毕之后本人提出异议，交由超管进行审核
    } else if (st == '5') {
      // 年级委员审核完毕之后本人提出异议，交由超管进行审核
      const sqlQuery = 'SELECT * FROM userinfo WHERE permlevel = ? AND Year = ?';
      const sqlParams = [3, year]; // 超管权限为3
      const results = await query(sqlQuery, sqlParams); // 找到所有超管
      if (results.length == 0) {
        res.json({
          statusID: -1,
          msg: '没有找到超管'
        })
        return;
      }
      // 随机选择一个超管
      const randomIndex = Math.floor(Math.random() * results.length);
      const admin = results[randomIndex].userID;
      // 将report的uuid加入到超管的待办事项数组中
      const updatedTodoList = await UserToDoModel.findOneAndUpdate(
        { userID: admin },
        { $push: { toDoList: uuid } },
        { upsert: true, new: true }
      )
      res.json({
        statusID: 0,
        msg: '提交超管审核成功'
      })

      // status = 7: 超管审核完毕之后交由本人确认
    } else if (st == '7') {
      // 通过加入到该学生的待办事项数组中实现返回本人
      const updatedTodoList = await UserToDoModel.findOneAndUpdate(
        { userID: studentID },
        { $push: { toDoList: uuid } },
        { upsert: true, new: true }
      )
      res.json({
        statusID: 0,
        msg: '返回本人成功'
      })
    } else if (st == '6' || st == '8') {
      res.json({
        statusID: 0,
        msg: '审核完毕,报告已通过'
      })
    }

  
  } catch (err) {
    console.error(err);
    res.json({
      statusID: -1,
      msg: '流程错误'
    });
    return;
  }
});
router.get('/progress', checkTokenMiddleware, (req, res) => {
  const { userID } = req.query;

  // 验证必需参数
  if (!userID) {
    return res.status(400).json({
      statusID: -1,
      msg: '参数缺失'
    });
  }

  // 查询数据库
  ReportModel.find({ userID })
    .then(reports => {
      // 处理结果，返回需要的字段
      const progressData = [];

      reports.forEach(report => {
        if (report.detail && Array.isArray(report.detail)) {
          report.detail.forEach(item => {
            progressData.push({
              categoryCode: item.categoryCode,
              status: report.status,
              submitTime: report.updateTime
            });
          });
        }
      });

      res.json({
        statusID: 1,
        data: progressData
      });
    })
    .catch(err => {
      res.json({
        statusID: -1,
        msg: 'mongo数据库错误'
      });
    });
});

router.get('/getStepID', checkTokenMiddleware, async (req, res) => {
  const uuid = req.query.targetID;
  const report = await ReportModel.findOne({ uuid });
  if (report) {
    res.json({
      data: {
        stepID: report.stepID
      },
      statusID: 0,
      msg: '查询成功',
    })
  } else {
    res.json({
      statusID: -1,
      msg: '没有找到对应文档'
    })
  }
})


router.get('/getTDList', checkTokenMiddleware, async (req, res) => {
  const userID = req.query.ID;
  try {
    const toDoData = await UserToDoModel.findOne({ userID });
    const uuids = toDoData.toDoList;
    if (!uuids){
      res.json({
        data: {toDoList:[]},
        statusID: 0,
        msg: '查询成功，但用户不存在TDlist',
      })
    }
    // 使用Promise.all()并行查询所有report来提高效率
    const reportPromises = uuids.map(uuid => ReportModel.findOne({ uuid: uuid }));
    const reportDatas = await Promise.all(reportPromises);
    // 提取每个report的userID和updateTime, 并和uuid打包成json放到数组中返回
    const reportResults = reportDatas.map(report => ({
      uuid: report.uuid,
      userID: report.userID,
      updateTime: report.updateTime,
      stepID: report.stepID,
    }))

    // 将userID打包成数组
    const userIDs = reportResults.map(report => report.userID);
    // 查询所有userID对应的用户信息
    const userPromises = userIDs.map(userID => query('SELECT * FROM userinfo WHERE userID = ?', [userID]));
    const userDatas = await Promise.all(userPromises);
    const userResults = userDatas.map(user => ({
      name: user[0].Name,
      class: user[0].Class,
      year: user[0].Year,
    }))

    // 将reportResults和userResults合并
    const results = reportResults.map((report, index) => ({
      ...report,
      ...userResults[index]
    }));
    
    res.json({
      data: {toDoList: results},
      statusID: 0,
      msg: '查询成功',
    })
  } catch (err) {
    console.error(err);
    res.json({
      statusID: -1,
      msg: '查询失败'
    });
  }
})


// 将加分记录添加到指定审核员的待办事项，同时将记录写入SingleReport
router.post('/addTDList', checkTokenMiddleware, async (req, res) => {
  const { auditor, caseID, ID, mainCls } = req.query;
  let uuid = uuidv4(); // 生成一次UUID用于两个操作
  let st = '';
  try {
    // 首先尝试添加到待办列表
    st = 1;
    await UserToDoModel.findOneAndUpdate(
      { userID: auditor },
      { $push: { toDoList: uuid } },
      { upsert: true, new: true }
    );
    
    st = 2;
    let updateTime = Math.floor(Date.now() / 1000);
    // 然后尝试写入SingleReport
    await SingleReportModel.create({
      userID: ID,
      mainCls,
      auditor,
      caseID,
      uuid,
      history: [],
      historyIndex: 0,
      updateTime
    });

    // 如果两个操作都成功，发送成功响应
    res.json({
      statusID: 0,
      msg: '添加到待办列表并写入SingleReport成功'
    });
  } catch (err) {
    console.error(err);
    const msg = st === 1 ? '添加到待办列表失败' : '写入SingleReport失败';
    res.json({
      statusID: -1,
      msg: msg,
    });
  }
});


router.get('/getSingleReports', checkTokenMiddleware, async (req, res) => {
  const { ID } = req.query;
  try {
    const reports = await SingleReportModel.find({ userID: ID });
    res.json({
      data: reports,
      statusID: 0,
      msg: '查询成功'
    });
  } catch (err) {
    console.error(err);
    res.json({
      statusID: -1,
      msg: '查询失败'
    });
  }
})


// 上传图片接口
const storage =
  multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, './uploads/' + req.query.ID)
    },
    filename: (req, file, cb) => {
      cb(null, Date.now() + file.originalname)
    }
  })
const folderParser = (req, res, next) => {
  try {
    fs.accessSync(uploadFolder + req.query.ID)
  } catch (err) {
    fs.mkdirSync(uploadFolder + req.query.ID)
  }
  next()
}

const createFolder = folder => {
  try {
    fs.accessSync(folder)
  } catch (err) {
    fs.mkdirSync(folder)
  }
}

const uploadFolder = './uploads/'
createFolder(uploadFolder)
const upload = multer({
  storage
})

router.post('/upload', checkTokenMiddleware, folderParser, upload.single('file'), (req, res) => {
  if (!req.file) {
    res.json({
      code: -1,
      result: '未上传文件'
    })
  }
  const url = req
  // console.log(url)
  const file = req.file
  // console.log('文件类型: %s', file.mimeType)
  // console.log('原始文件名: $s', file.originalname)
  // console.log('文件大小: %s', file.size)
  // console.log('文件保存路径: %s', file.path)
  // console.log('文件保存路径: %s', file)
  res.json({
    res_code: 0,
    name: file.originalname,
    url: file.destination + '/' + file.filename
  })
})

router.get('/seekCE', checkTokenMiddleware, (req, res) => {
  const uuid = req.query.targetID;
  ReportModel.findOne({ uuid })
    .then(data => {
      console.log(data.latestUpdateBy)
      const latestUpdateBy = data.latestUpdateBy
      data.detail.latestUpdateBy=latestUpdateBy
      res.json(data.detail)})
    .catch(err => {
      res.json({
        statusID: -1,
        msg: 'mongo数据库查询错误'
      });
    })
})

// router.post('/modify', checkTokenMiddleware, (req, res) => {
//   const updateTime = Math.floor(Date.now() / 1000);
//   const { target } = req.query;
//   ReportModel.updateOne({ uuid: target }, {
//     ...req.query,
//     updateTime,
//     detail: req.body.toString()
//   })
//     .then(data => {
//       res.json({
//         statusID: 0,
//         ReportID: target
//       })
//     })
//     .catch(err => {
//       res.json(err);
//     })
// });

module.exports = router;