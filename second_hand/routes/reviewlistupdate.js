const express = require('express');
const ReportModel = require('../models/ReportModel');
const UserToDoModel = require('../models/UserToDoModel');
const SingleReportModel = require('../models/SingleReportModel');
const CaseModel = require('../models/CaseModel');
const UserModel = require('../models/UserModel');
const CaseFileModel = require('../models/CaseFileModel');const sql = require('../db/sqlpool').pool;
const { query } = require('../db/sqlpool');
const multer = require('multer');
const checkTokenMiddleware = require('../middlewares/checkTokenMiddleware');
const checkAdminMiddleware = require('../middlewares/checkAdminMiddleware');
const { v4: uuidv4 } = require('uuid');
const updateReviewerTasks = async (caseFile) => {
  try {
    // 查找所有审核员
    const reviewers = await UserModel.find({ reviewer: true });

    for (const reviewer of reviewers) {
      // 查找审核员的UserToDo文档
      let userToDo = await UserToDoModel.findOne({ userID: reviewer.userID });

      if (!userToDo) {
        continue; // 如果未找到UserToDo文档，跳过该审核员
      }

      // 检查 reviewtodoList 和 reviewdownList 中的所有 caseFile 是否是 isActive
      userToDo.reviewtodoList = await filterInactiveCases(userToDo.reviewtodoList);
      userToDo.reviewdownList = await filterInactiveCases(userToDo.reviewdownList);

      // 检查新的CaseFile的categorycode是否在审核员的reviewList中
      if (userToDo.reviewList.includes(caseFile.categorycode.toString())) {
        if (caseFile.isActive) {
          if (caseFile.isDone) {
            // 如果 isDone 为真
            const todoIndex = userToDo.reviewtodoList.indexOf(caseFile.FileID);
            if (todoIndex > -1) {
              userToDo.reviewtodoList.splice(todoIndex, 1); // 从 reviewtodoList 中移除
            }
            if (!userToDo.reviewdownList.includes(caseFile.FileID)) {
              userToDo.reviewdownList.push(caseFile.FileID); // 加入到 reviewdownList
            }
          } else {
            // 如果 isDone 为假
            const downIndex = userToDo.reviewdownList.indexOf(caseFile.FileID);
            if (downIndex > -1) {
              userToDo.reviewdownList.splice(downIndex, 1); // 从 reviewdownList 中移除
            }
            if (!userToDo.reviewtodoList.includes(caseFile.FileID)) {
              userToDo.reviewtodoList.push(caseFile.FileID); // 加入到 reviewtodoList
            }
          }
        }
      }

      // 保存更新后的UserToDo文档
      await userToDo.save();
    }
  } catch (error) {
    console.error('更新审核员任务时出错:', error);
  }
};

const filterInactiveCases = async (caseList) => {
  const activeCases = [];
  for (const fileID of caseList) {
    const caseFile = await CaseFileModel.findOne({ FileID: fileID });
    if (caseFile && caseFile.isActive) {
      activeCases.push(fileID);
    }
  }
  return activeCases;
};
  
  module.exports = { updateReviewerTasks };