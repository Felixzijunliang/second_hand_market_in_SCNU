const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  productID: {
    type: String,
    required: true,
  },
  buyerID: {
    type: String,
    required: true,
  },
  buyeruserID: {
    type: String,
    required: true,
  },
  
  isActive: {
    type: Boolean,
    default: true
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'cancelled'],
    default: 'pending',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const Order = mongoose.model('Order', orderSchema);

module.exports = Order;
