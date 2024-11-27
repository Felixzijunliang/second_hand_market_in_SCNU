const mongoose = require('mongoose');

// 定义商品的 Schema
const productSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
  },
  title: {
    type: String,
    required: true,
  }, 
  username: {
    type: String,
    required: true,
  },
  buyername: {
    type: String,
  },
  status: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  isActive: {
    type: Boolean,
    default: true
  },
  price: {
    type: Number,
    required: true,
  },
  imageUrl: {
    type: String, // 存储图片的URL
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// 创建模型
const Product = mongoose.model('Product', productSchema);

module.exports = Product;
