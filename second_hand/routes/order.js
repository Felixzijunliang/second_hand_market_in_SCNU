const express = require('express');
const router = express.Router();
const Order = require('../models/OrderModel'); // 导入订单模型
const { v4: uuidv4 } = require('uuid'); // 引入 UUID 库生成唯一标识符

// 生成订单
router.post('/neworders', async (req, res) => {
    try {
      const { productID, userid } = req.body; // 从请求体中获取 productID
  
      // 生成新的 buyerID
      const buyerID = uuidv4(); // 使用 UUID 生成唯一的 buyerID
      const username = userid;
      // 创建新订单
      const newOrder = new Order({
        productID,
        buyerID,
        buyeruserID: username,
      });
  
      // 保存订单到数据库
      await newOrder.save();
  
      res.status(201).json({
        message: 'Order created successfully',
        buyerID: buyerID, // 使用生成的 buyerID
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Error creating order' });
    }
  });

// 获取用户订单
router.get('/getorders', async (req, res) => {
    try {
      const buyerID = req.query.buyerID; // 从查询参数获取 buyerID
      const orders = await Order.find({ buyerID, isActive: true }); // 只获取激活的订单
  
      res.status(200).json(orders);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Error retrieving orders' });
    }
  });
  // 确认订单
router.post('/confirmorders', async (req, res) => {
  const { buyerID , status } = req.body;  // 获取请求中的商品ID

  try {
    // 检查商品是否存在
    const orders = await Order.find({ buyerID, isActive: true }); // 只获取激活的订单

    if (!orders) {
      return res.status(404).json({
        success: false,
        message: 'order not be found',  // 商品不存在时返回错误
      });
    }
    orders.status = status;
    const updatedOrder = await orders.save();

    // 返回成功响应
    res.json({
      success: true,
      message: '交易确认成功',  // 交易确认成功
      data: {
        orderstatus: updatedOrder.status,  // 返回新创建的订单ID
      },
    });

  } catch (err) {
    // 捕获任何错误并返回错误信息
    console.error(err);  // 可以用于调试日志
    res.status(500).json({
      success: false,
      message: '服务器错误',  // 如果发生任何服务器错误
    });
  }
  
});
  
// 更新订单
router.post('/updateorder', async (req, res) => {
    try {
        const { buyerID, productID } = req.body; // 从请求体中获取 buyerID 和 productID

        const order = await Order.findOne({ buyerID }); // 使用 buyerID 查找订单
        if (!order || !order.isActive) {
            return res.status(404).json({ message: 'Order not found or inactive' });
        }

        order.productID = productID;
        const updatedOrder = await order.save();

        res.status(200).json({
            message: 'Order updated successfully',
            order: updatedOrder,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error updating order' });
    }
});

// 删除订单
router.post('/deleteorder', async (req, res) => {
    try {
        const { buyerID } = req.body; // 从请求体中获取 buyerID

        const order = await Order.findOne({ buyerID }); // 使用 buyerID 查找订单
        if (!order || !order.isActive) {
            return res.status(404).json({ message: 'Order not found or inactive' });
        }

        order.isActive = false;
        const updatedOrder = await order.save();

        res.status(200).json({
            message: 'Order deleted successfully',
            order: updatedOrder,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error deleting order' });
    }
});

module.exports = router;
