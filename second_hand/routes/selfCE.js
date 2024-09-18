const express = require('express');
const ReportModel = require('../models/ReportModel');
const sql = require('../db/sqlpool.js').pool;
const { query } = require('../db/sqlpool');
const checkTokenMiddleware = require('../middlewares/checkTokenMiddleware');

const router = express.Router();

router.get('/score', checkTokenMiddleware, (req, res) => {
  const userID = req.query.ID //学号开变量
  sql.getConnection((err, connection) => {
    if (err) {
      console.error('Error getting connection:', err);
      res.json({
        statusID: -1,
        msg: '数据库连接错误',
      });
      return;
    }

    // 执行查询
    connection.query('SELECT * FROM scorePlus WHERE userID = ?', [userID], (queryErr, results) => {
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
          msg: '学号不存在',
        });
        return;
      }

      console.log('Query results:', results);
      // 考虑到总成绩单的唯一性，这里直接选择记录0
      // 构造返回json
      res.json({
        statusID: 0,
        morality: results[0].morality,
        academic: results[0].academic,
        physical: results[0].physical,
        art: results[0].art,
        labor: results[0].labor
      });
    }
    );
  });
});

// router.get('/history', checkTokenMiddleware, (req, res) => {
//   ReportModel.find({ userID: req.query.ID })
//     .then(data => {
//       const result = data.map(item => {
//         return {
//           uuid: item.uuid,
//           updateTime: item.updateTime,
//           morality: item.morality,
//           academic: item.academic,
//           physical: item.physical,
//           art: item.art,
//           labor: item.labor,
//           status: item.status
//         };
//       });
//       res.json(result);
//     })
//     .catch(err => {
//       res.json(err);
//     })
// });
router.get('/history', checkTokenMiddleware, async (req, res) => {
  try {
    let classValue = '', year = '', history = '';
    const studentID = req.query.ID;

    const student = await query('SELECT * FROM userinfo WHERE userID = ?', [studentID]);

    if (student.length === 0) {
      res.json({
        statusID: -1,
        msg: '没有找到对应学生',
      });
      return;
    } else {
      classValue = student[0].Class;
      year = student[0].Year;
      try {
        history = JSON.parse(student[0].history);
      } catch (error) {
        history = {}; // 解析失败，使用一个空对象
      }
    }
    const resArr = Object.values(history)
    if (!resArr){
      res.json({
        data: {History:[]},
        statusID: 0,
        msg: '查询成功，但用户不存在历史记录',
      })
    }else{
      const reportPromises = resArr.map(uuid => ReportModel.findOne({ uuid: uuid }));
      const reportDatas = await Promise.all(reportPromises);
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
        data: {History: results},
        statusID: 0,
        msg: '查询成功',
      })
    }
  } catch (err) {
    console.log(err);
  }
});



module.exports = router;