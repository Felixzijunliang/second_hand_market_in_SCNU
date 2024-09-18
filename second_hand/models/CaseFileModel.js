const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');  // 确保引入了 UUID 生成库

let CaseFileModelSchema = new mongoose.Schema({
  _id: {
    type: String,
    default: uuidv4  // 自动生成 UUID 作为默认 _id
  },
  FileID: {
    type: String,
    required: true
  },
  caseID: Number,
  mainCLs: String,
  cls1: String,
  cls2: String,
  point: Number,
  page: Number,
  File: String,
  reviewercode: Number,
  categorycode: {
    type: Number,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isDone: {
    type: Boolean,
    default: false
  },
  finalDone: {
    type: Boolean,
    default: false
  },
  priority: Number,
  reviewer1: {  // 新增审核员1
    type: Number,
    required: false
  },
  reviewer2: {  // 新增审核员2
    type: Number,
    required: false
  }
}, {
  timestamps: true,  // 启用时间戳
  id: false  // 阻止 Mongoose 生成虚拟的 id 属性
});

let CaseFileModel = mongoose.model('CaseFileModel', CaseFileModelSchema);
module.exports = CaseFileModel;
